// Daily LLM token budget. Shared across instances when a KV/Upstash
// REST store is configured (KV_REST_API_URL + KV_REST_API_TOKEN, or
// UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN); otherwise an
// in-memory counter (resets on restart — fine for a single instance).
//
// Two layers, like production AI products: a generous GLOBAL daily cap
// (the hard ceiling on total spend) and a per-VISITOR daily cap (one bot
// can only ever burn its own small slice, never the whole budget).
import { AsyncLocalStorage } from "node:async_hooks";
import { alertBudgetIfNeeded } from "./monitor.ts";

let dayKey = "";
let usedTokens = 0;
const visitorTokens = new Map<string, number>();
const verifiedVisitors = new Set<string>();
const kvExpireSent = new Set<string>();

type VisitorCtx = { visitorId: string };
const visitorCtx = new AsyncLocalStorage<VisitorCtx>();

/** Runs fn with token usage attributed to this visitor (chat route). */
export function withVisitorContext<T>(visitorId: string, fn: () => Promise<T>): Promise<T> {
  return visitorCtx.run({ visitorId }, fn);
}

export function visitorDailyCap(trusted: boolean): number {
  const raw = Number(process.env.VISITOR_DAILY_TOKEN_BUDGET);
  const base = Number.isFinite(raw) && raw > 0 ? raw : 250_000;
  // Trusted = Strava connected (an AdvenBook account exists) or a human
  // check passed: same person, anchored identity, 5x the anonymous slice.
  return trusted ? base * 5 : base;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function roll(): void {
  const t = today();
  if (t !== dayKey) {
    dayKey = t;
    usedTokens = 0;
    visitorTokens.clear();
    verifiedVisitors.clear();
    kvExpireSent.clear();
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
  alertBudgetIfNeeded(usedTokens, dailyBudget());
  const visitorId = visitorCtx.getStore()?.visitorId;
  if (visitorId && total > 0) {
    visitorTokens.set(visitorId, (visitorTokens.get(visitorId) ?? 0) + total);
  }
  if (kv() && total > 0) {
    void kvCmd("INCRBY", `budget:${today()}`, String(total)).catch(() => undefined);
    if (visitorId) {
      const key = `visitor:${today()}:${visitorId}`;
      void kvCmd("INCRBY", key, String(total))
        .then(() => {
          if (!kvExpireSent.has(key)) {
            kvExpireSent.add(key);
            return kvCmd("EXPIRE", key, "172800");
          }
        })
        .catch(() => undefined);
    }
  }
}

/** Today's token usage of one visitor (shared store when configured). */
export async function visitorTokensUsed(visitorId: string): Promise<number> {
  roll();
  let local = visitorTokens.get(visitorId) ?? 0;
  if (kv()) {
    try {
      const shared = Number(await kvCmd("GET", `visitor:${today()}:${visitorId}`)) || 0;
      if (shared > local) {
        visitorTokens.set(visitorId, shared);
        local = shared;
      }
    } catch {
      // local view only
    }
  }
  return local;
}

export async function overVisitorBudget(visitorId: string, trusted: boolean): Promise<boolean> {
  return (await visitorTokensUsed(visitorId)) >= visitorDailyCap(trusted);
}

export async function markVisitorVerified(visitorId: string): Promise<void> {
  verifiedVisitors.add(visitorId);
  if (kv()) {
    try {
      await kvCmd("SET", `verified:${today()}:${visitorId}`, "1", "EX", "86400");
    } catch {
      // memory mark above still applies on this instance
    }
  }
}

export async function isVisitorVerified(visitorId: string): Promise<boolean> {
  if (verifiedVisitors.has(visitorId)) return true;
  if (kv()) {
    try {
      const v = await kvCmd("GET", `verified:${today()}:${visitorId}`);
      if (v) {
        verifiedVisitors.add(visitorId);
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
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
