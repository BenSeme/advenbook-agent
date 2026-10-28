import { test } from "node:test";
import assert from "node:assert/strict";

// Local-only view: make sure no shared store leaks into this test.
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { countMetric, metricsSnapshot, METRIC_EVENTS } = await import(
  "../lib/metrics.ts"
);

test("funnel counters accumulate (turns -> books -> order clicks)", async () => {
  countMetric("chat_turn");
  countMetric("chat_turn");
  countMetric("book_created");
  countMetric("order_click");
  const snap = await metricsSnapshot();
  assert.equal(snap.sharedStore, false);
  assert.equal(snap.total.chat_turn, 2);
  assert.equal(snap.total.book_created, 1);
  assert.equal(snap.total.order_click, 1);
  assert.equal(snap.todayCounts.chat_turn, 2);
  for (const e of METRIC_EVENTS) assert.ok(e in snap.total);
});
