import { NextResponse } from "next/server";
import { selectPhotosWithVision } from "@/lib/models";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { logError } from "@/lib/monitor";
import { isConversationId, withConversationContext } from "@/lib/tracking";

export const runtime = "nodejs";
export const maxDuration = 60;

// Receives only { id, url } pairs (public Blob URLs uploaded straight from
// the browser). No image bytes in the body, so no request-size limit can
// drop a photo. Legacy { id, dataUrl } is still accepted.
export async function POST(req: Request) {
  if (await rateLimited(`photos-select:${clientIp(req)}`, 30, 10 * 60 * 1000)) {
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
  const images = (
    Array.isArray(body.images)
      ? body.images.flatMap((i): { id: string; dataUrl: string }[] => {
          if (typeof i !== "object" || i === null) return [];
          const rec = i as { id?: unknown; url?: unknown; dataUrl?: unknown };
          if (typeof rec.id !== "string") return [];
          if (typeof rec.url === "string" && rec.url.startsWith("https://")) {
            return [{ id: rec.id, dataUrl: rec.url }];
          }
          if (typeof rec.dataUrl === "string" && rec.dataUrl.startsWith("data:image/")) {
            return [{ id: rec.id, dataUrl: rec.dataUrl }];
          }
          return [];
        })
      : []
  ).slice(0, 12);
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
