import { NextResponse } from "next/server";
import { selectPhotosWithVision } from "@/lib/models";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { logError } from "@/lib/monitor";
import { isConversationId, withConversationContext } from "@/lib/tracking";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (await rateLimited(`photos-select:${clientIp(req)}`, 12, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many photo analyses — retry in a few minutes." }, { status: 429 });
  }
  let body: { outingTitle?: unknown; images?: unknown; conversationId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const outingTitle =
    typeof body.outingTitle === "string" ? body.outingTitle.slice(0, 200) : "Sortie";
  const images = Array.isArray(body.images)
    ? body.images
        .filter(
          (i): i is { id: string; dataUrl: string } =>
            typeof i === "object" &&
            i !== null &&
            typeof (i as { id?: unknown }).id === "string" &&
            typeof (i as { dataUrl?: unknown }).dataUrl === "string" &&
            (i as { dataUrl: string }).dataUrl.startsWith("data:image/"),
        )
        .slice(0, 12)
    : [];
  if (images.length === 0) {
    return NextResponse.json({ error: "No images received." }, { status: 400 });
  }
  try {
    const verdict = isConversationId(body.conversationId)
      ? await withConversationContext(body.conversationId, () =>
          selectPhotosWithVision(outingTitle, images),
        )
      : await selectPhotosWithVision(outingTitle, images);
    return NextResponse.json(verdict);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vision failed.";
    logError("photos-select", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
