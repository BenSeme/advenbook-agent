// CONSIGNE_SUIVI (28/10): cost calculation, per-conversation traces in
// the shared store, and the absence of personal data in the traces.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Local-only view unless a test says otherwise.
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.SPARK_INPUT_PRICE_PER_MTOK_USD;
delete process.env.SPARK_OUTPUT_PRICE_PER_MTOK_USD;
delete process.env.SAM_PRICE_PER_IMAGE_USD;
delete process.env.VOICE_PRICE_PER_AUDIO_HOUR_USD;

const tracking = await import("../lib/tracking.ts");
const {
  modelCallCost,
  newConversationId,
  isConversationId,
  resolveConversationId,
  injectAgentSessionId,
  ensureConversation,
  recordTurn,
  recordModelCall,
  recordStep,
  getConversationTrace,
  dailySummary,
} = tracking;
const { wavDurationSeconds } = tracking;
const { encodeWav } = await import("../lib/voice.ts");

const ID = "c_AAAAAAAAAAAAAAAA"; // c_ + 16 chars

test("cost calculation from the .env.example prices", () => {
  // Spark: $1.25 / 1M input, $4.25 / 1M output.
  assert.equal(modelCallCost({ kind: "spark_chat", inputTokens: 1_000_000, outputTokens: 0 }), 1.25);
  assert.equal(modelCallCost({ kind: "spark_chat", inputTokens: 0, outputTokens: 1_000_000 }), 4.25);
  assert.equal(modelCallCost({ kind: "spark_chat", inputTokens: 8_000, outputTokens: 1_000 }), 0.01425);
  assert.equal(modelCallCost({ kind: "spark_vision", inputTokens: 8_000, outputTokens: 1_000 }), 0.01425);
  assert.equal(modelCallCost({ kind: "spark_chat", inputTokens: 0, outputTokens: 0 }), 0);
  // SAM 3.1: $2.50 per 1,000 images.
  assert.equal(modelCallCost({ kind: "sam", images: 1 }), 0.0025);
  assert.equal(modelCallCost({ kind: "sam", images: 4 }), 0.01);
  assert.equal(modelCallCost({ kind: "sam", images: 0 }), 0);
  // Muse Voice Transcribe: $0.18 per audio hour.
  assert.equal(modelCallCost({ kind: "voice", audioSeconds: 3600 }), 0.18);
  assert.equal(modelCallCost({ kind: "voice", audioSeconds: 60 }), 0.003);
  assert.equal(modelCallCost({ kind: "voice", audioSeconds: 0 }), 0);
  // Prices stay env-configurable.
  process.env.SPARK_INPUT_PRICE_PER_MTOK_USD = "2";
  try {
    assert.equal(modelCallCost({ kind: "spark_chat", inputTokens: 1_000_000, outputTokens: 0 }), 2);
  } finally {
    delete process.env.SPARK_INPUT_PRICE_PER_MTOK_USD;
  }
});

test("conversation ids are anonymous and validated", () => {
  for (let i = 0; i < 50; i++) assert.ok(isConversationId(newConversationId()));
  assert.ok(isConversationId(ID));
  assert.ok(!isConversationId("alice@example.com"));
  assert.ok(!isConversationId("c_short"));
  assert.ok(!isConversationId("1234567890-strava-id"));
  const resolved = resolveConversationId("alice@example.com");
  assert.ok(isConversationId(resolved));
  assert.ok(!resolved.includes("@"));
  assert.equal(resolveConversationId(ID), ID);
});

test("agent_session_id injection only for valid ids", () => {
  assert.deepEqual(injectAgentSessionId({ title: "X" }, ID), {
    title: "X",
    agent_session_id: ID,
  });
  const untouched = injectAgentSessionId({ title: "X" }, "alice@example.com");
  assert.ok(!("agent_session_id" in untouched));
  assert.ok(!("agent_session_id" in injectAgentSessionId({ title: "X" }, undefined)));
});

