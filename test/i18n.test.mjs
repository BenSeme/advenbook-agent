import { test } from "node:test";
import assert from "node:assert/strict";
import { t, LANGS, DICT_KEYS, detectLangFromText, detectDevice, fmtDistance, fmtElevation, fmtPrice } from "../lib/i18n.ts";

test("every dict key exists and is non-empty in all 6 languages", () => {
  assert.ok(DICT_KEYS.length > 50);
  for (const key of DICT_KEYS) {
    for (const l of LANGS) {
      const v = t(l, key);
      assert.ok(typeof v === "string" && v.length > 0, `${key} missing in ${l}`);
    }
  }
});

test("photo-flow keys are translated in every language", () => {
  for (const l of LANGS) {
    assert.ok(t(l, "photoTooLarge").length > 5, l);
    assert.ok(t(l, "seeSortPhotos").length > 3, l);
    assert.ok(t(l, "hidePhotos").length > 3, l);
    assert.ok(t(l, "photosReadySkipped").includes("{ready}"), l);
    assert.ok(t(l, "photosReadySkipped").includes("{skipped}"), l);
    assert.ok(t(l, "foundTracksPhotos").includes("{tracks}"), l);
    assert.ok(t(l, "komootFound").includes("{n}"), l);
    assert.ok(t(l, "fileReadError").includes("{name}"), l);
  }
  assert.equal(t("en", "seeSortPhotos"), "See and sort photos");
  assert.equal(t("fr", "seeSortPhotos"), "Voir et trier les photos");
  assert.equal(t("en", "hidePhotos"), "Hide photos");
  assert.equal(t("fr", "hidePhotos"), "Masquer les photos");
});

test("every language has a Send label", () => {
  for (const l of LANGS) assert.ok(t(l, "send").length > 1);
});

test("connect card is fully translated in every language", () => {
  for (const l of LANGS) {
    assert.ok(t(l, "connectStep1").includes("{connect}"), l);
    assert.ok(t(l, "connectStep2").length > 20, l);
    assert.ok(t(l, "connectStep3").includes("{connected}"), l);
    assert.ok(t(l, "connectNote").length > 20, l);
    assert.ok(t(l, "copyConnectLink").length > 3, l);
    assert.ok(t(l, "connectCopiedNote").length > 20, l);
  }
  assert.equal(t("fr", "connectedBtn"), "2. C’est connecté — continuer");
  assert.match(t("fr", "connectStep1"), /Cliquez/);
});

test("existing-book card is translated in every language", () => {
  for (const l of LANGS) {
    assert.ok(t(l, "foundBook").includes("{title}"), l);
    assert.ok(t(l, "continueBookBtn").length > 3, l);
    assert.ok(t(l, "newBookBtn").length > 3, l);
    assert.ok(t(l, "coverTitle").length > 5, l);
    assert.ok(t(l, "coverIntro").length > 20, l);
  }
  assert.match(t("fr", "foundBook"), /Je retrouve votre livre/);
});

test("every language has an Order my book label and note", () => {
  for (const l of LANGS) {
    assert.ok(t(l, "orderBook").length > 3, l);
    assert.ok(t(l, "orderNote").length > 20, l);
  }
  assert.equal(t("fr", "orderBook"), "Commander mon livre");
  assert.equal(t("en", "orderBook"), "Order my book");
});

test("selection buttons and confirmation are clear in every language", () => {
  for (const l of LANGS) {
    assert.ok(t(l, "continueSelected").length > 3, l);
    assert.ok(t(l, "skipCreate").length > 3, l);
    assert.ok(t(l, "chooseNextStep").length > 30, l);
    assert.ok(t(l, "tickedByDay").length > 20, l);
    assert.ok(t(l, "selectionConfirmed").includes("{n}"), l);
    assert.ok(t(l, "directCreateConfirmed").includes("{n}"), l);
  }
  // The two paths must read differently: questions vs create right away.
  assert.match(t("en", "continueSelected"), /questions/);
  assert.match(t("en", "skipCreate"), /Create the book now/);
  assert.match(t("fr", "continueSelected"), /questions/);
  assert.match(t("fr", "skipCreate"), /Créer le livre maintenant/);
  assert.equal(
    t("en", "selectionConfirmed").replace("{n}", "89"),
    "Selection confirmed (89 outings).",
  );
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
  // create_adventure_book shape: both fields present, pick by language
  const created = { usd: "109.00 USD", eur: "95.00 EUR", isEstimate: true, freeShipping: true };
  assert.equal(fmtPrice(created, "fr"), "95.00 EUR");
  assert.equal(fmtPrice(created, "es"), "95.00 EUR");
  assert.equal(fmtPrice(created, "en"), "109.00 USD");
  // usd may be null: fall back to eur even for English
  assert.equal(fmtPrice({ usd: null, eur: "95.00 EUR" }, "en"), "95.00 EUR");
});
