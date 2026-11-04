import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { logError } from "@/lib/monitor";

export const runtime = "nodejs";

// Token route for DIRECT browser -> Vercel Blob uploads. The photo bytes
// never pass through this (or any) API route, so the Vercel ~4.5 MB
// request-body limit cannot reject a full-quality phone photo. This route
// only signs a short-lived, image-only client token.
export async function POST(req: Request): Promise<NextResponse> {
  if (await rateLimited(`photos-upload:${clientIp(req)}`, 120, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many photo uploads — retry in a few minutes." },
      { status: 429 },
    );
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Photo upload is not configured on the server (BLOB_READ_WRITE_TOKEN)." },
      { status: 501 },
    );
  }
  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("advenbook/originals/")) {
          throw new Error("Unexpected upload path.");
        }
        return {
          allowedContentTypes: ["image/*"],
          addRandomSuffix: false,
          allowOverwrite: true,
          // Every real photo must reach the book: 50 MB is far above any
          // phone or camera JPEG, and only stops abuse of our storage.
          maximumSizeInBytes: 50 * 1024 * 1024,
        };
      },
      onUploadCompleted: async () => {
        // Nothing to persist: the client already receives the blob URL.
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    logError("photos-upload", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload token failed." },
      { status: 400 },
    );
  }
}