test("WAV duration drives the voice cost input", () => {
  const oneSecond = encodeWav(new Float32Array(16000), 16000);
  assert.equal(wavDurationSeconds(oneSecond), 1);
  assert.equal(wavDurationSeconds(new ArrayBuffer(10)), 0);
});

test("trace aggregates turns, calls, steps — and holds no personal data", async () => {
  const trace = await ensureConversation({
    conversationId: ID,
    language: "fr",
    source: {
      utm_source: "alice@example.com",
      utm_medium: "Mes Pyrénées en famille",
      utm_content: "bubble",
    },
  });
  assert.equal(trace.language, "fr");
  // UTM values that could be personal data fail closed to a neutral bucket.
  assert.equal(trace.source.utm_source, "other");
  assert.equal(trace.source.utm_medium, "other");
  assert.equal(trace.source.utm_content, "bubble");

  await recordTurn(ID);
  await recordTurn(ID);
  await recordModelCall(ID, {
    kind: "spark_chat",
    model: "muse-spark-1.3",
    inputTokens: 8000,
    outputTokens: 1000,
    durationMs: 123,
    // Extra fields a careless caller might pass must never be stored.
    prompt: "SECRET_PROMPT alice@example.com Tourmalet avec Marie",
    transcript: "SECRET_TRANSCRIPT",
    photo: "data:image/jpeg;base64,SECRET",
  });
  await recordModelCall(ID, {
    kind: "sam",
    model: "sam-3.1",
    images: 2,
    durationMs: 50,
    error: "SAM API 502: failed for alice@example.com",
  });
  await recordModelCall(ID, { kind: "voice", model: "muse-voice-transcribe-1.0", audioSeconds: 60, durationMs: 900 });
  await recordStep(ID, "strava_connected");
  await recordStep(ID, "book_created");
  await recordStep(ID, "open_click");

  const stored = await getConversationTrace(ID);
  assert.equal(stored.turns, 2);
  assert.equal(stored.booksCreated, 1);
  assert.equal(stored.calls.length, 3);
  assert.deepEqual(
    Object.keys(stored.calls[0]).sort(),
    ["audioSeconds", "costUsd", "durationMs", "error", "images", "inputTokens", "kind", "model", "outputTokens"],
  );
  // Error is a short code, never the provider message.
  assert.equal(stored.calls[1].error, "http_502");
  // 0.01425 (spark) + 0.005 (2 SAM images) + 0.003 (60 s voice).
  assert.equal(stored.totals.costUsd, 0.02225);
  assert.equal(stored.totals.costByModel.spark_chat, 0.01425);
  assert.equal(stored.totals.costByModel.sam, 0.005);
  assert.equal(stored.totals.costByModel.voice, 0.003);
  assert.equal(stored.totals.inputTokens + stored.totals.outputTokens, 9000);

  const serialised = JSON.stringify(stored);
  for (const secret of [
    "alice@example.com",
    "SECRET_PROMPT",
    "SECRET_TRANSCRIPT",
    "SECRET",
    "Tourmalet avec Marie",
    "Pyrénées en famille",
    "strava_activity_id",
    "connection_id",
    "claimUrl",
    "photo_urls",
  ]) {
    assert.ok(!serialised.includes(secret), `trace must not contain: ${secret}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const daily = await dailySummary(today);
  assert.equal(daily.conversations, 1);
  assert.deepEqual(daily.conversationsBySource, { other: 1 });
  assert.equal(daily.funnel.strava_connected, 1);
  assert.equal(daily.funnel.book_created, 1);
  assert.equal(daily.funnel.open_click, 1);
  assert.equal(daily.funnel.order_click, 0);
  assert.equal(daily.totalCostUsd, 0.02225);
  assert.equal(daily.costPerConversationUsd, 0.02225);
  assert.equal(daily.costPerBookCreatedUsd, 0.02225);
  assert.equal(daily.averageTokensPerConversation, 9000);
  assert.deepEqual(daily.bookConversationIds, [ID]);
  assert.ok(!JSON.stringify(daily).includes("alice@example.com"));
});

test("invalid ids and steps are ignored, never stored", async () => {
  await recordTurn("alice@example.com");
  await recordModelCall("not-an-id", { kind: "spark_chat", inputTokens: 5, durationMs: 1 });
  await recordStep(ID, "not_a_step");
  const stored = await getConversationTrace(ID);
  assert.equal(stored.turns, 2, "unchanged by the invalid-id calls above");
});

// --- Shared-store proof: a second process must see the first one's trace.
const exec = promisify(execFile);
const kvStore = new Map();
let kvServer;
let kvUrl;
let tmp;

function kvHandler(req, res) {
  const parts = decodeURIComponent(req.url).split("/").filter(Boolean);
  const [cmd, key, a, b] = parts;
  let result = null;
  if (cmd === "GET") result = kvStore.get(key) ?? null;
  if (cmd === "SET") {
    kvStore.set(key, a);
    result = "OK";
  }
  if (cmd === "SADD") {
    const set = kvStore.get(key) ?? new Set();
    set.add(a);
    kvStore.set(key, set);
    result = 1;
  }
  if (cmd === "SMEMBERS") result = [...(kvStore.get(key) ?? [])];
  if (cmd === "EXPIRE") result = 1;
  void b;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ result: Array.isArray(result) ? result : result }));
}

before(async () => {
  tmp = mkdtempSync(join(process.cwd(), ".tracking-proof-"));
  kvServer = createServer(kvHandler);
  await new Promise((r) => kvServer.listen(0, "127.0.0.1", r));
  kvUrl = `http://127.0.0.1:${kvServer.address().port}`;
});

after(() => {
  kvServer?.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

test("two instances share conversation traces through KV (30-day keys)", async () => {
  const trackingUrl = pathToFileURL(join(process.cwd(), "lib", "tracking.ts")).href;
  const child = join(tmp, "child.mjs");
  const env = {
    ...process.env,
    KV_REST_API_URL: kvUrl,
    KV_REST_API_TOKEN: "test-token",
  };
  delete env.UPSTASH_REDIS_REST_URL;
  delete env.UPSTASH_REDIS_REST_TOKEN;

  writeFileSync(
    child,
    `import { ensureConversation, recordTurn, recordModelCall, recordStep } from ${JSON.stringify(trackingUrl)};\n` +
      `await ensureConversation({ conversationId: "c_BBBBBBBBBBBBBBBB", language: "en", source: { utm_source: "bubble" } });\n` +
      `await recordTurn("c_BBBBBBBBBBBBBBBB");\n` +
      `await recordModelCall("c_BBBBBBBBBBBBBBBB", { kind: "spark_chat", inputTokens: 1000, outputTokens: 0, durationMs: 10 });\n` +
      `await recordStep("c_BBBBBBBBBBBBBBBB", "book_created");\n` +
      `console.log("A_DONE");\n`,
  );
  const a = await exec(process.execPath, [child], { env });
  assert.ok(a.stdout.includes("A_DONE"), a.stdout);

  writeFileSync(
    child,
    `import { dailySummary } from ${JSON.stringify(trackingUrl)};\n` +
      `const daily = await dailySummary();\n` +
      `console.log(JSON.stringify(daily));\n`,
  );
  const b = await exec(process.execPath, [child], { env });
  const daily = JSON.parse(b.stdout.trim().split("\n").pop());
  assert.equal(daily.sharedStore, true);
  assert.equal(daily.conversations, 1);
  assert.deepEqual(daily.conversationsBySource, { bubble: 1 });
  assert.equal(daily.totalCostUsd, 0.00125);
  assert.deepEqual(daily.bookConversationIds, ["c_BBBBBBBBBBBBBBBB"]);
  // The trace itself is stored under a key with the 30-day TTL command path.
  assert.ok(kvStore.has("trace:v1:c_BBBBBBBBBBBBBBBB"));
});
