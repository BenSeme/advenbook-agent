import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkVolumes, filterToConfirmed } from "../lib/selection.ts";

const acts = [
  { title: "A", strava_activity_id: "1" },
  { title: "B", strava_activity_id: "2" },
  { title: "C", strava_activity_id: "3" },
  { title: "Tapée", date: "2026-01-01" },
];

test("creation keeps exactly the confirmed outings", () => {
  const out = filterToConfirmed(acts, ["1", "3"]);
  assert.deepEqual(
    out.map((a) => a.title),
    ["A", "C", "Tapée"],
  );
});

test("volumes split chronologically at the live maximum", () => {
  const items = Array.from({ length: 170 }, (_, i) => i + 1);
  const chunks = chunkVolumes(items, 150);
  assert.deepEqual(chunks.map((c) => c.length), [150, 20]);
  assert.equal(chunks[1][0], 151);
  assert.deepEqual(chunkVolumes([1, 2], 150), [[1, 2]]);
});

test("no confirmation list = no filtering", () => {
  assert.equal(filterToConfirmed(acts, undefined).length, 4);
  assert.equal(filterToConfirmed(acts, []).length, 4);
});
