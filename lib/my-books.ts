// Existing-book helpers for get_my_books / add_to_adventure_book.
// Pure normalizers so both the agent and the Strava route agree, and so
// they can be unit-tested without any network.

export type MyBook = {
  book_id: string;
  title: string;
  status: "draft" | "ordered";
  activities: number;
  editorUrl?: string;
  orderUrl?: string;
};

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

export function normalizeBooks(result: unknown): MyBook[] {
  const books = asRecord(result).books;
  if (!Array.isArray(books)) return [];
  return books
    .map((b): MyBook | null => {
      const r = asRecord(b);
      const id = String(r.book_id ?? r.bookId ?? "");
      if (!id) return null;
      return {
        book_id: id,
        title: String(r.title ?? "AdvenBook"),
        status: r.status === "ordered" ? "ordered" : "draft",
        activities: typeof r.activities === "number" ? r.activities : 0,
        editorUrl: typeof r.editorUrl === "string" ? r.editorUrl : undefined,
        orderUrl: typeof r.orderUrl === "string" ? r.orderUrl : undefined,
      };
    })
    .filter((b): b is MyBook => b !== null);
}

export type BookUiEvent = {
  kind: "book";
  bookId: string;
  claimUrl: string;
  editorUrl?: string;
  orderUrl?: string;
  estimatedPages?: number;
  price?: unknown;
  title?: string;
  totalActivities?: number;
  added?: number;
};

/** add_to_adventure_book result -> the same book card as a creation. */
export function bookEventFromAddResult(result: unknown): BookUiEvent | null {
  const r = asRecord(result);
  const editorUrl = typeof r.editorUrl === "string" ? r.editorUrl : "";
  if (!editorUrl) return null;
  return {
    kind: "book",
    bookId: String(r.book_id ?? r.bookId ?? ""),
    claimUrl: editorUrl,
    editorUrl,
    orderUrl: typeof r.orderUrl === "string" ? r.orderUrl : undefined,
    estimatedPages:
      typeof r.estimatedPages === "number" ? r.estimatedPages : undefined,
    price:
      typeof r.priceEur === "string" && r.priceEur
        ? { eur: r.priceEur }
        : r.price,
    title: typeof r.title === "string" && r.title ? r.title : undefined,
    totalActivities:
      typeof r.totalActivities === "number" ? r.totalActivities : undefined,
    added: typeof r.added === "number" ? r.added : undefined,
  };
}
