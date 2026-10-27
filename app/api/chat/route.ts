import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

type Incoming = { role?: unknown; content?: unknown };

export async function POST(req: Request) {
  let body: { messages?: Incoming[]; context?: { connectionId?: unknown } };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
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
    return NextResponse.json(
      { error: "Send at least one user message." },
      { status: 400 },
    );
  }

  const connectionId =
    typeof body.context?.connectionId === "string" && body.context.connectionId
      ? body.context.connectionId.slice(0, 200)
      : undefined;

  try {
    const result = await runAgent(history, { connectionId });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    console.error("chat error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
