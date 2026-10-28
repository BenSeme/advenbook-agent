import { NextResponse } from "next/server";
import { countMetric, METRIC_EVENTS, type MetricEvent } from "@/lib/metrics";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Client-side funnel events (button clicks). Counts only, no payload data.
export async function POST(req: Request) {
  if (await rateLimited(`metrics-event:${clientIp(req)}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many events." }, { status: 429 });
  }
  let body: { event?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const event = body.event;
  if (
    typeof event !== "string" ||
    !(METRIC_EVENTS as readonly string[]).includes(event) ||
    event === "chat_turn" ||
    event === "book_created"
  ) {
    return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  }
  countMetric(event as MetricEvent);
  return NextResponse.json({ ok: true });
}
