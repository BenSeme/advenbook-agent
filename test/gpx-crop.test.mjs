import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGpx, encodePolyline } from "../lib/gpx.ts";
import { computeCrop } from "../lib/crop.ts";

const GPX = `<?xml version="1.0"?>
<gpx><trk><name>Col du Test</name><trkseg>
<trkpt lat="45.0000" lon="6.0000"><ele>1000</ele><time>2026-07-14T08:00:00Z</time></trkpt>
<trkpt lat="45.0100" lon="6.0000"><ele>1200</ele><time>2026-07-14T08:30:00Z</time></trkpt>
<trkpt lat="45.0200" lon="6.0000"><ele>1500</ele><time>2026-07-14T09:00:00Z</time></trkpt>
</trkseg></trk></gpx>`;

test("parseGpx extracts title, date, distance, gain, polyline", () => {
  const a = parseGpx(GPX);
  assert.equal(a.title, "Col du Test");
  assert.equal(a.date, "2026-07-14");
  assert.ok(a.distanceKm > 2 && a.distanceKm < 2.5, `distance ${a.distanceKm}`);
  assert.equal(a.elevationGainM, 500);
  assert.equal(a.duration, "1h00min00s");
  assert.ok(a.polyline.length > 5);
});

test("encodePolyline matches the known Google example", () => {
  const pts = [
    { lat: 38.5, lon: -120.2 },
    { lat: 40.7, lon: -120.95 },
    { lat: 43.252, lon: -126.453 },
  ];
  assert.equal(encodePolyline(pts), "_p~iF~ps|U_ulLnnqC_mqNvxq`@");
});

test("computeCrop contains the subject and respects ratio", () => {
  const r = computeCrop({ x1: 400, y1: 300, x2: 600, y2: 700 }, 1000, 1000, 1.5);
  assert.ok(r.left <= 400 && r.left + r.width >= 600, "subject width inside");
  assert.ok(r.top <= 300 && r.top + r.height >= 700, "subject height inside");
  assert.ok(Math.abs(r.width / r.height - 1.5) < 0.02, "ratio 3:2");
});

test("computeCrop without a box crops the centre", () => {
  const r = computeCrop(null, 1200, 800, 1.5);
  assert.equal(r.left + r.width / 2, 600);
});

test("computeCrop always stays inside the image (2048x1365 regression, 4/11)", () => {
  const sizes = [[2048, 1365], [4032, 3024], [3024, 4032], [1365, 2048], [1000, 667], [801, 533]];
  const boxes = [null, { x1: 0, y1: 0, x2: 50, y2: 50 }, { x1: 1900, y1: 1200, x2: 2048, y2: 1365 }, { x1: 400, y1: 300, x2: 900, y2: 1100 }];
  for (const [w, h] of sizes) {
    for (const b of boxes) {
      const r = computeCrop(b, w, h, 1.5);
      assert.ok(r.left >= 0 && r.top >= 0, `${w}x${h} negative origin`);
      assert.ok(r.left + r.width <= w, `${w}x${h} overflows width: ${JSON.stringify(r)}`);
      assert.ok(r.top + r.height <= h, `${w}x${h} overflows height: ${JSON.stringify(r)}`);
      assert.ok(Number.isInteger(r.left) && Number.isInteger(r.width), "whole pixels");
    }
  }
});
