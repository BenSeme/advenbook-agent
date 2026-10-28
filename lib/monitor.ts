// "See errors arriving" without any paid service:
// - every API error is logged as one structured JSON line (visible in
//   Vercel > Logs, filterable by "monitor"),
// - if ALERT_WEBHOOK_URL is set (a Discord/Slack incoming webhook, free),
//   errors and budget threshold alerts are also pushed there in real time.
// Without a webhook, the structured logs + /api/health are the baseline.

type Fields = Record<string, unknown>;

async function pushWebhook(text: string): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Discord and Slack both accept a simple text field.
      body: JSON.stringify({ content: text, text }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // alerting must never break the request path
  }
}

export function logError(source: string, err: unknown, fields: Fields = {}): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(
    JSON.stringify({
      monitor: "error",
      source,
      message: message.slice(0, 500),
      at: new Date().toISOString(),
      ...fields,
    }),
  );
  void pushWebhook(`AdvenBook Agent — erreur (${source}) : ${message.slice(0, 300)}`);
}

const alertedThresholds = new Set<string>();

/** Alerts once per day when daily token usage crosses 50 / 80 / 100 %. */
export function alertBudgetIfNeeded(usedTokens: number, budget: number): void {
  if (budget <= 0) return;
  const pct = Math.floor((usedTokens / budget) * 100);
  const day = new Date().toISOString().slice(0, 10);
  for (const threshold of [50, 80, 100]) {
    const key = `${day}:${threshold}`;
    if (pct >= threshold && !alertedThresholds.has(key)) {
      alertedThresholds.add(key);
      console.error(
        JSON.stringify({
          monitor: "budget-alert",
          threshold,
          pct,
          usedTokens,
          budget,
          at: new Date().toISOString(),
        }),
      );
      void pushWebhook(
        `AdvenBook Agent — budget IA du jour à ${pct} % (${usedTokens}/${budget} tokens). Seuil ${threshold} % atteint.`,
      );
    }
  }
}
