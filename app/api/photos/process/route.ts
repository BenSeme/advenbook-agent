import { NextResponse } from "next/server";
import sharp from "sharp";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { logError } from "@/lib/monitor";
import { put } from "@vercel/blob";
import { segmentSubject } from "@/lib/models";
import { computeCrop } from "@/lib/crop";
import { isConversationId, withConversationContext } from "@/lib/tracking";

export const runtime = "nodejs";
export const maxDuration = 60;

const PROMPTS = ["person", "mountain summit", "bicycle", "mountain"];

function isBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

// SAM 3.1 finds the subject, sharp crops to a 3:2 print ratio around it,
// then the crop is uploaded to Vercel Blob as a public photo_url.
// Primary input is { url }: the full-quality original the browser already
// uploaded straight to Blob, so no image bytes cross this route and the
// Vercel request-body limit can never reject it, whatever its size.
// Legacy { dataUrl } is still accepted. On any crop failure the caller
// falls back to the original URL, so the photo still reaches the book.
export async function POST(req: Request) {
  if (await rateLimited(`photos-process:${clientIp(req)}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many photo uploads — retry in a few minutes." }, { status: 429 });
  }
  let body: { url?: unknown; dataUrl?: unknown; fileName?: unknown; conversationId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sourceUrl = typeof body.url === "string" && isBlobUrl(body.url) ? body.url : "";
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
  let input: Buffer;
  let samImage: string;
  if (sourceUrl) {
    try {
      const res = await fetch(sourceUrl);
      if (!res.ok) throw new Error(`Blob fetch ${res.status}.`);
      input = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      logError("photos-process-fetch", err);
      return NextResponse.json(
        { error: "Could not fetch the uploaded photo.", url: sourceUrl, fallback: true },
        { status: 502 },
      );
    }
    samImage = sourceUrl;
  } else {
    const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Expected a Blob url or a base64 image." }, { status: 400 });
    }
    input = Buffer.from(match[1], "base64");
    samImage = dataUrl;
  }

  try {
    const meta = await sharp(input).metadata();
    const imgW = meta.width ?? 0;
    const imgH = meta.height ?? 0;
    if (!imgW || !imgH) throw new Error("Unreadable image.");

    let box = null;
    let usedPrompt: string | null = null;
    const segment = (prompt: string) =>
      isConversationId(body.conversationId)
        ? withConversationContext(body.conversationId, () => segmentSubject(samImage, prompt))
        : segmentSubject(samImage, prompt);
    for (const prompt of PROMPTS) {
      try {
        box = await segment(prompt);
      } catch {
        box = null;
      }
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
      // The original is already public on Blob: the book can use it as-is.
      if (sourceUrl) return NextResponse.json({ url: sourceUrl, box, usedPrompt, crop: rect, fallback: true });
      return NextResponse.json(
        {
          error:
            "Recadrage OK, mais l’envoi des photos n’est pas configuré sur le serveur (BLOB_READ_WRITE_TOKEN manquant dans .env.local). / Crop OK, but photo upload is not configured on the server yet.",
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
    logError("photos-process", err);
    // Never lose the photo: signal the caller to keep the original URL.
    if (sourceUrl) {
      return NextResponse.json({ error: message, url: sourceUrl, fallback: true }, { status: 502 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
