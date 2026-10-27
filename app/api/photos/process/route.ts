import { NextResponse } from "next/server";
import sharp from "sharp";
import { put } from "@vercel/blob";
import { segmentSubject } from "@/lib/models";
import { computeCrop } from "@/lib/crop";

export const runtime = "nodejs";
export const maxDuration = 60;

const PROMPTS = ["person", "mountain summit", "bicycle", "mountain"];

// SAM 3.1 finds the subject, sharp crops to a 3:2 print ratio around it,
// then the crop is uploaded to Vercel Blob as a public photo_url.
export async function POST(req: Request) {
  let body: { dataUrl?: unknown; fileName?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Expected a base64 image." }, { status: 400 });
  }
  const input = Buffer.from(match[1], "base64");
  if (input.length > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "Image too large (12 MB max)." }, { status: 413 });
  }

  try {
    const meta = await sharp(input).metadata();
    const imgW = meta.width ?? 0;
    const imgH = meta.height ?? 0;
    if (!imgW || !imgH) throw new Error("Unreadable image.");

    let box = null;
    let usedPrompt: string | null = null;
    for (const prompt of PROMPTS) {
      box = await segmentSubject(dataUrl, prompt);
      if (box) {
        usedPrompt = prompt;
        break;
      }
    }
    const rect = computeCrop(box, imgW, imgH, 1.5);
    const cropped = await sharp(input)
      .extract(rect)
      .resize({ width: Math.min(rect.width, 1600), withoutEnlargement: true })
      .jpeg({ quality: 86 })
      .toBuffer();

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          error:
            "Recadrage OK, mais l’envoi des photos n’est pas configuré sur le serveur (BLOB_READ_WRITE_TOKEN manquant dans .env.local). La photo reste sur votre appareil pour l’instant. / Crop OK, but photo upload is not configured on the server yet.",
          box,
          usedPrompt,
          crop: rect,
        },
        { status: 501 },
      );
    }
    const name = `advenbook/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const blob = await put(name, cropped, { access: "public", contentType: "image/jpeg" });
    return NextResponse.json({ url: blob.url, box, usedPrompt, crop: rect });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed.";
    console.error("photo process error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
