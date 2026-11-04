// M1 agent loop: Muse Spark + AdvenBook MCP tools, server-side only.
import { chatCompletion, type ChatMessage } from "./models";
import { callMcpTool, listMcpTools } from "./mcp";
import {
  editorUrlForBook,
  rewritePreviewLinks,
  stripAdvenBookUrls,
} from "./book-link";
import { del } from "@vercel/blob";
import { chunkVolumes, filterToConfirmed } from "./selection";
import {
  bookEventFromAddResult,
  normalizeBooks,
  type MyBook,
} from "./my-books.ts";
import { injectAgentSessionId, recordStep } from "./tracking";
import { pendingPhotosInstruction } from "./photo-payload";
import {
  blockedToolForChoice,
  pickBookStyle,
  sanitizeBookStyle,
  toolsForBookChoice,
  type BookChoice,
} from "./book-choice.ts";

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
  | { kind: "mybooks"; books: MyBook[] }
  | {
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
  get_my_books: "Checking your AdvenBook books…",
  add_to_adventure_book: "Adding to your existing book…",
  update_adventure_book: "Updating your book…",
};

const SYSTEM_PROMPT = `You are the AdvenBook Agent. You help an athlete turn their outings — from Strava, Garmin files (.fit/.tcx/.gpx), Komoot links, or a dropped folder of tracks + photos — into a printed AdvenBook draft.

Design intelligence — you are the art director, not a form: from the outing data (photos count, is_race, has_route, elevation, distance, sport), decide what serves THIS book best and say it in one line ("Je pars sur …, dites-moi si vous voulez autrement"), instead of asking everything. Defaults: many long/photo-rich outings → premium hardcover suits; short book → carnet; scenic high-elevation routes → map prominent; photo-rich outings → full-page hero photos (name them in the recap); cover = best photo of the strongest "à mettre en valeur" outing. Respect AdvenBook's visual identity: warm outdoor feel, generous full-page photography, clean readable pages — never cluttered, never gimmicky. The user can always override you.

Flow you must follow:
0. No Strava? If the user has no Strava account (or refuses to connect), do NOT insist: suggest, in one brief line in their language, the other ways in — (a) Garmin: on Garmin Connect, open each outing (or export your history) and download the .fit (original), .tcx or .gpx file, then drop the files here with the buttons below; there is no Garmin link to paste, the files are the import; (b) Komoot: paste a public Komoot tour link, share link or public profile link (komoot.com/user/…) right here in the chat and you will import the outings and their photos; a private tour must be made public, shared via its share link, or exported as GPX from Komoot and dropped; (c) a whole folder: drop or choose a folder containing track files (.gpx, .tcx, .fit) and photos — photos are matched to outings by their date; (d) typed list as a last resort: ask them to type or dictate their outings (title, date, distance, elevation, duration, sport), then build the book with data_source "typed_list". Books from dropped Garmin/GPX/folder files use data_source "gpx_files"; books from Komoot links use data_source "other"; follow the on-screen cards and the user's confirmed selection exactly as for Strava.
1. Ask what book they want only if totally unclear. If the user expresses any book intent, do NOT ask clarifying questions first (no title/date confirmation): call connect_strava immediately in that same turn. In your reply, in the user's language, say clearly: authorise on the Strava/AdvenBook page, then COME BACK to this tab and click the connected button below (or say "done"). That page does not return here automatically. Wait until the user confirms they connected. NEVER write any link in your text — no raw URL, no markdown link like [text](url): the buttons below your message carry every link, only point to them ("avec le bouton ci-dessous" / "with the button below").
2. The continue-or-new choice is handled mechanically by the app (asked at most once, stored as bookChoice) before/outside your turns — never call get_my_books and never ask "continue or new?" yourself. If the known state says bookChoice is new, create with create_adventure_book; if it says continue, the server turns your write into an add_to_adventure_book to that book. If their only book is already ordered, it cannot change: offer a new volume (a new book) instead.
3. Call list_strava_activities with the connection_id you received (filter by dates when the user names a period). Then apply same-day logic: when several activities share a date, the main one is the race / longest outing; warm-ups, cool-downs and recoveries ("échauffement", "warm up", "retour au calme", clearly much shorter same-day outings) are NOT proposed — in your text, propose only a shortlist (never dump the whole Strava list), each with a one-line reason it fits (e.g. "Tourmalet: your biggest climb of the summer"), and mention in one line that warm-ups/others are unticked in the checklist and can be re-ticked. First, open with the 2-3 outings most worth showing off ("à mettre en valeur") using the list fields: many photos (photos count), is_race, has_route with big elevation, longest distance — say why each stands out (e.g. "UTMB: course officielle, 34 photos, énorme dénivelé"). Keep this reply SHORT (a few lines max): the checklist card already shows the details, and long text above it forces endless scrolling. The user confirms/edits the selection in a checklist. After the user confirms a selection, NEVER call list_strava_activities again and NEVER add, re-add or swap outings: the confirmed list is final, and the book must contain exactly those outings — the server also enforces this mechanically. Long books: the user wants the longest book possible with their best outings — never drop confirmed outings to fit a number. AdvenBook binds one book (one create call) to at most the activities.maxItems stated in the create_adventure_book tool definition: if the confirmed list exceeds that maximum, split it chronologically into volumes of at most that many, call create_adventure_book once per volume with titles "<title> — Volume 1", "<title> — Volume 2"…, and present each volume's "Open my book" button. Do this without asking again.
4. Interview (OPTIONAL, not the goal — the goal is the book draft): offer it. With a Strava connection, AdvenBook copies what the athlete wrote under each activity on Strava as its story when you leave the story empty. So before the interview, ask once: 'Did you write about some of these outings on Strava?' If yes, only ask about the outings they did not describe, and leave the story empty for the others. If the user wants stories, for each chosen outing ask 1-2 short warm questions (who was there, a highlight, how they felt), one outing at a time, then write a 2-4 sentence first-person story in the user's own words. NEVER invent facts. If the user skips, or says "create directly / crée directement", use empty stories and go straight to creation.
Photos: if the user mentions adding photos in the conversation, answer that photos already on Strava are added automatically by AdvenBook, that extra phone photos can be dropped below with the photo/folder buttons (they are matched to outings by date), and that Komoot cover photos arrive automatically with a Komoot import — do not claim you received photos you cannot see, and continue creating the book without them unless the user insists on waiting.
Pending photos: the known state may say how many photos are waiting in the drop zone below (dropped but not yet processed). When that number is above zero and the user asks to use a photo (for example for a special page or a full page), NEVER say you don't see any photo. Answer in ONE line, in the user's language: tap "Use these photos in the book" below and you will place them (a strong photo can get its own full page).
4b. Before creating (unless the user said "create directly"), ask ONCE, in one brief message in the user's language — never an interrogation, and never block creation: (a) Format: premium (hardcover), softcover, or carnet (spiral) — call get_book_price first and quote real prices, never invent one; pass the chosen value as format (omit if they don't care). (b) Route map on each outing: yes/no (default yes); if no, omit gps_polyline everywhere. (c) Cover: by default the first photo; ask only if they want another outing's photo in front. (d) Style — you are the art director, do not ask, decide: pass template (classique, minimaliste, magazine, noir), typography (modern, classic, adventure, basque) and photo_corners (rounded, square) on EVERY create_adventure_book / add_to_adventure_book call, chosen from THIS book's outings (official races → magazine/modern/square for a sharp sporty book; big mountain climbs → classique/adventure/rounded; long epic distances → noir/modern/square; photo-rich outings → minimaliste so the images speak; a Basque-language book → typography basque), then say why in ONE line in the user's language ("Style magazine… : vos courses officielles…"). The server validates your three values and fills any you omit from the same rules.
Free photos: place them YOURSELF, do not interrogate the user. Decide from context (dates, content, the outings in the book): attach to the outing they belong to, or give a strong photo its own page (standalone activity, short title like "Souvenir"), or the cover if it is the best image. Say in ONE line what you did ("J'ai mis la photo du lac en pleine page après le Tourmalet") — the user can ask to move it.
Photos plein écran: beautiful photos deserve full pages, not thumbnails, and YOU decide which ones (that judgment is your job). Quantified floor: at least 25% of the book's photos full page, spread over at least 25% of the photo-bearing outings — prioritise outings with many photos and the strongest images (summits, finishes, people), not a token one per outing. Name the chosen outings in the recap ("Pleine page conseillée : <titres>").
5. Call create_adventure_book once per volume (usually a single volume; several only when the confirmed list exceeds the tool's activities maximum). For Strava books you MUST pass: strava_connection_id (the connection_id from this session), data_source "strava_connector", language = the user's language, template + typography + photo_corners (your art-director pick from 4b), and for EVERY chosen activity its strava_activity_id exactly as listed, plus title/date/distance/elevation/duration/sport copied unchanged and its story (empty if skipped). If list_strava_activities returned a gps_polyline for an activity, copy it unchanged into that activity — without a polyline or a strava_activity_id the book page has no route map and no Strava photos. Keep Strava titles unchanged unless the user asks. Then say the book is ready and the user can open it with the "Open my book" button shown below your message — do NOT paste the raw claimUrl (preview link) or the raw orderUrl in your text. Give the estimated price. Prices come back with both a usd and an eur field: quote EUR for users writing in French, Spanish, German, Italian or Basque, and USD only for English speakers — never quote dollars to a European user.
Ordering: next to "Open my book" there is an "Order my book" button (the tool's orderUrl): it creates the user's account in one click, then lands on AdvenBook's secure Stripe payment page. You may point to that button in one line. NEVER ask for card details, a billing/shipping address, or any payment information in this chat — payment and address happen only on that secure page. Never say the book is ordered or paid until the user tells you they completed payment there: before that, it is still a draft.
After the book is created, if the user asks to change its look, title or format (darker, cream paper, other fonts, square photos, another cover layout, softcover, a new title...), call update_adventure_book with the claimUrl returned by create_adventure_book (or with strava_connection_id + book_id for a Strava book), passing ONLY what they asked to change. Then say in one line what changed and that they will see it when they open or refresh their book. Never say a change was made if the tool returned an error.

Existing AdvenBook users: reconnecting the SAME Strava account lands in the same AdvenBook account (no duplicate). Continuing a draft means ADDING the confirmed outings with add_to_adventure_book: it only adds — it never removes outings and never overwrites texts the user already wrote in that book, so say exactly that if they worry about their existing work. After a successful add, the same "Open my book" (editorUrl) and "Order my book" (orderUrl) buttons appear. An already-ordered book cannot be changed (the tool answers book_already_ordered): offer a new volume instead, never argue.

Language: reply in the user's language (English by default, French if they write in French). Be warm, brief, and concrete. If a tool errors (not connected, expired link, no activities), say what happened and what to do next.`;

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

