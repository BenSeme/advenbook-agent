// Real per-conversation tracking (docs/CONSIGNE_SUIVI.md, 28/10): what
// the agent cost and what it brought in, measurable on 5/11, WITHOUT any
// personal data. One anonymous conversation id (`c_` + 16 letters/digits,
// never a name, email or Strava id), counts and costs only — never the
// content of messages, photos, stories or URLs. Traces live 30 days in
// the shared KV store when configured (same env vars as lib/budget.ts),
// in memory otherwise.
import { AsyncLocalStorage } from "node:async_hooks";
import { randomInt } from "node:crypto";

export const TRACE_TTL_SECONDS = 30 * 24 * 3600;
const MAX_CALLS_KEPT = 200;
const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function newConversationId(): string {
  let suffix = "";
  for (let i = 0; i < 16; i++) suffix += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return `c_${suffix}`;
}

export function isConversationId(v: unknown): v is string {
  return typeof v === "string" && /^c_[A-Za-z0-9]{16}$/.test(v);
}

/** Valid client id, or a fresh server one. A malformed "id" (an email,
 *  a name…) is never stored: it is replaced, not sanitised in place. */
export function resolveConversationId(v: unknown): string {
  return isConversationId(v) ? v : newConversationId();
}

export type UtmSource = { utm_source: string; utm_medium: string; utm_content: string };

function cleanUtmValue(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  // Campaign labels only. Anything with @, spaces or slashes could be
  // personal data (an email, a name) — fail closed to a neutral bucket.
  return /^[A-Za-z0-9._-]{1,40}$/.test(s) ? s : s ? "other" : "";
}

export function sanitizeSource(v: unknown): UtmSource {
  const r = typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
  return {
    utm_source: cleanUtmValue(r.utm_source),
    utm_medium: cleanUtmValue(r.utm_medium),
    utm_content: cleanUtmValue(r.utm_content),
  };
}

const BOOK_LANGS = ["en", "fr", "es", "de", "it", "eu"];

export function sanitizeLanguage(v: unknown): string {
  return typeof v === "string" && BOOK_LANGS.includes(v) ? v : "unknown";
}

// --- Prices (defaults = .env.example; override by env only) -------------

function priceEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

export type ModelKind = "spark_chat" | "spark_vision" | "sam" | "voice";
export const MODEL_KINDS: ModelKind[] = ["spark_chat", "spark_vision", "sam", "voice"];

export type ModelCallInput = {
  kind: ModelKind;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  images?: number;
  audioSeconds?: number;
  durationMs: number;
  /** `true`, or a short code like "http_502". Never an error message:
   *  provider messages can quote user content, traces must not. */
  error?: boolean | string;
};

