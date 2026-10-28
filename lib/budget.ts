// Daily LLM token budget. Shared across instances when a KV/Upstash
// REST store is configured (KV_REST_API_URL + KV_REST_API_TOKEN, or
// UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN); otherwise an
// in-memory counter (resets on restart — fine for a single instance).
let dayKey = "";
let usedTokens = 0;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function roll(): void {
  const t = today();
  if (t !== dayKey) {
    dayKey = t;
    usedTokens = 0;
  }
}

export function dailyBudget(): number {
  const raw = Number(process.env.DAILY_TOKEN_BUDGET);
  return Number.isFinite(raw) && raw > 0 ? raw : 5_000_000;
}

function kv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function kvCmd(...parts: string[]): Promise<unknown> {
  const store = kv();
  if (!store) return null;
  const res = await fetch(
    `${store.url}/${parts.map(encodeURIComponent).join("/")}`,
    { headers: { Authorization: `Bearer ${store.token}` } },
  );
  if (!res.ok) throw new Error(`KV ${res.status}`);
  const data = (await res.json()) as { result?: unknown };
  return data.result;
}

export function addTokenUsage(prompt = 0, completion = 0): void {
  roll();
  const total = (prompt || 0) + (completion || 0);
  usedTokens += total;
  console.log(`llm budget: ${usedTokens}/${dailyBudget()} tokens today (local view)`);
  if (kv() && total > 0) {
    void kvCmd("INCRBY", `budget:${today()}`, String(total)).catch(() => undefined);
  }
}

export async function overDailyBudget(): Promise<boolean> {
  roll();
  if (usedTokens >= dailyBudget()) return true;
  if (kv()) {
    try {
      const shared = Number(await kvCmd("GET", `budget:${today()}`)) || 0;
      if (shared > usedTokens) usedTokens = shared;
      return shared >= dailyBudget();
    } catch {
      return false; // KV unreachable: fall back to the local counter only
    }
  }
  return false;
}
