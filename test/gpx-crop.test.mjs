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
