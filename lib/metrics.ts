// Product funnel counters: chat turns -> books created -> "Open my book"
// clicks -> "Order my book" clicks. That funnel is what tells whether the
// agent is worth its API cost. Counts only — no user data, no content.
// Shared through the KV store when configured, in-memory otherwise.
export const METRIC_EVENTS = [
  "chat_turn",
  "book_created",
  "open_click",
  "order_click",
  "visitor_cap_hit",
] as const;
export type MetricEvent = (typeof METRIC_EVENTS)[number];

const totals = new Map<string, number>();
const dailies = new Map<string, number>();
let dayKey = "";

function today(): string {
  return new Date().toISOString().slice(0, 10);
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

export function countMetric(event: MetricEvent, n = 1): void {
  const day = today();
  if (day !== dayKey) {
    dayKey = day;
    dailies.clear();
  }
  totals.set(event, (totals.get(event) ?? 0) + n);
  dailies.set(event, (dailies.get(event) ?? 0) + n);
  if (kv()) {
    void kvCmd("INCRBY", `metrics:total:${event}`, String(n)).catch(() => undefined);
    void kvCmd("INCRBY", `metrics:${day}:${event}`, String(n)).catch(() => undefined);
  }
}

export async function metricsSnapshot(): Promise<{
  sharedStore: boolean;
  today: string;
  total: Record<string, number>;
  todayCounts: Record<string, number>;
}> {
  const day = today();
  const total: Record<string, number> = {};
  const todayCounts: Record<string, number> = {};
  for (const event of METRIC_EVENTS) {
    total[event] = totals.get(event) ?? 0;
    todayCounts[event] = dailies.get(event) ?? 0;
  }
  if (kv()) {
    try {
      for (const event of METRIC_EVENTS) {
        const t = Number(await kvCmd("GET", `metrics:total:${event}`)) || 0;
        const d = Number(await kvCmd("GET", `metrics:${day}:${event}`)) || 0;
        total[event] = Math.max(total[event], t);
        todayCounts[event] = Math.max(todayCounts[event], d);
      }
    } catch {
      // local view
    }
  }
  return { sharedStore: Boolean(kv()), today: day, total, todayCounts };
}
