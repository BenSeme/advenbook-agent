// Per-IP sliding-window limiter. Uses the shared KV store when
// configured (same env vars as lib/budget.ts), else in-memory buckets.
const buckets = new Map<string, number[]>();

function kv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export async function rateLimited(
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const store = kv();
  if (store) {
    try {
      const windowStart = Math.floor(Date.now() / windowMs);
      const k = `rl:${key}:${windowStart}`;
      const res = await fetch(
        `${store.url}/INCR/${encodeURIComponent(k)}`,
        { headers: { Authorization: `Bearer ${store.token}` } },
      );
      const data = (await res.json()) as { result?: number };
      const count = Number(data.result) || 0;
      if (count === 1) {
        void fetch(`${store.url}/EXPIRE/${encodeURIComponent(k)}/${Math.ceil(windowMs / 1000)}`, {
          headers: { Authorization: `Bearer ${store.token}` },
        }).catch(() => undefined);
      }
      return count > max;
    } catch {
      // fall through to the in-memory limiter
    }
  }
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);
  return false;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}
