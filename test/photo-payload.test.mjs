import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BODY_BYTES,
  MAX_PHOTO_DIM,
  QUALITY_LADDER,
  batchImagesBySize,
  dataUrlSize,
  errorKeyForStatus,
  fitsBody,
  blobPathnameFor,
  chunkItems,
  parseJsonText,
  pendingPhotosInstruction,
  pickFittingCandidate,
} from "../lib/photo-payload.ts";

const img = (id, size) => ({ id, dataUrl: "x".repeat(size) });

test("size constants match the brief (2400px, <3MB, quality ladder)", () => {
  assert.equal(MAX_PHOTO_DIM, 2400);
  assert.ok(MAX_BODY_BYTES <= 3 * 1024 * 1024);
  assert.equal(QUALITY_LADDER[0], 0.85);
  assert.ok(QUALITY_LADDER.includes(0.75) && QUALITY_LADDER.includes(0.65));
  for (let i = 1; i < QUALITY_LADDER.length; i++) {
    assert.ok(QUALITY_LADDER[i] < QUALITY_LADDER[i - 1]);
  }
});

test("batchImagesBySize keeps every batch under the budget", () => {
  const images = [img("a", 1000), img("b", 1000), img("c", 1000), img("d", 500)];
  const batches = batchImagesBySize(images, 2600, 100);
  // 2 per batch max: 2*(1000+100)=2200, a third would be 3300 > 2600
  assert.deepEqual(batches.map((b) => b.map((i) => i.id)), [["a", "b"], ["c", "d"]]);
  for (const b of batches) {
    const total = b.reduce((n, i) => n + dataUrlSize(i.dataUrl) + 100, 0);
    assert.ok(total <= 2600);
  }
});

test("batchImagesBySize isolates a single oversized image", () => {
  const batches = batchImagesBySize([img("big", 5000), img("s", 100)], 1000, 0);
  assert.deepEqual(batches.map((b) => b.map((i) => i.id)), [["big"], ["s"]]);
  assert.deepEqual(batchImagesBySize([], 1000), []);
});

test("fitsBody and pickFittingCandidate pick the first fitting quality", () => {
  assert.ok(fitsBody(100, 100));
  assert.ok(!fitsBody(101, 100));
  const candidates = [
    { quality: 0.85, dataUrl: "x".repeat(500) },
    { quality: 0.75, dataUrl: "x".repeat(90) },
    { quality: 0.65, dataUrl: "x".repeat(50) },
  ];
  assert.equal(pickFittingCandidate(candidates, 100).quality, 0.75);
  // none fits: fall back to the smallest (last) candidate
  assert.equal(pickFittingCandidate(candidates, 10).quality, 0.65);
});

test("chunkItems batches select calls at the server cap, losing none", () => {
  const items = Array.from({ length: 25 }, (_, i) => i);
  const chunks = chunkItems(items, 12);
  assert.deepEqual(chunks.map((c) => c.length), [12, 12, 1]);
  assert.deepEqual(chunks.flat(), items);
  assert.deepEqual(chunkItems([], 12), []);
});

test("blobPathnameFor is safe, unique per photo and keeps the extension", () => {
  assert.equal(blobPathnameFor("abc-123", "Mon Été 2026.JPEG"), "advenbook/originals/abc-123-Mon-Ete-2026.jpeg");
  assert.match(blobPathnameFor("x", "../../evil.png"), /^advenbook\/originals\/x-evil\.png$/);
  assert.match(blobPathnameFor("x", "noext"), /-noext\.jpg$/);
});

test("pendingPhotosInstruction only fires when photos are waiting", () => {
  assert.equal(pendingPhotosInstruction(0), null);
  assert.equal(pendingPhotosInstruction(undefined), null);
  const line = pendingPhotosInstruction(3);
  assert.match(line, /3 photo\(s\) are waiting/);
  assert.match(line, /Use these photos in the book/);
  assert.match(line, /NEVER say you don't see any photo/);
});

test("parseJsonText never throws on plain-text error bodies", () => {
  assert.deepEqual(parseJsonText("Request Entity Too Large"), { ok: false });
  assert.deepEqual(parseJsonText('{"url":"https://x/y.jpg"}'), {
    ok: true,
    value: { url: "https://x/y.jpg" },
  });
  assert.equal(errorKeyForStatus(413), "photoTooLarge");
  assert.equal(errorKeyForStatus(502), "invalidResponse");
});
