import { test } from "node:test";
import assert from "node:assert/strict";
import { editorUrlFromClaim } from "../lib/book-link.ts";

test("preview claim link becomes the real editor (creer) link", () => {
  const claim =
    "https://www.advenbook.com/fr/my-book/preview?bookId=BOOK123&claim=SECRET&utm_source=ai_agent&utm_medium=ai_app";
  assert.equal(
    editorUrlFromClaim(claim),
    "https://www.advenbook.com/fr/my-book/creer?bookId=BOOK123",
  );
});

test("non-preview links and junk return null", () => {
  assert.equal(editorUrlFromClaim("https://www.advenbook.com/fr/my-book/creer?bookId=X"), null);
  assert.equal(editorUrlFromClaim("not a url"), null);
  assert.equal(editorUrlFromClaim(""), null);
});