function extractUi(
  name: string,
  result: unknown,
  ui: UiEvent[],
  bookChoice?: BookChoice | null,
  hasStravaConnection?: boolean,
) {
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
  if (name === "get_my_books" && !bookChoice) {
    const books = normalizeBooks(result);
    if (books.length) ui.push({ kind: "mybooks", books });
  }
  if (name === "add_to_adventure_book") {
    const event = bookEventFromAddResult(result);
    if (event) ui.push(event);
  }
  if (name === "create_adventure_book" && typeof r.claimUrl === "string") {
    ui.push({
      kind: "book",
      bookId: String(r.bookId ?? ""),
      claimUrl: r.claimUrl,
      // No Strava connection = no AdvenBook account: "Open my book" must
      // open the claim (preview) link, not the editor (demo book there).
      editorUrl: editorUrlForBook(r.claimUrl, Boolean(hasStravaConnection)),
      orderUrl:
        typeof r.orderUrl === "string" && r.orderUrl
          ? r.orderUrl
          : typeof r.order_url === "string" && r.order_url
            ? r.order_url
            : undefined,
      estimatedPages: typeof r.estimatedPages === "number" ? r.estimatedPages : undefined,
      price: r.price,
      title: typeof r.title === "string" && r.title ? r.title : undefined,
    });
  }
}

