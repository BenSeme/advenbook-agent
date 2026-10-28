// M1 agent loop: Muse Spark + AdvenBook MCP tools, server-side only.
import { chatCompletion, type ChatMessage } from "./models";
import { callMcpTool, listMcpTools } from "./mcp";
import {
  editorUrlFromClaim,
  rewritePreviewLinks,
  stripAdvenBookUrls,
} from "./book-link";
import { del } from "@vercel/blob";
import { filterToConfirmed } from "./selection";

/** After a successful book creation AdvenBook has copied the photos, so
 *  our uploaded copies can go. On failure they are kept for a retry. */
async function deleteUploadedPhotos(args: Record<string, unknown>): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  const acts = Array.isArray(args.activities) ? args.activities : [];
  const urls = acts.flatMap((a) => {
    const rec = asRecord(a);
    return Array.isArray(rec.photo_urls)
      ? rec.photo_urls.filter(
          (u): u is string =>
            typeof u === "string" &&
            u.includes(".public.blob.vercel-storage.com"),
        )
      : [];
  });
  for (const url of urls) {
    try {
      await del(url);
      console.log("blob deleted after book creation:", url);
    } catch (err) {
      console.error("blob delete failed (kept):", url, err instanceof Error ? err.message : err);
    }
  }
}

const FRENCH_MARKERS =
  /\b(je|tu|vous|mon|mes|les|des|une|est|fait|livre|sorties|avec|dans|pour|merci|bonjour|crée|cree|été|ete|mes)\b/gi;

/** Crude but deterministic: 'fr' when the user writes French, else null. */
export function detectFrench(
  history: { content: string }[],
): "fr" | null {
  const userText = history.map((m) => m.content).join(" ");
  const hits = userText.match(FRENCH_MARKERS)?.length ?? 0;
  return hits >= 2 ? "fr" : null;
}

export type UiEvent =
  | { kind: "connect"; connectUrl: string; connectionId: string }
  | { kind: "activities"; activities: Activity[] }
  | {
      kind: "book";
      bookId: string;
      claimUrl: string;
      editorUrl?: string;
      estimatedPages?: number;
      price?: unknown;
    };

export type Activity = {
  strava_activity_id: string;
  title: string;
  date: string;
  sport?: string;
  distance_km?: number;
  elevation_gain_m?: number;
  duration?: string;
  [key: string]: unknown;
};

export type ToolEvent = { name: string; label: string };

const TOOL_LABELS: Record<string, string> = {
  connect_strava: "Connecting to Strava…",
  list_strava_activities: "Reading your Strava…",
  create_adventure_book: "Creating your book draft…",
  get_book_price: "Checking the price…",
};