export function roundUsd(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/** Cost of one model call in USD, from the .env.example prices. */
export function modelCallCost(input: {
  kind: ModelKind;
  inputTokens?: number;
  outputTokens?: number;
  images?: number;
  audioSeconds?: number;
}): number {
  const inTok = Math.max(0, input.inputTokens || 0);
  const outTok = Math.max(0, input.outputTokens || 0);
  if (input.kind === "spark_chat" || input.kind === "spark_vision") {
    const inPrice = priceEnv("SPARK_INPUT_PRICE_PER_MTOK_USD", 1.25);
    const outPrice = priceEnv("SPARK_OUTPUT_PRICE_PER_MTOK_USD", 4.25);
    return roundUsd((inTok * inPrice + outTok * outPrice) / 1_000_000);
  }
  if (input.kind === "sam") {
    // SAM 3.1: $2.50 per 1,000 images by default.
    return roundUsd(Math.max(0, input.images || 0) * priceEnv("SAM_PRICE_PER_IMAGE_USD", 0.0025));
  }
  // Muse Voice Transcribe: $0.18 per audio hour by default.
  return roundUsd(
    (Math.max(0, input.audioSeconds || 0) / 3600) * priceEnv("VOICE_PRICE_PER_AUDIO_HOUR_USD", 0.18),
  );
}

/** Duration in seconds of a standard PCM WAV (header fields only) —
 *  the unit the Voice price is billed on. */
export function wavDurationSeconds(wav: ArrayBuffer): number {
  if (wav.byteLength < 44) return 0;
  const view = new DataView(wav);
  const byteRate = view.getUint32(28, true);
  const dataSize = view.getUint32(40, true);
  if (byteRate <= 0 || dataSize <= 0) return 0;
  return Math.round((dataSize / byteRate) * 10) / 10;
}

/** Mechanically adds the anonymous conversation id to a book write.
 *  Returns args unchanged when there is no valid id. */
export function injectAgentSessionId(
  args: Record<string, unknown>,
  conversationId: unknown,
): Record<string, unknown> {
  return isConversationId(conversationId)
    ? { ...args, agent_session_id: conversationId }
    : args;
}

// --- Trace shape (counts only — this is the whole privacy contract) -----

export const TRACE_STEPS = [
  "strava_connected",
  "existing_book_found",
  "book_created",
  "book_continued",
  "open_click",
  "order_click",
  "visitor_cap_hit",
] as const;
export type TraceStep = (typeof TRACE_STEPS)[number];

export type ModelCallTrace = {
  kind: ModelKind;
  model: string;
  inputTokens: number;
  outputTokens: number;
  images: number;
  audioSeconds: number;
  costUsd: number;
  durationMs: number;
  error: string | null;
};

export type ConversationTrace = {
  id: string;
  date: string; // YYYY-MM-DD, day the conversation started
  language: string;
  source: UtmSource;
  turns: number;
  booksCreated: number;
  booksContinued: number;
  steps: Record<TraceStep, boolean>;
  calls: ModelCallTrace[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    images: number;
    audioSeconds: number;
    costUsd: number;
    costByModel: Record<ModelKind, number>;
    callsByModel: Record<ModelKind, number>;
  };
};

function emptySteps(): Record<TraceStep, boolean> {
  return {
    strava_connected: false,
    existing_book_found: false,
    book_created: false,
    book_continued: false,
    open_click: false,
    order_click: false,
    visitor_cap_hit: false,
  };
}

function zeroModelRecord(): Record<ModelKind, number> {
  return { spark_chat: 0, spark_vision: 0, sam: 0, voice: 0 };
}

function newTrace(id: string, language: unknown, source: unknown): ConversationTrace {
  return {
    id,
    date: new Date().toISOString().slice(0, 10),
    language: sanitizeLanguage(language),
    source: sanitizeSource(source),
    turns: 0,
    booksCreated: 0,
    booksContinued: 0,
    steps: emptySteps(),
    calls: [],
    totals: {
      inputTokens: 0,
      outputTokens: 0,
      images: 0,
      audioSeconds: 0,
      costUsd: 0,
      costByModel: zeroModelRecord(),
      callsByModel: zeroModelRecord(),
    },
  };
}

// --- Conversation context (so lib/models.ts can attribute its calls) ----

const conversationCtx = new AsyncLocalStorage<string>();

export function withConversationContext<T>(id: string, fn: () => Promise<T>): Promise<T> {
  return conversationCtx.run(id, fn);
}

export function currentConversationId(): string | null {
  return conversationCtx.getStore() ?? null;
}

// --- Storage: shared KV when configured, in-memory otherwise ------------

const traces = new Map<string, ConversationTrace>();
const dayIndex = new Map<string, Set<string>>();

function kv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function kvCmd(...parts: string[]): Promise<unknown> {
  const store = kv();
  if (!store) return null;
  const res = await fetch(`${store.url}/${parts.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${store.token}` },
  });
  if (!res.ok) throw new Error(`KV ${res.status}`);
  const data = (await res.json()) as { result?: unknown };
  return data.result;
}

async function loadTrace(id: string): Promise<ConversationTrace | null> {
  const local = traces.get(id);
  if (kv()) {
    try {
      const raw = await kvCmd("GET", `trace:v1:${id}`);
      if (typeof raw === "string" && raw) {
        const parsed = JSON.parse(raw) as ConversationTrace;
        traces.set(id, parsed);
        return parsed;
      }
    } catch {
      // fall back to the in-memory copy
    }
  }
  return local ?? null;
}