export async function runAgent(
  history: { role: "user" | "assistant"; content: string }[],
  context?: {
    connectionId?: string;
    confirmedIds?: string[];
    coverPhotoUrl?: string;
    continueBookId?: string;
    bookChoice?: BookChoice | null;
    conversationId?: string;
    pendingPhotos?: number;
  },
): Promise<{
  reply: string;
  ui: UiEvent[];
  toolEvents: ToolEvent[];
  detectedLang: "fr" | null;
}> {
  const bookChoice: BookChoice | null =
    context?.bookChoice ??
    (context?.continueBookId
      ? { kind: "continue", bookId: context.continueBookId }
      : null);
  const allTools = await listMcpTools();
  // Mechanical: once the choice is made the model is never even offered
  // get_my_books again (and, for a new book, never add_to_*).
  const tools = toolsForBookChoice(allTools, bookChoice);
  const ui: UiEvent[] = [];
  const toolEvents: ToolEvent[] = [];
  const polylineById = new Map<string, string>();
  const french = detectFrench(history);
  // The book-size ceiling comes from the live tool schema, never hard-coded.
  const createTool = allTools.find((x) => x.function.name === "create_adventure_book");
  const maxPerVolume =
    (asRecord(asRecord(asRecord(createTool?.function.parameters).properties).activities)
      .maxItems as number | undefined) ?? 150;
  const addTool = allTools.find((x) => x.function.name === "add_to_adventure_book");
  const maxPerAdd =
    (asRecord(asRecord(asRecord(addTool?.function.parameters).properties).activities)
      .maxItems as number | undefined) ?? maxPerVolume;
  // Funnel steps for this conversation (counts only, see lib/tracking.ts).
  const noteToolSuccess = async (toolName: string, result: unknown) => {
    if (!context?.conversationId) return;
    const r = asRecord(result);
    if (r.error) return;
    if (toolName === "list_strava_activities" && Array.isArray(r.activities)) {
      await recordStep(context.conversationId, "strava_connected");
    }
    if (toolName === "get_my_books" && normalizeBooks(result).length > 0) {
      await recordStep(context.conversationId, "existing_book_found");
    }
    if (toolName === "create_adventure_book" && typeof r.claimUrl === "string") {
      await recordStep(context.conversationId, "book_created");
    }
    if (toolName === "add_to_adventure_book" && bookEventFromAddResult(result)) {
      await recordStep(context.conversationId, "book_continued");
    }
  };
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
    ...(context?.coverPhotoUrl
      ? [
          {
            role: "system",
            content: `The user picked this cover photo (they tapped it on the cover-choice card): ${context.coverPhotoUrl}. At book creation you MUST pass it as cover_photo_url. The server also enforces it.`,
          } as ChatMessage,
        ]
      : []),
    ...(pendingPhotosInstruction(context?.pendingPhotos)
      ? [
          {
            role: "system",
            content: pendingPhotosInstruction(context?.pendingPhotos) as string,
          } as ChatMessage,
        ]
      : []),
    ...(bookChoice?.kind === "continue"
      ? [
          {
            role: "system",
            content: `The user chose to CONTINUE their existing draft book, book_id = ${bookChoice.bookId}. Add their confirmed outings to it with add_to_adventure_book (strava_connection_id + this book_id + the activities). Do NOT create a new book — the server converts any create_adventure_book call into an add to this book.`,
          } as ChatMessage,
        ]
      : []),
    ...(bookChoice?.kind === "new"
      ? [
          {
            role: "system",
            content: `The user chose a NEW book (bookChoice = new, already decided — never ask again, never call get_my_books). Create with create_adventure_book.`,
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
      return { reply, ui, toolEvents, detectedLang: french };
    }
    for (const call of calls) {
      const name = call.function.name;
      const blocked = blockedToolForChoice(name, bookChoice);
      if (blocked) {
        // Mechanical guard: never reaches MCP, never shows the card again.
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name,
          content: JSON.stringify({ error: blocked, skipped: true }),
        });
        continue;
      }
      toolEvents.push({ name, label: TOOL_LABELS[name] ?? `Working (${name})…` });
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      let effectiveName = name;
      let effectiveArgs = args;
      const isBookWrite =
        name === "create_adventure_book" || name === "add_to_adventure_book";
      if (isBookWrite) {
        // Anonymous conversation id for AdvenBook order matching
        // (agent_session_id, live on create + add). Server-set, always.
        args = injectAgentSessionId(args, context?.conversationId);
        // Deterministic fixes the model keeps missing:
        if (french && name === "create_adventure_book") args.language = french;
        if (context?.coverPhotoUrl && name === "create_adventure_book") {
          args.cover_photo_url = context.coverPhotoUrl;
        }
        // Art-director style, mechanically: keep the model's valid
        // values, fill/validate the rest from the outing data. Applies
        // to create AND add (the continue conversion below reuses args).
        {
          const style = sanitizeBookStyle(
            args,
            pickBookStyle(
              Array.isArray(args.activities) ? args.activities : [],
              french ? "fr" : "en",
            ),
          );
          args.template = style.template;
          args.typography = style.typography;
          args.photo_corners = style.photo_corners;
        }
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
        // Continuation is deterministic: if the user chose to continue
        // their draft, ANY create becomes an add to that book (add-only
        // server-side), and an add always targets that book.
        if (bookChoice?.kind === "continue") {
          effectiveName = "add_to_adventure_book";
          effectiveArgs = injectAgentSessionId(
            {
              strava_connection_id: String(
                args.strava_connection_id ?? context?.connectionId ?? "",
              ),
              book_id: bookChoice.bookId,
              activities: args.activities,
              template: args.template,
              typography: args.typography,
              photo_corners: args.photo_corners,
            },
            context?.conversationId,
          );
        } else if (name === "add_to_adventure_book") {
          effectiveArgs = injectAgentSessionId(
            {
              ...args,
              strava_connection_id: String(
                args.strava_connection_id ?? context?.connectionId ?? "",
              ),
              book_id: String(args.book_id ?? ""),
            },
            context?.conversationId,
          );
        }
      }
      let result: unknown;
      try {
        // Deterministic volume splitting: if the model sends more than the
        // live maximum in one call, split chronologically and create each
        // volume here — the model cannot drop or merge outings.
        const writeMax =
          effectiveName === "add_to_adventure_book" ? maxPerAdd : maxPerVolume;
        if (
          isBookWrite &&
          Array.isArray(effectiveArgs.activities) &&
          effectiveArgs.activities.length > writeMax
        ) {
          const all = effectiveArgs.activities;
          const baseTitle = String(effectiveArgs.title ?? "AdvenBook");
          const results: unknown[] = [];
          const chunks = chunkVolumes(all, writeMax);
          for (let vi = 0; vi < chunks.length; vi++) {
            const volArgs =
              effectiveName === "add_to_adventure_book"
                ? { ...effectiveArgs, activities: chunks[vi] }
                : {
                    ...effectiveArgs,
                    title: `${baseTitle} — Volume ${vi + 1}`,
                    activities: chunks[vi],
                  };
            const volResult = await callMcpTool(effectiveName, volArgs);
            extractUi(
              effectiveName,
              volResult,
              ui,
              bookChoice,
              typeof (volArgs as Record<string, unknown>).strava_connection_id === "string" &&
                Boolean((volArgs as Record<string, unknown>).strava_connection_id),
            );
            await noteToolSuccess(effectiveName, volResult);
            const vr = asRecord(volResult);
            if (
              typeof vr.claimUrl === "string" ||
              typeof vr.editorUrl === "string"
            ) {
              await deleteUploadedPhotos(volArgs);
            }
            results.push(volResult);
          }
          result = { volumes: results };
        } else {
          result = await callMcpTool(effectiveName, effectiveArgs);
          extractUi(
            effectiveName,
            result,
            ui,
            bookChoice,
            typeof effectiveArgs.strava_connection_id === "string" &&
              Boolean(effectiveArgs.strava_connection_id),
          );
          await noteToolSuccess(effectiveName, result);
          if (isBookWrite) {
            const r = asRecord(result);
            // Only on real success (a claim/editor link came back):
            // AdvenBook has copied the photos, delete our uploads.
            // On any failure, keep them.
            if (
              typeof r.claimUrl === "string" ||
              typeof r.editorUrl === "string"
            ) {
              await deleteUploadedPhotos(effectiveArgs);
            }
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
    detectedLang: french,
  };
}
