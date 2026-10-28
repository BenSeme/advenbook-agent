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

// --- Book style: the agent as art director -----------------------------
// AdvenBook accepts these on create_adventure_book AND
// add_to_adventure_book. Picked deterministically from the outings so
// both the model path and "Create directly" transmit a real style.
export const BOOK_TEMPLATES = ["classique", "minimaliste", "magazine", "noir"] as const;
export const BOOK_TYPOGRAPHIES = ["modern", "classic", "adventure", "basque"] as const;
export const BOOK_PHOTO_CORNERS = ["rounded", "square"] as const;

export type BookStyle = {
  template: (typeof BOOK_TEMPLATES)[number];
  typography: (typeof BOOK_TYPOGRAPHIES)[number];
  photo_corners: (typeof BOOK_PHOTO_CORNERS)[number];
  reason: string;
};

type StyleActivity = {
  sport?: unknown;
  is_race?: unknown;
  distance_km?: unknown;
  elevation_gain_m?: unknown;
  photos?: unknown;
};

export function pickBookStyle(activities: unknown[], language?: string): BookStyle {
  const acts = activities.map((a) => asRecord(a) as StyleActivity);
  const n = Math.max(acts.length, 1);
  const races = acts.filter((a) => a.is_race === true).length;
  const avgDist = acts.reduce((s, a) => s + (typeof a.distance_km === "number" ? a.distance_km : 0), 0) / n;
  const avgElev = acts.reduce((s, a) => s + (typeof a.elevation_gain_m === "number" ? a.elevation_gain_m : 0), 0) / n;
  const maxElev = Math.max(0, ...acts.map((a) => (typeof a.elevation_gain_m === "number" ? a.elevation_gain_m : 0)));
  const avgPhotos = acts.reduce((s, a) => s + (typeof a.photos === "number" ? a.photos : 0), 0) / n;
  const fr = language !== "en";
  let style: BookStyle;
  if (races > 0 && races / n >= 0.2) {
    style = {
      template: "magazine",
      typography: "modern",
      photo_corners: "square",
      reason: fr
        ? "Style magazine, typo modern, photos carrées : vos courses officielles méritent un livre sportif et net."
        : "Magazine style, modern type, square photos: your official races deserve a sharp, sporty book.",
    };
  } else if (avgDist >= 60) {
    style = {
      template: "noir",
      typography: "modern",
      photo_corners: "square",
      reason: fr
        ? "Style noir, typo modern, photos carrées : vos longues distances donnent un livre épique et sobre."
        : "Noir style, modern type, square photos: your long distances make an epic, understated book.",
    };
  } else if (maxElev >= 1500 || avgElev >= 900) {
    style = {
      template: "classique",
      typography: "adventure",
      photo_corners: "rounded",
      reason: fr
        ? "Style classique, typo adventure, photos arrondies : vos gros dénivelés appellent un beau livre de montagne."
        : "Classique style, adventure type, rounded photos: your big climbs call for a fine mountain book.",
    };
  } else if (avgPhotos >= 5) {
    style = {
      template: "minimaliste",
      typography: "modern",
      photo_corners: "rounded",
      reason: fr
        ? "Style minimaliste, typo modern, photos arrondies : vos sorties riches en photos laissent les images parler."
        : "Minimaliste style, modern type, rounded photos: your photo-rich outings let the images speak.",
    };
  } else {
    style = {
      template: "classique",
      typography: "classic",
      photo_corners: "rounded",
      reason: fr
        ? "Style classique, typo classic, photos arrondies : un livre chaleureux qui va avec vos sorties."
        : "Classique style, classic type, rounded photos: a warm book that suits your outings.",
    };
  }
  // A Basque-language book gets the Basque typography, whatever the layout.
  if (language === "eu") style = { ...style, typography: "basque" };
  return style;
}

/** Keep only MCP-valid style values; missing/invalid ones take the pick. */
export function sanitizeBookStyle(v: unknown, fallback: BookStyle): BookStyle {
  const r = asRecord(v);
  const pick = <T extends readonly string[]>(value: unknown, allowed: T, fb: T[number]): T[number] =>
    typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T[number]) : fb;
  return {
    template: pick(r.template, BOOK_TEMPLATES, fallback.template),
    typography: pick(r.typography, BOOK_TYPOGRAPHIES, fallback.typography),
    photo_corners: pick(r.photo_corners, BOOK_PHOTO_CORNERS, fallback.photo_corners),
    reason: fallback.reason,
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
  style?: Partial<Pick<BookStyle, "template" | "typography" | "photo_corners">>;
};

/** One direct MCP write (per volume) from exactly the ticked outings.
 *  No model, no get_my_books. Returns the book card event(s). */
export async function createBookDirectly(
  deps: {
    callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    maxPerVolume: number;
  },
  input: DirectCreateInput,
): Promise<{ books: BookUiEvent[]; style: BookStyle }> {
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
  // Art director: one style for the whole book, from the ticked outings.
  const style = sanitizeBookStyle(input.style, pickBookStyle(input.activities, input.language));
  const styleArgs = {
    template: style.template,
    typography: style.typography,
    photo_corners: style.photo_corners,
  };
  const chunks = chunkVolumes(activities, deps.maxPerVolume);
  const books: BookUiEvent[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const args: Record<string, unknown> = isContinue
      ? {
          strava_connection_id: input.connectionId,
          book_id: (input.bookChoice as { bookId: string }).bookId,
          activities: chunks[i],
          ...styleArgs,
          ...session,
        }
      : {
          title: chunks.length > 1 ? `${input.title} — Volume ${i + 1}` : input.title,
          strava_connection_id: input.connectionId,
          language: input.language,
          data_source: "strava_connector",
          activities: chunks[i],
          ...styleArgs,
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
  return { books, style };
}