async function saveTrace(trace: ConversationTrace): Promise<void> {
  traces.set(trace.id, trace);
  let day = dayIndex.get(trace.date);
  if (!day) {
    day = new Set();
    dayIndex.set(trace.date, day);
  }
  day.add(trace.id);
  if (kv()) {
    try {
      await kvCmd("SET", `trace:v1:${trace.id}`, JSON.stringify(trace), "EX", String(TRACE_TTL_SECONDS));
      await kvCmd("SADD", `trace:v1:day:${trace.date}`, trace.id);
      await kvCmd("EXPIRE", `trace:v1:day:${trace.date}`, String(TRACE_TTL_SECONDS));
    } catch {
      // in-memory copy above still serves this instance
    }
  }
}

// --- Recording (never throws: tracking must not break the product) ------

export async function ensureConversation(input: {
  conversationId?: unknown;
  language?: unknown;
  source?: unknown;
}): Promise<ConversationTrace> {
  const id = resolveConversationId(input.conversationId);
  const existing = await loadTrace(id);
  if (existing) {
    const lang = sanitizeLanguage(input.language);
    if (lang !== "unknown") existing.language = lang;
    await saveTrace(existing);
    return existing;
  }
  const trace = newTrace(id, input.language, input.source);
  await saveTrace(trace);
  return trace;
}

export async function recordTurn(conversationId: unknown): Promise<void> {
  if (!isConversationId(conversationId)) return;
  const trace = (await loadTrace(conversationId)) ?? newTrace(conversationId, undefined, undefined);
  trace.turns += 1;
  await saveTrace(trace);
}

function sanitizeError(error: boolean | string | undefined): string | null {
  if (!error) return null;
  if (typeof error === "string") {
    const status = error.match(/\b(\d{3})\b/);
    return status ? `http_${status[1]}` : "error";
  }
  return "error";
}

function sanitizeModel(kind: ModelKind, model: string | undefined): string {
  return model && /^[A-Za-z0-9._-]{1,60}$/.test(model) ? model : kind;
}

export async function recordModelCall(
  conversationId: string | null,
  input: ModelCallInput,
): Promise<void> {
  try {
    if (!isConversationId(conversationId)) return;
    if (!MODEL_KINDS.includes(input.kind)) return;
    const trace = (await loadTrace(conversationId)) ?? newTrace(conversationId, undefined, undefined);
    // Only the fields below are ever stored. Extra caller fields (a
    // prompt, a transcript, a photo…) are dropped here, by construction.
    const call: ModelCallTrace = {
      kind: input.kind,
      model: sanitizeModel(input.kind, input.model),
      inputTokens: Math.max(0, Math.floor(input.inputTokens || 0)),
      outputTokens: Math.max(0, Math.floor(input.outputTokens || 0)),
      images: Math.max(0, Math.floor(input.images || 0)),
      audioSeconds: Math.max(0, input.audioSeconds || 0),
      costUsd: modelCallCost(input),
      durationMs: Math.max(0, Math.round(input.durationMs || 0)),
      error: sanitizeError(input.error),
    };
    trace.calls.push(call);
    if (trace.calls.length > MAX_CALLS_KEPT) {
      trace.calls.splice(0, trace.calls.length - MAX_CALLS_KEPT);
    }
    trace.totals.inputTokens += call.inputTokens;
    trace.totals.outputTokens += call.outputTokens;
    trace.totals.images += call.images;
    trace.totals.audioSeconds += call.audioSeconds;
    trace.totals.costUsd = roundUsd(trace.totals.costUsd + call.costUsd);
    trace.totals.costByModel[call.kind] = roundUsd(trace.totals.costByModel[call.kind] + call.costUsd);
    trace.totals.callsByModel[call.kind] += 1;
    await saveTrace(trace);
  } catch {
    // tracking is best-effort
  }
}

/** Records a model call for the conversation bound to this async context. */
export async function recordContextModelCall(input: ModelCallInput): Promise<void> {
  await recordModelCall(currentConversationId(), input);
}

