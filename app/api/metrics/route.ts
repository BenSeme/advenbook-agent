import { NextResponse } from "next/server";
import { metricsSnapshot } from "@/lib/metrics";

export const runtime = "nodejs";

// Funnel numbers, protected by METRICS_TOKEN (header x-metrics-token or
// ?token=). Disabled entirely when the token is not configured.
export async function GET(req: Request) {
  const expected = process.env.METRICS_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "Metrics disabled (METRICS_TOKEN not set on the server)." },
      { status: 404 },
    );
  }
  const given =
    req.headers.get("x-metrics-token") ??
    new URL(req.url).searchParams.get("token");
  if (given !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const snap = await metricsSnapshot();
  const funnel = {
    booksPer100Turns:
      snap.total.chat_turn > 0
        ? Math.round((snap.total.book_created / snap.total.chat_turn) * 1000) / 10
        : null,
    orderClicksPerBook:
      snap.total.book_created > 0
        ? Math.round((snap.total.order_click / snap.total.book_created) * 100) / 100
        : null,
  };
  return NextResponse.json({ ...snap, funnel });
}
