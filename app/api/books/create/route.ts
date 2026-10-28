import { NextResponse } from "next/server";
import { callMcpTool, listMcpTools } from "@/lib/mcp";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { logError } from "@/lib/monitor";
import { countMetric } from "@/lib/metrics";
import { createBookDirectly, parseBookChoice } from "@/lib/book-choice";
import { isConversationId, recordStep } from "@/lib/tracking";

export const runtime = "nodejs";
export const maxDuration = 60;

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

// "Create directly": server calls create_adventure_book (or
// add_to_adventure_book when bookChoice=continue) with exactly the
// outings the user ticked. No model in this path, no get_my_books.
export async function POST(req: Request) {
  if (await rateLimited(`book-create:${clientIp(req)}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Beaucoup de créations en peu de temps — réessayez dans quelques minutes. / Many creations in a short time — please retry in a few minutes." },
      { status: 429 },
    );
  }
  let body: {
    connectionId?: unknown;
    bookChoice?: unknown;
    activities?: unknown;
    lang?: unknown;
    title?: unknown;
    conversationId?: unknown;
    coverPhotoUrl?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const connectionId = typeof body.connectionId === "string" ? body.connectionId.trim() : "";
  if (!connectionId) {
    return NextResponse.json(
      { error: "Aucun identifiant de connexion Strava dans cette session. / No Strava connection in this session." },
      { status: 400 },
    );
  }
  // No stored choice yet = the user went straight to Create: a new book.
  const bookChoice = parseBookChoice(body.bookChoice) ?? { kind: "new" as const };
  const activities = Array.isArray(body.activities) ? body.activities.slice(0, 500) : [];
  const lang =
    typeof body.lang === "string" && ["en", "fr", "es", "de", "it", "eu"].includes(body.lang)
      ? body.lang
      : "en";
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : "AdvenBook";
  const conversationId = isConversationId(body.conversationId) ? body.conversationId : undefined;
  const coverPhotoUrl =
    typeof body.coverPhotoUrl === "string" && body.coverPhotoUrl.startsWith("https://")
      ? body.coverPhotoUrl.slice(0, 1000)
      : undefined;

  try {
    // Book-size ceiling from the live tool schema, never hard-coded.
    let maxPerVolume = 150;
    try {
      const tools = await listMcpTools();
      const createTool = tools.find((x) => x.function.name === "create_adventure_book");
      const addTool = tools.find((x) => x.function.name === "add_to_adventure_book");
      const tool = bookChoice.kind === "continue" ? addTool : createTool;
      const max = asRecord(asRecord(asRecord(tool?.function.parameters).properties).activities).maxItems;
      if (typeof max === "number" && max > 0) maxPerVolume = max;
    } catch {
      // Schema read failed: keep the fallback, creation itself may work.
    }
    const { books } = await createBookDirectly(
      { callTool: callMcpTool, maxPerVolume },
      { connectionId, bookChoice, activities, language: lang, title, conversationId, coverPhotoUrl },
    );
    countMetric("book_created", books.length);
    if (conversationId) {
      await recordStep(conversationId, bookChoice.kind === "continue" ? "book_continued" : "book_created");
    }
    return NextResponse.json({
      books,
      reply:
        lang === "fr"
          ? "Votre livre est prêt — ouvrez-le avec le bouton ci-dessous."
          : "Your book is ready — open it with the button below.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Book creation failed.";
    logError("book-create", err);
    return NextResponse.json(
      { error: `La création du livre a échoué (${message}). / Book creation failed.` },
      { status: 502 },
    );
  }
}
