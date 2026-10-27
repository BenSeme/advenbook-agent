import { test } from "node:test";
import assert from "node:assert/strict";
import { activityBadges, isHighlight } from "../lib/highlights.ts";

test("race with photos and climb is a highlight with badges", () => {
  const a = {
    title: "UTMB",
    date: "2026-08-28",
    photos: 12,
    is_race: true,
    has_route: true,
    elevation_gain_m: 10000,
    distance_km: 171,
  };
  assert.equal(isHighlight(a), true);
  assert.ok(activityBadges(a).includes("12 photos"));
  assert.ok(activityBadges(a).includes("Course officielle"));
  assert.ok(activityBadges(a).includes("Beau tracé"));
});

test("plain short outing is not a highlight", () => {
  const a = { title: "Footing", date: "2026-08-28", distance_km: 8, photos: 0 };
  assert.equal(isHighlight(a), false);
  assert.deepEqual(activityBadges(a), []);
});

test("photo-rich outing alone counts as highlight", () => {
  const a = { title: "Lac d'altitude", date: "2026-07-01", photos: 6 };
  assert.equal(isHighlight(a), true);
});
