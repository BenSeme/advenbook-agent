// The continue-or-new choice, enforced mechanically (not by prompt):
// asked at most once per conversation, stored client-side, after which
// get_my_books is never called or shown again. "Create directly" also
// lives here: the server builds the MCP call from exactly the ticked
// outings, without asking the model.

import { editorUrlFromClaim } from "./book-link.ts";
import { bookEventFromAddResult, type BookUiEvent } from "./my-books.ts";
import { chunkVolumes } from "./selection.ts";

export type BookChoice =
  | { kind: "new" }
  | { kind: "continue"; bookId: string };

export function parseBookChoice(v: unknown): BookChoice | null {
  if (typeof v !== "object" || v === null) return null;
  const r = v as Record<string, unknown>;
  if (r.kind === "new") return { kind: "new" };
  if (r.kind === "continue") {
    const id = typeof r.bookId === "string" ? r.bookId : typeof r.book_id === "string" ? r.book_id : "";
    return id ? { kind: "continue", bookId: id } : null;
  }
  return null;
}

/** Tools the model may see. Once the choice is made, get_my_books is
 *  gone for the rest of the session; for a new book, add_to_* is too. */
export function toolsForBookChoice<T extends { function: { name: string } }>(
  tools: T[],
  choice: BookChoice | null,
): T[] {
  if (!choice) return tools;
  return tools.filter((t) => {
    if (t.function.name === "get_my_books") return false;
    if (choice.kind === "new" && t.function.name === "add_to_adventure_book") return false;
    return true;
  });
}

/** Non-null = this tool call must NOT reach MCP (defence in depth if
 *  the model hallucinates a call it was never offered). */
export function blockedToolForChoice(
  name: string,
  choice: BookChoice | null,
): string | null {
  if (!choice) return null;
  if (name === "get_my_books") {
    return "Book choice already made for this conversation; get_my_books must not be called again.";
  }
  if (choice.kind === "new" && name === "add_to_adventure_book") {
    return "User chose a new book; add_to_adventure_book is not allowed.";
  }
  return null;
}

export function mayCallGetMyBooks(choice: BookChoice | null): boolean {
  return choice === null;
}

type Tickable = { strava_activity_id: string; [key: string]: unknown };

/** Exactly the ticked outings, in list order, deduped by Strava id. */
export function selectTickedActivities<T extends Tickable>(
  activities: T[],
  selected: Record<string, boolean>,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const a of activities) {
    if (!selected[a.strava_activity_id] || seen.has(a.strava_activity_id)) continue;
    seen.add(a.strava_activity_id);
    out.push(a);
  }
  return out;
}

/** Never lose a tick between turns: ids the user already touched keep
 *  their value; only brand-new ids take the suggested default. */
export function preserveSelection(
  prev: Record<string, boolean>,
  activities: Tickable[],
  suggested: Record<string, boolean>,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const a of activities) {
    out[a.strava_activity_id] =
      a.strava_activity_id in prev ? prev[a.strava_activity_id] : Boolean(suggested[a.strava_activity_id]);
  }
  return out;
}

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

function toBookActivity(a: unknown): Record<string, unknown> | null {
  const r = asRecord(a);
  const id = typeof r.strava_activity_id === "string" ? r.strava_activity_id : "";
  if (!id) return null;
  const out: Record<string, unknown> = {
    title: r.title,
    date: r.date,
    distance_km: r.distance_km,
    elevation_gain_m: r.elevation_gain_m,
    duration: r.duration,
    sport: r.sport,
    story: typeof r.story === "string" ? r.story : "",
    strava_activity_id: id,
  };
  if (typeof r.gps_polyline === "string" && r.gps_polyline) out.gps_polyline = r.gps_polyline;
  if (Array.isArray(r.photo_urls)) {
    out.photo_urls = r.photo_urls.filter((u): u is string => typeof u === "string");
  }
  return out;
}

function createEvent(result: unknown): BookUiEvent | null {
  const r = asRecord(result);
  if (typeof r.claimUrl !== "string") return null;
  return {
    kind: "book",
    bookId: String(r.bookId ?? ""),
    claimUrl: r.claimUrl,
    editorUrl: editorUrlFromClaim(r.claimUrl) ?? undefined,
    orderUrl:
      typeof r.orderUrl === "string" && r.orderUrl
        ? r.orderUrl
        : typeof r.order_url === "string" && r.order_url
          ? r.order_url
          : undefined,
    estimatedPages: typeof r.estimatedPages === "number" ? r.estimatedPages : undefined,
    price: r.price,
    title: typeof r.title === "string" && r.title ? r.title : undefined,
  };
}

export type DirectCreateInput = {
  connectionId: string;
  bookChoice: BookChoice;
  activities: unknown[];
  language: string;
  title: string;
  conversationId?: string;
  coverPhotoUrl?: string;
};

/** One direct MCP write (per volume) from exactly the ticked outings.
 *  No model, no get_my_books. Returns the book card event(s). */
export async function createBookDirectly(
  deps: {
    callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    maxPerVolume: number;
  },
  input: DirectCreateInput,
): Promise<{ books: BookUiEvent[] }> {
  if (!input.connectionId) throw new Error("No Strava connection in this session.");
  const seen = new Set<string>();
  const activities: Record<string, unknown>[] = [];
  for (const a of input.activities) {
    const rec = toBookActivity(a);
    if (!rec) continue;
    const id = String(rec.strava_activity_id);
    if (seen.has(id)) continue;
    seen.add(id);
    activities.push(rec);
  }
  if (activities.length === 0) throw new Error("No outing is ticked.");
  const session =
    input.conversationId && /^c_[A-Za-z0-9]{16}$/.test(input.conversationId)
      ? { agent_session_id: input.conversationId }
      : {};
  const isContinue = input.bookChoice.kind === "continue";
  const toolName = isContinue ? "add_to_adventure_book" : "create_adventure_book";
  const chunks = chunkVolumes(activities, deps.maxPerVolume);
  const books: BookUiEvent[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const args: Record<string, unknown> = isContinue
      ? {
          strava_connection_id: input.connectionId,
          book_id: (input.bookChoice as { bookId: string }).bookId,
          activities: chunks[i],
          ...session,
        }
      : {
          title: chunks.length > 1 ? `${input.title} — Volume ${i + 1}` : input.title,
          strava_connection_id: input.connectionId,
          language: input.language,
          data_source: "strava_connector",
          activities: chunks[i],
          ...(input.coverPhotoUrl ? { cover_photo_url: input.coverPhotoUrl } : {}),
          ...session,
        };
    const result = await deps.callTool(toolName, args);
    const r = asRecord(result);
    if (r.error) throw new Error(String(r.error));
    const event = isContinue ? bookEventFromAddResult(result) : createEvent(result);
    if (!event) throw new Error("AdvenBook did not return a book link.");
    books.push(event);
  }
  return { books };
}
