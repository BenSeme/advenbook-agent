// Anonymous visitor identity: a signed, httpOnly cookie. No account, no
// password, no personal data — just a random id that lets the server cap
// API spend per visitor (see lib/budget.ts). A real identity only appears
// at value moments: Strava connect (AdvenBook account via Strava) or the
// orderUrl checkout (one-click AdvenBook account + Stripe).
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export const VISITOR_COOKIE = "ab-vid";

let fallbackSecret: string | null = null;

function secret(): string {
  const configured =
    process.env.VISITOR_COOKIE_SECRET ?? process.env.MODEL_API_KEY;
  if (configured) return configured;
  // Local/dev fallback: cookies simply stop verifying after a restart.
  fallbackSecret ??= randomBytes(32).toString("hex");
  return fallbackSecret;
}

function sign(id: string): string {
  return createHmac("sha256", secret()).update(id).digest("base64url");
}

export function signedVisitorValue(id: string): string {
  return `${id}.${sign(id)}`;
}

/** Returns the verified visitor id from the cookie, or null. */
export function visitorIdFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const raw = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${VISITOR_COOKIE}=`))
    ?.slice(VISITOR_COOKIE.length + 1);
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? id : null;
}

/** Existing verified id, or a fresh one (isNew → set the cookie). */
export function getOrCreateVisitor(req: Request): { id: string; isNew: boolean } {
  const existing = visitorIdFromCookieHeader(req.headers.get("cookie"));
  if (existing) return { id: existing, isNew: false };
  return { id: randomUUID(), isNew: true };
}
