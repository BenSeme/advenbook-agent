import { NextResponse } from "next/server";
import { callMcpTool } from "@/lib/mcp";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { logError } from "@/lib/monitor";
import { normalizeBooks } from "@/lib/my-books";

export const runtime = "nodejs";
export const maxDuration = 60;

// Deterministic "I have connected" step: no LLM involved. Calls
// list_strava_activities with the stored connection_id and returns the list.
export async function POST(req: Request) {
  if (await rateLimited(`strava-activities:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json(
      {
        error:
          "Beaucoup de lectures Strava en peu de temps — réessayez dans quelques minutes. / Many Strava reads in a short time — please retry in a few minutes.",
      },
      { status: 429 },
    );
  }
  let body: { connectionId?: unknown; lang?: unknown };
  try {
    body = (await req.json()) as { connectionId?: unknown; lang?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const lang =
    typeof body.lang === "string" && ["en", "fr", "es", "de", "it", "eu"].includes(body.lang)
      ? body.lang
      : "en";
  const connectionId =
    typeof body.connectionId === "string" ? body.connectionId.trim() : "";
  if (!connectionId) {
    return NextResponse.json(
      {
        error:
          "Aucun identifiant de connexion Strava dans cette session. Cliquez d’abord sur « Connect Strava », autorisez, puis revenez ici. / No Strava connection in this session — connect first, then come back.",
      },
      { status: 400 },
    );
  }
  try {
    const result = (await callMcpTool("list_strava_activities", {
      connection_id: connectionId,
      limit: 100,
    })) as { activities?: unknown; error?: string } | string;
    if (typeof result === "object" && result !== null && "error" in result && result.error) {
      return NextResponse.json({ error: String(result.error) }, { status: 502 });
    }
    const activities =
      typeof result === "object" && result !== null && Array.isArray(result.activities)
        ? result.activities
        : [];
    // Right after the connection: does this account already have books?
    // Non-fatal — a failure here must never block reading the outings.
    let books: ReturnType<typeof normalizeBooks> = [];
    try {
      books = normalizeBooks(
        await callMcpTool("get_my_books", {
          connection_id: connectionId,
          language: lang,
        }),
      );
    } catch (err) {
      logError("get-my-books", err);
    }
    return NextResponse.json({ activities, books });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Strava reading failed.";
    logError("strava-activities", err);
    return NextResponse.json(
      {
        error: `La lecture Strava a échoué (${message}). L’autorisation n’est peut-être pas terminée : refaites « Connect Strava », attendez le message « vous êtes connecté », puis cliquez Continuer. / Strava reading failed — reconnect and try again.`,
      },
      { status: 502 },
    );
  }
}
