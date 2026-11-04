import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTcx } from "../lib/gpx.ts";
import { parseKomootUrl, komootTourToActivity, komootCoverUrls } from "../lib/komoot.ts";

const TCX = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase><Activities>
<Activity Sport="Running"><Id>2026-07-14T08:00:00.000Z</Id>
<Lap StartTime="2026-07-14T08:00:00.000Z"><Track>
<Trackpoint><Time>2026-07-14T08:00:00.000Z</Time><Position><LatitudeDegrees>45.0000</LatitudeDegrees><LongitudeDegrees>6.0000</LongitudeDegrees></Position><AltitudeMeters>1000</AltitudeMeters></Trackpoint>
<Trackpoint><Time>2026-07-14T08:30:00.000Z</Time><Position><LatitudeDegrees>45.0100</LatitudeDegrees><LongitudeDegrees>6.0000</LongitudeDegrees></Position><AltitudeMeters>1200</AltitudeMeters></Trackpoint>
<Trackpoint><Time>2026-07-14T09:00:00.000Z</Time><Position><LatitudeDegrees>45.0200</LatitudeDegrees><LongitudeDegrees>6.0000</LongitudeDegrees></Position><AltitudeMeters>1500</AltitudeMeters></Trackpoint>
</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;

test("parseTcx extracts date, distance, gain, duration, sport, polyline", () => {
  const a = parseTcx(TCX);
  assert.equal(a.date, "2026-07-14");
  assert.equal(a.sport, "Running");
  assert.ok(a.distanceKm > 2 && a.distanceKm < 2.5, `distance ${a.distanceKm}`);
  assert.equal(a.elevationGainM, 500);
  assert.equal(a.duration, "1h00min00s");
  assert.equal(a.pointCount, 3);
  assert.ok(a.polyline.length > 5);
});

test("parseTcx rejects a file without trackpoints", () => {
  assert.throws(() => parseTcx("<TrainingCenterDatabase/>"), /Trackpoint/);
});

test("parseKomootUrl recognises tour, share and profile links", () => {
  assert.deepEqual(parseKomootUrl("https://www.komoot.com/tour/123456"), {
    type: "tour",
    id: "123456",
  });
  assert.deepEqual(parseKomootUrl("https://www.komoot.de/tour/123?share_token=abcXYZ"), {
    type: "tour",
    id: "123",
    shareToken: "abcXYZ",
  });
  assert.deepEqual(parseKomootUrl("https://www.komoot.com/user/98765"), {
    type: "profile",
    userId: "98765",
  });
  assert.equal(parseKomootUrl("https://example.com/tour/1"), null);
  assert.equal(parseKomootUrl("not a link"), null);
});

test("komootTourToActivity maps top-level fields and coordinates", () => {
  const tour = {
    id: 42,
    name: "Lac Blanc",
    date: "2026-08-01T07:00:00.000Z",
    sport: "hike",
    distance: 12500,
    elevation_up: 900,
    duration: 7200,
  };
  const coords = [
    { lat: 45.98, lng: 6.88, alt: 1800, t: 0 },
    { lat: 45.99, lng: 6.89, alt: 2350, t: 3600000 },
    { lat: 46.0, lng: 6.9, alt: 2500, t: 7200000 },
  ];
  const a = komootTourToActivity(tour, coords, ["https://img/1.jpg"]);
  assert.equal(a.title, "Lac Blanc");
  assert.equal(a.date, "2026-08-01");
  assert.equal(a.distanceKm, 12.5);
  assert.equal(a.elevationGainM, 900);
  assert.equal(a.duration, "2h00min00s");
  assert.equal(a.sport, "hike");
  assert.equal(a.source, "other");
  assert.deepEqual(a.photoUrls, ["https://img/1.jpg"]);
  assert.ok(a.polyline.length > 5);
});

test("komootCoverUrls expands the size template and caps at 20", () => {
  const items = Array.from({ length: 25 }, (_, i) => ({
    src: `https://img/${i}.jpg?width={width}&height={height}&crop={crop}`,
  }));
  const urls = komootCoverUrls(items);
  assert.equal(urls.length, 20);
  assert.equal(urls[0], "https://img/0.jpg?width=1600&height=1600&crop=false");
});
