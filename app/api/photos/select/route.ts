import { NextResponse } from "next/server";
import { selectPhotosWithVision } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { outingTitle?: unknown; images?: unknown };
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
    const verdict = await selectPhotosWithVision(outingTitle, images);
    return NextResponse.json(verdict);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vision failed.";
    console.error("photo select error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
