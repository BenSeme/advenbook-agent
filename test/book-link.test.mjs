import { test } from "node:test";
import assert from "node:assert/strict";
import {
  editorUrlForBook,
  editorUrlFromClaim,
  openBookUrl,
  rewritePreviewLinks,
  stripAdvenBookUrls,
} from "../lib/book-link.ts";

test("preview claim link becomes the real editor (creer) link", () => {
  const claim =
    "https://www.advenbook.com/fr/my-book/preview?bookId=BOOK123&claim=SECRET&utm_source=ai_agent&utm_medium=ai_app";
  assert.equal(
    editorUrlFromClaim(claim),
    "https://www.advenbook.com/fr/my-book/creer?bookId=BOOK123",
  );
});

test("preview urls inside agent text are rewritten to creer", () => {
  const text =
    "Voici : https://www.advenbook.com/fr/my-book/preview?bookId=B1&claim=SECRET fin";
  assert.equal(
    rewritePreviewLinks(text),
    "Voici : https://www.advenbook.com/fr/my-book/creer?bookId=B1 fin",
  );
});

test("raw advenbook urls are stripped from agent text", () => {
  const text =
    "Cliquez ici : https://www.advenbook.com/fr/strava/ai-connect?c=ABC puis revenez.";
  assert.equal(stripAdvenBookUrls(text), "Cliquez ici : puis revenez.");
});

test("markdown advenbook links become plain labels, never empty links", () => {
  const text =
    "1. [Connecter mon Strava](https://www.advenbook.com/fr/strava/ai-connect?c=ABC&utm_source=ai_agent) puis reviens.";
  const out = stripAdvenBookUrls(text);
  assert.equal(out, "1. Connecter mon Strava puis reviens.");
  assert.ok(!out.includes("]("), "no markdown link left");
  assert.ok(!out.includes("http"), "no raw url left");
});

test("raw order urls are stripped from agent text (buttons carry them)", () => {
  const text =
    "Prêt : https://www.advenbook.com/fr/my-book/order?bookId=B1&token=SECRET à commander.";
  assert.equal(stripAdvenBookUrls(text), "Prêt : à commander.");
});

test("open my book: editor only with a Strava connection, claim link otherwise", () => {
  const claim =
    "https://www.advenbook.com/fr/my-book/preview?bookId=BOOK123&claim=SECRET&utm_source=ai_agent";
  // No Strava account: the button must open the claim (preview) link
  // unchanged — the editor would show the site's demo book instead.
  assert.equal(openBookUrl(claim, false), claim);
  assert.equal(editorUrlForBook(claim, false), undefined);
  // Strava-connected: the book is in their account, editor is right.
  assert.equal(
    openBookUrl(claim, true),
    "https://www.advenbook.com/fr/my-book/creer?bookId=BOOK123",
  );
  assert.equal(
    editorUrlForBook(claim, true),
    "https://www.advenbook.com/fr/my-book/creer?bookId=BOOK123",
  );
  // Unparseable claim with Strava: fall back to the claim link itself.
  assert.equal(openBookUrl("not a url", true), "not a url");
});

test("non-preview links and junk return null", () => {
  assert.equal(editorUrlFromClaim("https://www.advenbook.com/fr/my-book/creer?bookId=X"), null);
  assert.equal(editorUrlFromClaim("not a url"), null);
  assert.equal(editorUrlFromClaim(""), null);
});
