import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blockedToolForChoice,
  createBookDirectly,
  parseBookChoice,
  selectTickedActivities,
  toolsForBookChoice,
} from "../lib/book-choice.ts";

const tools = [
  { type: "function", function: { name: "get_my_books", parameters: {} } },
  { type: "function", function: { name: "add_to_adventure_book", parameters: {} } },
  { type: "function", function: { name: "create_adventure_book", parameters: { type: "object", properties: { activities: { maxItems: 150 } } } } },
  { type: "function", function: { name: "list_strava_activities", parameters: {} } },
];

const acts182 = Array.from({ length: 182 }, (_, i) => ({
  strava_activity_id: String(1000 + i),
  title: `Sortie ${i}`,
  date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
  sport: "Ride",
  distance_km: 40,
  elevation_gain_m: 800,
  duration: "2h",
}));

test("bookChoice parsing: new / continue+book_id only", () => {
  assert.deepEqual(parseBookChoice({ kind: "new" }), { kind: "new" });
  assert.deepEqual(parseBookChoice({ kind: "continue", bookId: "BK9" }), { kind: "continue", bookId: "BK9" });
  assert.equal(parseBookChoice({ kind: "continue" }), null);
  assert.equal(parseBookChoice(null), null);
  assert.equal(parseBookChoice("new"), null);
});

test("once new is chosen, model never gets get_my_books / add_to_adventure_book", () => {
  const names = toolsForBookChoice(tools, { kind: "new" }).map((t) => t.function.name);
  assert.deepEqual(names, ["create_adventure_book", "list_strava_activities"]);
  // Even a hallucinated call is blocked mechanically.
  assert.match(blockedToolForChoice("get_my_books", { kind: "new" }) ?? "", /already/);
  assert.match(blockedToolForChoice("add_to_adventure_book", { kind: "new" }) ?? "", /new book/);
  assert.equal(blockedToolForChoice("create_adventure_book", { kind: "new" }), null);
});

test("once continue is chosen, get_my_books is gone but add remains", () => {
  const names = toolsForBookChoice(tools, { kind: "continue", bookId: "BK9" }).map((t) => t.function.name);
  assert.deepEqual(names, ["add_to_adventure_book", "create_adventure_book", "list_strava_activities"]);
  assert.match(blockedToolForChoice("get_my_books", { kind: "continue", bookId: "BK9" }) ?? "", /already/);
  assert.equal(blockedToolForChoice("get_my_books", null), null);
});

test("ticked selection: exactly the ticked ids, in list order, deduped", () => {
  const selected = {};
  for (const a of acts182) selected[a.strava_activity_id] = false;
  for (let i = 0; i < 80; i++) selected[acts182[i * 2].strava_activity_id] = true; // every other one
  const ticked = selectTickedActivities(acts182, selected);
  assert.equal(ticked.length, 80);
  assert.equal(ticked[0].strava_activity_id, "1000");
  assert.equal(ticked[79].strava_activity_id, String(1000 + 158));
});

test("E2E scenario: connect > choose new > tick 80 > create directly > one book, 80 outings, its link", async () => {
  const calls = [];
  const fakeCallTool = async (name, args) => {
    calls.push({ name, args });
    if (name === "create_adventure_book") {
      return {
        bookId: "BK80",
        claimUrl: "https://www.advenbook.com/fr/my-book/preview?bookId=BK80&claim=X",
        orderUrl: "https://www.advenbook.com/fr/my-book/order?bookId=BK80",
        estimatedPages: 120,
        price: { eur: "85,00 €" },
        title: "Été 2026",
      };
    }
    throw new Error(`unexpected tool ${name}`);
  };
  // tick exactly 80 of 182
  const selected = {};
  for (const a of acts182) selected[a.strava_activity_id] = true;
  for (let i = 80; i < 182; i++) selected[acts182[i].strava_activity_id] = false;
  const ticked = selectTickedActivities(acts182, selected);
  assert.equal(ticked.length, 80);

  const out = await createBookDirectly(
    { callTool: fakeCallTool, maxPerVolume: 150 },
    {
      connectionId: "conn-1",
      bookChoice: { kind: "new" },
      activities: ticked,
      language: "fr",
      title: "Été 2026",
      conversationId: "c_AAAAAAAAAAAAAAAA",
    },
  );
  assert.equal(calls.length, 1, "exactly one MCP write call");
  assert.equal(calls[0].name, "create_adventure_book");
  assert.equal(calls[0].args.activities.length, 80);
  assert.deepEqual(
    calls[0].args.activities.map((a) => a.strava_activity_id),
    ticked.map((a) => a.strava_activity_id),
  );
  assert.equal(calls.filter((c) => c.name === "get_my_books").length, 0);
  assert.equal(out.books.length, 1);
  assert.equal(out.books[0].bookId, "BK80");
  assert.equal(out.books[0].editorUrl, "https://www.advenbook.com/fr/my-book/creer?bookId=BK80");
  assert.equal(out.books[0].orderUrl, "https://www.advenbook.com/fr/my-book/order?bookId=BK80");
  assert.equal(out.books[0].claimUrl, "https://www.advenbook.com/fr/my-book/preview?bookId=BK80&claim=X");

  // Second Create click with the same preserved ticked selection: still 80, never 182.
  const out2 = await createBookDirectly(
    { callTool: fakeCallTool, maxPerVolume: 150 },
    { connectionId: "conn-1", bookChoice: { kind: "new" }, activities: selectTickedActivities(acts182, selected), language: "fr", title: "Été 2026" },
  );
  assert.equal(calls[1].args.activities.length, 80);
  assert.equal(out2.books.length, 1);
});

test("continue choice creates via add_to_adventure_book with the stored book_id", async () => {
  const calls = [];
  const out = await createBookDirectly(
    {
      callTool: async (name, args) => {
        calls.push({ name, args });
        return { book_id: "BK9", editorUrl: "https://www.advenbook.com/fr/my-book/creer?bookId=BK9", orderUrl: "https://www.advenbook.com/fr/my-book/order?bookId=BK9", added: 2, totalActivities: 14 };
      },
      maxPerVolume: 150,
    },
    { connectionId: "conn-1", bookChoice: { kind: "continue", bookId: "BK9" }, activities: acts182.slice(0, 2), language: "en", title: "X" },
  );
  assert.equal(calls[0].name, "add_to_adventure_book");
  assert.equal(calls[0].args.book_id, "BK9");
  assert.equal(out.books[0].editorUrl, "https://www.advenbook.com/fr/my-book/creer?bookId=BK9");
});

test("direct create refuses an empty ticked selection", async () => {
  await assert.rejects(
    () => createBookDirectly({ callTool: async () => ({}), maxPerVolume: 150 }, { connectionId: "c", bookChoice: { kind: "new" }, activities: [], language: "en", title: "X" }),
    /No outing is ticked/,
  );
});