export async function recordStep(conversationId: unknown, step: TraceStep): Promise<void> {
  try {
    if (!isConversationId(conversationId)) return;
    if (!(TRACE_STEPS as readonly string[]).includes(step)) return;
    const trace = (await loadTrace(conversationId)) ?? newTrace(conversationId, undefined, undefined);
    trace.steps[step] = true;
    if (step === "book_created") trace.booksCreated += 1;
    if (step === "book_continued") trace.booksContinued += 1;
    await saveTrace(trace);
  } catch {
    // best-effort
  }
}

export async function getConversationTrace(id: string): Promise<ConversationTrace | null> {
  return loadTrace(id);
}

// --- Daily summary for GET /api/metrics ----------------------------------

export type DailySummary = {
  date: string;
  sharedStore: boolean;
  conversations: number;
  conversationsBySource: Record<string, number>;
  funnel: Record<TraceStep, number>;
  totalCostUsd: number;
  costByModel: Record<ModelKind, number>;
  callsByModel: Record<ModelKind, number>;
  totalTurns: number;
  totalTokens: number;
  totalImages: number;
  totalAudioSeconds: number;
  booksCreated: number;
  booksContinued: number;
  costPerConversationUsd: number | null;
  costPerBookCreatedUsd: number | null;
  averageTokensPerConversation: number | null;
  bookConversationIds: string[];
};

export async function dailySummary(date?: string): Promise<DailySummary> {
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const ids = new Set<string>(dayIndex.get(day) ?? []);
  if (kv()) {
    try {
      const members = await kvCmd("SMEMBERS", `trace:v1:day:${day}`);
      if (Array.isArray(members)) for (const m of members) ids.add(String(m));
    } catch {
      // local index only
    }
  }
  const dayTraces: ConversationTrace[] = [];
  for (const id of ids) {
    const trace = await loadTrace(id);
    if (trace && trace.date === day) dayTraces.push(trace);
  }
  const funnel = Object.fromEntries(TRACE_STEPS.map((s) => [s, 0])) as Record<TraceStep, number>;
  const conversationsBySource: Record<string, number> = {};
  const costByModel = zeroModelRecord();
  const callsByModel = zeroModelRecord();
  let totalCost = 0;
  let totalTokens = 0;
  let totalTurns = 0;
  let totalImages = 0;
  let totalAudioSeconds = 0;
  let booksCreated = 0;
  let booksContinued = 0;
  const bookConversationIds: string[] = [];
  for (const trace of dayTraces) {
    const sourceKey = trace.source.utm_source || "direct";
    conversationsBySource[sourceKey] = (conversationsBySource[sourceKey] ?? 0) + 1;
    for (const step of TRACE_STEPS) if (trace.steps[step]) funnel[step] += 1;
    for (const kind of MODEL_KINDS) {
      costByModel[kind] = roundUsd(costByModel[kind] + trace.totals.costByModel[kind]);
      callsByModel[kind] += trace.totals.callsByModel[kind];
    }
    totalCost = roundUsd(totalCost + trace.totals.costUsd);
    totalTokens += trace.totals.inputTokens + trace.totals.outputTokens;
    totalTurns += trace.turns;
    totalImages += trace.totals.images;
    totalAudioSeconds += trace.totals.audioSeconds;
    booksCreated += trace.booksCreated;
    booksContinued += trace.booksContinued;
    if (trace.steps.book_created || trace.steps.book_continued) {
      bookConversationIds.push(trace.id);
    }
  }
  const n = dayTraces.length;
  return {
    date: day,
    sharedStore: Boolean(kv()),
    conversations: n,
    conversationsBySource,
    funnel,
    totalCostUsd: totalCost,
    costByModel,
    callsByModel,
    totalTurns,
    totalTokens,
    totalImages,
    totalAudioSeconds: Math.round(totalAudioSeconds * 10) / 10,
    booksCreated,
    booksContinued,
    costPerConversationUsd: n > 0 ? roundUsd(totalCost / n) : null,
    costPerBookCreatedUsd: booksCreated > 0 ? roundUsd(totalCost / booksCreated) : null,
    averageTokensPerConversation: n > 0 ? Math.round(totalTokens / n) : null,
    bookConversationIds: bookConversationIds.sort(),
  };
}
