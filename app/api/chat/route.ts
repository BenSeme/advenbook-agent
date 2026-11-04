import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import {
  isVisitorVerified,
  markVisitorVerified,
  overDailyBudget,
  overVisitorBudget,
  withVisitorContext,
} from "@/lib/budget";
import { getOrCreateVisitor, signedVisitorValue, VISITOR_COOKIE } from "@/lib/visitor";
import { turnstileConfigured, verifyTurnstile } from "@/lib/turnstile";
import { logError } from "@/lib/monitor";
import { parseBookChoice } from "@/lib/book-choice";
import { countMetric } from "@/lib/metrics";
import {
  ensureConversation,
  recordStep,
  recordTurn,
  resolveConversationId,
  sanitizeSource,
  withConversationContext,
} from "@/lib/tracking";

export const runtime = "nodejs";
export const maxDuration = 60;

type Incoming = { role?: unknown; content?: unknown };

function withVisitorCookie(
  res: NextResponse,
  visitor: { id: string; isNew: boolean },
): NextResponse {
  if (visitor.isNew) {
    res.cookies.set(VISITOR_COOKIE, signedVisitorValue(visitor.id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 3600,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}

export async function POST(req: Request) {
  const visitor = getOrCreateVisitor(req);
  const reply = (body: unknown, status = 200) =>
    withVisitorCookie(NextResponse.json(body, { status }), visitor);

  // Parsed first: the anonymous conversation id rides along so a visitor
  // cap hit can still be traced to this conversation (counts only).
  let body: {
    messages?: Incoming[];
    context?: {
      connectionId?: unknown;
      confirmedIds?: unknown;
      coverPhotoUrl?: unknown;
      continueBookId?: unknown;
      bookChoice?: unknown;
      pendingPhotos?: unknown;
    };
    turnstileToken?: unknown;
    conversationId?: unknown;
    source?: unknown;
    lang?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return reply({ error: "Invalid JSON body." }, 400);
  }
  const conversationId = resolveConversationId(body.conversationId);
  await ensureConversation({
    conversationId,
    language: body.lang,
    source: sanitizeSource(body.source),
  });

  if (await overDailyBudget()) {
    return reply(
      {
        error:
          "L’agent a atteint son budget du jour et se repose — revenez demain, ou contactez AdvenBook. / The agent has reached its daily budget — please come back tomorrow.",
      },
      503,
    );
  }
  // Two rate layers: per visitor (cookie) and per IP (rotating cookies
  // still hit the IP layer; a shared home IP stays well under it).
  if (
    (await rateLimited(`chat:${visitor.id}`, 24, 10 * 60 * 1000)) ||
    (await rateLimited(`chat-ip:${clientIp(req)}`, 60, 10 * 60 * 1000))
  ) {
    return reply(
      {
        error:
          "Beaucoup de demandes en peu de temps — réessayez dans quelques minutes. / Lots of requests in a short time — please retry in a few minutes.",
      },
      429,
    );
  }
  const history = (body.messages ?? [])
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return reply({ error: "Send at least one user message." }, 400);
  }

  const connectionId =
    typeof body.context?.connectionId === "string" && body.context.connectionId
      ? body.context.connectionId.slice(0, 200)
      : undefined;

  const coverPhotoUrl =
    typeof body.context?.coverPhotoUrl === "string" &&
    body.context.coverPhotoUrl.startsWith("https://")
      ? body.context.coverPhotoUrl.slice(0, 1000)
      : undefined;

  const continueBookId =
    typeof body.context?.continueBookId === "string" && body.context.continueBookId
      ? body.context.continueBookId.slice(0, 100)
      : undefined;

  const bookChoice =
    parseBookChoice(body.context?.bookChoice) ??
    (continueBookId ? { kind: "continue" as const, bookId: continueBookId } : null);

  const confirmedIds = Array.isArray(body.context?.confirmedIds)
    ? body.context.confirmedIds
        .filter((x): x is string => typeof x === "string")
        .slice(0, 200)
    : undefined;

  const pendingPhotos =
    typeof body.context?.pendingPhotos === "number" && Number.isFinite(body.context.pendingPhotos)
      ? Math.max(0, Math.min(300, Math.floor(body.context.pendingPhotos)))
      : 0;

  // Trust anchors, cheapest first: a Strava connection means an AdvenBook
  // account exists; a passed human check (only ever asked at the cap)
  // marks this visitor verified for the day.
  let trusted = Boolean(connectionId) || (await isVisitorVerified(visitor.id));
  if (
    !trusted &&
    typeof body.turnstileToken === "string" &&
    (await verifyTurnstile(body.turnstileToken, clientIp(req)))
  ) {
    await markVisitorVerified(visitor.id);
    trusted = true;
  }

  if (!trusted && (await overVisitorBudget(visitor.id, false))) {
    countMetric("visitor_cap_hit");
    await recordStep(conversationId, "visitor_cap_hit");
    return reply(
      {
        code: "visitor_cap",
        challenge: turnstileConfigured(),
        error:
          "Vous avez beaucoup utilisé l’agent aujourd’hui (limite visiteur, pour garder le service gratuit et rapide pour tous). Connectez votre Strava pour continuer tout de suite, prouvez que vous êtes humain ci-dessous, ou revenez demain. / You have used the agent a lot today (visitor limit, to keep it fast and free for everyone). Connect Strava to continue right away, verify you are human below, or come back tomorrow.",
      },
      429,
    );
  }

  try {
    await recordTurn(conversationId);
    const result = await withVisitorContext(visitor.id, () =>
      withConversationContext(conversationId, () =>
        runAgent(history, {
          connectionId,
          confirmedIds,
          coverPhotoUrl,
          continueBookId,
          bookChoice,
          conversationId,
          pendingPhotos,
        }),
      ),
    );
    countMetric("chat_turn");
    const books = result.ui.filter((e) => e.kind === "book").length;
    if (books > 0) countMetric("book_created", books);
    return reply({ ...result, conversationId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    logError("chat", err);
    return reply({ error: message }, 502);
  }
}
