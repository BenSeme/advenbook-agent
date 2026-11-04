import { NextResponse } from "next/server";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { logError } from "@/lib/monitor";

export const runtime = "nodejs";

// Presigned route for DIRECT browser -> Vercel Blob uploads. The photo bytes
// never pass through this (or any) API route, so the Vercel ~4.5 MB
// request-body limit cannot reject a full-quality phone photo. This route
// only signs a short-lived, image-only upload URL. It uses the store
// connected to the project (BLOB_STORE_ID + Vercel OIDC): no secret token
// to copy. The old client-token flow needed BLOB_READ_WRITE_TOKEN, which
// was rejected ("Access denied") once the store was reconnected (4/11).
export async function POST(req: Request): Promise<NextResponse> {
  if (await rateLimited(`photos-upload:${clientIp(req)}`, 120, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many photo uploads — retry in a few minutes." },
      { status: 429 },
    );
  }
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Photo upload is not configured on the server (no Blob store connected)." },
      { status: 501 },
    );
  }
  let body: HandleUploadPresignedBody;
  try {
    body = (await req.json()) as HandleUploadPresignedBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const maximumSizeInBytes = 50 * 1024 * 1024; // every real photo fits; only stops storage abuse
    const allowedContentTypes = ["image/*"];
    const result = await handleUploadPresigned({
      body,
      request: req,
      getSignedToken: async (pathname) => {
        if (!pathname.startsWith("advenbook/originals/")) {
          throw new Error("Unexpected upload path.");
        }
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes,
          maximumSizeInBytes,
          validUntil: Date.now() + 15 * 60 * 1000,
        });
        return {
          token,
          urlOptions: { allowedContentTypes, maximumSizeInBytes, addRandomSuffix: false, allowOverwrite: true },
        };
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