const SYSTEM_PROMPT = `You are the AdvenBook Agent. You help an athlete turn their Strava outings into a printed AdvenBook draft.

Design intelligence — you are the art director, not a form: from the outing data (photos count, is_race, has_route, elevation, distance, sport), decide what serves THIS book best and say it in one line ("Je pars sur …, dites-moi si vous voulez autrement"), instead of asking everything. Defaults: many long/photo-rich outings → premium hardcover suits; short book → carnet; scenic high-elevation routes → map prominent; photo-rich outings → full-page hero photos (name them in the recap); cover = best photo of the strongest "à mettre en valeur" outing. Respect AdvenBook's visual identity: warm outdoor feel, generous full-page photography, clean readable pages — never cluttered, never gimmicky. The user can always override you.

Flow you must follow:
0. No Strava? If the user has no Strava account (or refuses to connect), do NOT insist: switch to their typed list — ask them to type or dictate their outings (title, date, distance, elevation, duration, sport), then build the book with data_source "typed_list". (GPX files and photo drops arrive in a later milestone; say so in one line if asked.)
1. Ask what book they want only if totally unclear. If the user expresses any book intent, do NOT ask clarifying questions first (no title/date confirmation): call connect_strava immediately in that same turn. In your reply, in the user's language, say clearly: authorise on the Strava/AdvenBook page, then COME BACK to this tab and click "I've connected — continue" (or say "done"). That page does not return here automatically. Wait until the user confirms they connected.
3. Call list_strava_activities with the connection_id you received (filter by dates when the user names a period). Then apply same-day logic: when several activities share a date, the main one is the race / longest outing; warm-ups, cool-downs and recoveries ("échauffement", "warm up", "retour au calme", clearly much shorter same-day outings) are NOT proposed — in your text, propose only a shortlist (never dump the whole Strava list), each with a one-line reason it fits (e.g. "Tourmalet: your biggest climb of the summer"), and mention in one line that warm-ups/others are unticked in the checklist and can be re-ticked. First, open with the 2-3 outings most worth showing off ("à mettre en valeur") using the list fields: many photos (photos count), is_race, has_route with big elevation, longest distance — say why each stands out (e.g. "UTMB: course officielle, 34 photos, énorme dénivelé"). Keep this reply SHORT (a few lines max): the checklist card already shows the details, and long text above it forces endless scrolling. The user confirms/edits the selection in a checklist. After the user confirms a selection, NEVER call list_strava_activities again and NEVER add, re-add or swap outings: the confirmed list is final, and the book must contain exactly those outings — the server also enforces this mechanically. Long books: the user wants the longest book possible with their best outings — never drop confirmed outings to fit a number. AdvenBook binds one book (one create call) to at most the activities.maxItems stated in the create_adventure_book tool definition: if the confirmed list exceeds that maximum, split it chronologically into volumes of at most that many, call create_adventure_book once per volume with titles "<title> — Volume 1", "<title> — Volume 2"…, and present each volume's "Open my book" button. Do this without asking again.
4. Interview (OPTIONAL, not the goal — the goal is the book draft): offer it, and if the user wants stories, for each chosen outing ask 1-2 short warm questions (who was there, a highlight, how they felt), one outing at a time, then write a 2-4 sentence first-person story in the user's own words. NEVER invent facts. If the user skips, or says "create directly / crée directement", use empty stories and go straight to creation.
Photos: if the user mentions adding photos in the conversation, answer that photos already on Strava are added automatically by AdvenBook, and that dropping extra phone photos here arrives in the next milestone — do not claim you received photos you cannot see, and continue creating the book without them unless the user insists on waiting.
4b. Before creating (unless the user said "create directly"), ask ONCE, in one brief message in the user's language — never an interrogation, and never block creation: (a) Format: premium (hardcover), softcover, or carnet (spiral) — call get_book_price first and quote real prices, never invent one; pass the chosen value as format (omit if they don't care). (b) Route map on each outing: yes/no (default yes); if no, omit gps_polyline everywhere. (c) Cover: by default the first photo; ask only if they want another outing's photo in front. Book colour, typography and photo shapes (square, rounded…): there is NO setting you can pass for these — if the user asks, recommend one style in one line from the outings (e.g. warm copper cover, elegant serif, rounded photos for a soft family feel; square and sharp for a sporty race book) and say it is applied in one place on the book page right after creation (the editor the "Open my book" button opens). Never pretend you set a style you cannot transmit.
Free photos: place them YOURSELF, do not interrogate the user. Decide from context (dates, content, the outings in the book): attach to the outing they belong to, or give a strong photo its own page (standalone activity, short title like "Souvenir"), or the cover if it is the best image. Say in ONE line what you did ("J'ai mis la photo du lac en pleine page après le Tourmalet") — the user can ask to move it.
Photos plein écran: beautiful photos deserve full pages, not thumbnails, and YOU decide which ones (that judgment is your job). Quantified floor: at least 25% of the book's photos full page, spread over at least 25% of the photo-bearing outings — prioritise outings with many photos and the strongest images (summits, finishes, people), not a token one per outing. Name the chosen outings in the recap ("Pleine page conseillée : <titres>").
5. Call create_adventure_book once per volume (usually a single volume; several only when the confirmed list exceeds the tool's activities maximum). For Strava books you MUST pass: strava_connection_id (the connection_id from this session), data_source "strava_connector", language = the user's language, and for EVERY chosen activity its strava_activity_id exactly as listed, plus title/date/distance/elevation/duration/sport copied unchanged and its story (empty if skipped). If list_strava_activities returned a gps_polyline for an activity, copy it unchanged into that activity — without a polyline or a strava_activity_id the book page has no route map and no Strava photos. Keep Strava titles unchanged unless the user asks. Then say the book is ready and the user can open it with the "Open my book" button shown below your message — do NOT paste the raw claimUrl (preview link) in your text. Give the estimated price.
Never say the book is ordered or paid: it is a draft the user orders on advenbook.com.

Language: reply in the user's language (English by default, French if they write in French). Be warm, brief, and concrete. If a tool errors (not connected, expired link, no activities), say what happened and what to do next.`;

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

function extractUi(name: string, result: unknown, ui: UiEvent[]) {
  const r = asRecord(result);
  const connectUrl = [r.connectUrl, r.connect_url, r.url].find(
    (v): v is string => typeof v === "string",
  );
  if (name === "connect_strava" && connectUrl) {
    ui.push({
      kind: "connect",
      connectUrl,
      connectionId: String(r.connection_id ?? r.connectionId ?? r.id ?? ""),
    });
  }
  if (name === "list_strava_activities" && Array.isArray(r.activities)) {
    ui.push({ kind: "activities", activities: r.activities as Activity[] });
  }
  if (name === "create_adventure_book" && typeof r.claimUrl === "string") {
    ui.push({
      kind: "book",
      bookId: String(r.bookId ?? ""),
      claimUrl: r.claimUrl,
      editorUrl: editorUrlFromClaim(r.claimUrl) ?? undefined,
      estimatedPages: typeof r.estimatedPages === "number" ? r.estimatedPages : undefined,
      price: r.price,
    });
  }
}

