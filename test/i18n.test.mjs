import { test } from "node:test";
import assert from "node:assert/strict";
import { t, LANGS, detectLangFromText, detectDevice, fmtDistance, fmtElevation, fmtPrice } from "../lib/i18n.ts";

test("every language has a Send label", () => {
  for (const l of LANGS) assert.ok(t(l, "send").length > 1);
});

test("language detection from user text", () => {
  assert.equal(detectLangFromText("Je veux un livre de mon été avec mes sorties"), "fr");
  assert.equal(detectLangFromText("I want a book of my summer with my runs"), "en");
  assert.equal(detectLangFromText("Quiero un libro de mi verano con mis carreras"), "es");
  assert.equal(detectLangFromText("Voglio un libro della mia estate con le mie corse"), "it");
});

test("device detection from user agent", () => {
  assert.equal(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), "iphone");
  assert.equal(detectDevice("Mozilla/5.0 (Linux; Android 13; Pixel 7)"), "android");
  assert.equal(detectDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "desktop");
  for (const l of LANGS) assert.ok(t(l, "netError").length > 10);
});

test("american units and currency, european otherwise", () => {
  assert.equal(fmtDistance(10, "en"), "6.2 mi");
  assert.equal(fmtDistance(10, "fr"), "10 km");
  assert.equal(fmtElevation(1000, "en"), "3281 ft");
  assert.match(fmtPrice({ usd: "49.00 USD", eur: "45,00 €" }, "en"), /USD/);
  assert.match(fmtPrice({ usd: "49.00 USD", eur: "45,00 €" }, "fr"), /€/);
});
