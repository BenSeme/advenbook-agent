import { test } from "node:test";
import assert from "node:assert/strict";
import { mapPool } from "../lib/promise-pool.ts";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

test("mapPool preserves input order despite varying completion times", async () => {
  const out = await mapPool([30, 10, 20, 0], 4, async (ms, i) => {
    await delay(ms);
    return i * 10;
  });
  assert.deepEqual(out, [0, 10, 20, 30]);
});

test("mapPool never exceeds the concurrency limit", async () => {
  let active = 0;
  let peak = 0;
  const items = Array.from({ length: 12 }, (_, i) => i);
  const out = await mapPool(items, 4, async (i) => {
    active++;
    peak = Math.max(peak, active);
    await delay(10);
    active--;
    return i * 2;
  });
  assert.deepEqual(out, items.map((i) => i * 2));
  assert.equal(peak, 4);
});

test("mapPool with limit 1 runs sequentially", async () => {
  const order = [];
  await mapPool([1, 2, 3], 1, async (i) => {
    order.push(`start${i}`);
    await delay(5);
    order.push(`end${i}`);
    return i;
  });
  assert.deepEqual(order, ["start1", "end1", "start2", "end2", "start3", "end3"]);
});

test("mapPool handles empty input and limit larger than input", async () => {
  assert.deepEqual(await mapPool([], 4, async (x) => x), []);
  assert.deepEqual(await mapPool([1, 2], 99, async (x) => x + 1), [2, 3]);
});

test("mapPool propagates a worker error", async () => {
  await assert.rejects(
    mapPool([1, 2, 3], 2, async (i) => {
      if (i === 2) throw new Error("boom");
      return i;
    }),
    /boom/,
  );
});