export async function runAgent(
  history: { role: "user" | "assistant"; content: string }[],
  context?: { connectionId?: string; confirmedIds?: string[] },
): Promise<{ reply: string; ui: UiEvent[]; toolEvents: ToolEvent[] }> {
  const tools = await listMcpTools();
  const ui: UiEvent[] = [];
  const toolEvents: ToolEvent[] = [];
  const polylineById = new Map<string, string>();
  const french = detectFrench(history);
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(context?.connectionId
      ? [
          {
            role: "system",
            content: `Known state from earlier in this session: strava_connection_id = ${context.connectionId}. Reuse it; do not ask the user for it.`,
          } as ChatMessage,
        ]
      : []),
    ...history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
  ];

  for (let round = 0; round < 8; round++) {
    const message = await chatCompletion(messages, tools);
    messages.push(message);
    const calls = message.tool_calls ?? [];
    if (calls.length === 0) {
      let reply = rewritePreviewLinks(message.content?.trim() || "…");
      // Buttons carry the links; bare URLs in text cause copy-paste into
      // the address bar (replaces this page, lands on /preview).
      if (ui.length > 0) reply = stripAdvenBookUrls(reply) || reply;
      return { reply, ui, toolEvents };
    }
    for (const call of calls) {
      const name = call.function.name;
      toolEvents.push({ name, label: TOOL_LABELS[name] ?? `Working (${name})…` });
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      if (name === "create_adventure_book") {
        // Deterministic fixes the model keeps missing:
        if (french) args.language = french;
        if (Array.isArray(args.activities)) {
          const filtered = filterToConfirmed(
            args.activities,
            context?.confirmedIds,
          );
          if (filtered.length !== args.activities.length) {
            console.log(
              `confirmed-selection filter: ${args.activities.length} -> ${filtered.length} activities`,
            );
          }
          args.activities = filtered;
        }
        const noMap = /\b(sans carte|pas de carte|no maps?|without maps?)\b/i.test(
          history.map((m) => m.content).join(" "),
        );
        if (noMap && Array.isArray(args.activities)) {
          args.activities = args.activities.map((a) =>
            typeof a === "object" && a !== null
              ? { ...(a as Record<string, unknown>), gps_polyline: undefined }
              : a,
          );
        }
        if (Array.isArray(args.activities)) {
          args.activities = args.activities.map((a) => {
            if (typeof a !== "object" || a === null) return a;
            const rec = { ...(a as Record<string, unknown>) };
            const id = String(rec.strava_activity_id ?? "");
            if (!noMap && !rec.gps_polyline && id && polylineById.has(id)) {
              rec.gps_polyline = polylineById.get(id);
            }
            return rec;
          });
        }
        const acts = Array.isArray(args.activities) ? args.activities : [];
        console.log(
          "create_adventure_book args:",
          JSON.stringify({
            hasConnectionId: Boolean(args.strava_connection_id),
            dataSource: args.data_source,
            language: args.language,
            activities: acts.length,
            withStravaId: acts.filter(
              (a) =>
                typeof a === "object" &&
                a !== null &&
                Boolean((a as Record<string, unknown>).strava_activity_id),
            ).length,
            withPolyline: acts.filter(
              (a) =>
                typeof a === "object" &&
                a !== null &&
                Boolean((a as Record<string, unknown>).gps_polyline),
            ).length,
          }),
        );
      }
      let result: unknown;
      try {
        result = await callMcpTool(name, args);
        extractUi(name, result, ui);
        if (name === "create_adventure_book") {
          const r = asRecord(result);
          // Only on real success (a claim link came back): AdvenBook has
          // copied the photos, delete our uploads. On any failure, keep them.
          if (typeof r.claimUrl === "string") {
            await deleteUploadedPhotos(args);
          }
        }
        if (name === "list_strava_activities") {
          const acts = asRecord(result).activities;
          if (Array.isArray(acts)) {
            for (const a of acts) {
              const rec = asRecord(a);
              const poly =
                rec.gps_polyline ?? rec.polyline ?? rec.summary_polyline;
              if (rec.strava_activity_id && typeof poly === "string" && poly) {
                polylineById.set(String(rec.strava_activity_id), poly);
              }
            }
          }
        }
      } catch (err) {
        result = {
          error: err instanceof Error ? err.message : "Tool call failed.",
        };
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name,
        content: JSON.stringify(result).slice(0, 12000),
      });
    }
  }
  return {
    reply:
      "That took too many steps — please try again, maybe with fewer outings.",
    ui,
    toolEvents,
  };
}
