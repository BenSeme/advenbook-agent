import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeBooks, bookEventFromAddResult } from "../lib/my-books.ts";

test("normalizeBooks maps the live get_my_books shape", () => {
  const books = normalizeBooks({
    books: [
      {
        book_id: "BK1",
        title: "Été 2025",
        status: "draft",
        activities: 32,
        updated: "2026-10-20",
        editorUrl: "https://www.advenbook.com/fr/my-book/creer?bookId=BK1",
        orderUrl: "https://www.advenbook.com/fr/my-book/order?bookId=BK1",
      },
      { book_id: "BK2", title: "Printemps", status: "ordered", activities: 10, editorUrl: "https://x" },
      { title: "sans id" },
    ],
  });
  assert.equal(books.length, 2);
  assert.equal(books[0].status, "draft");
  assert.equal(books[0].activities, 32);
  assert.equal(books[1].status, "ordered");
  assert.deepEqual(normalizeBooks({}), []);
  assert.deepEqual(normalizeBooks(null), []);
});

test("add result becomes the same book card (editor + order + euro price)", () => {
  const ev = bookEventFromAddResult({
    book_id: "BK1",
    title: "Été 2025",
    added: 5,
    alreadyInBook: 2,
    totalActivities: 37,
    estimatedPages: 92,
    priceEur: "85.00 EUR",
    editorUrl: "https://www.advenbook.com/fr/my-book/creer?bookId=BK1",
    orderUrl: "https://www.advenbook.com/fr/my-book/order?bookId=BK1",
  });
  assert.equal(ev.kind, "book");
  assert.equal(ev.editorUrl, "https://www.advenbook.com/fr/my-book/creer?bookId=BK1");
  assert.equal(ev.orderUrl, "https://www.advenbook.com/fr/my-book/order?bookId=BK1");
  assert.equal(ev.estimatedPages, 92);
  assert.deepEqual(ev.price, { eur: "85.00 EUR" });
  assert.equal(bookEventFromAddResult({ error: "book_already_ordered" }), null);
});
