// M1 agent loop: Muse Spark + AdvenBook MCP tools, server-side only.
import { chatCompletion, type ChatMessage } from "./models";
import { callMcpTool, listMcpTools } from "./mcp";

export type UiEvent =
  | { kind: "connect"; connectUrl: string; connectionId: string }
  | { kind: "activities"; activities: Activity[] }
  | { kind: "book"; bookId: string; claimUrl: string; estimatedPages?: number; price?: unknown };

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

Flow you must follow:
1. Ask what book they want only if totally unclear. If the user expresses any book intent, do NOT ask clarifying questions first (no title/date confirmation): call connect_strava immediately in that same turn and show the link, then wait until the user confirms they connected.
3. Call list_strava_activities with the connection_id you received (filter by dates when the user names a period). Present the matching outings as a short list, each with a one-line reason it fits (e.g. "Tourmalet: your biggest climb of the summer"). The user confirms/edits the selection in a checklist.
4. Interview: for each chosen outing ask 1-2 short warm questions (who was there, a highlight, how they felt). One outing at a time. From the answers write a 2-4 sentence first-person story in the user's own words. NEVER invent facts. If the user skips an outing, use an empty story for it.
5. Call create_adventure_book exactly once (title, strava_connection_id, language, data_source, and the chosen activities with their stories and strava_activity_id). Keep Strava titles unchanged unless the user asks. Then present the claimUrl as the "Open my book" link with the estimated price.
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
      estimatedPages: typeof r.estimatedPages === "number" ? r.estimatedPages : undefined,
      price: r.price,
    });
  }
}

export async function runAgent(
  history: { role: "user" | "assistant"; content: string }[],
  context?: { connectionId?: string },
): Promise<{ reply: string; ui: UiEvent[]; toolEvents: ToolEvent[] }> {
  const tools = await listMcpTools();
  const ui: UiEvent[] = [];
  const toolEvents: ToolEvent[] = [];
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
      return { reply: message.content?.trim() || "…", ui, toolEvents };
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
      let result: unknown;
      try {
        result = await callMcpTool(name, args);
        extractUi(name, result, ui);
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
