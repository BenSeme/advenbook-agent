import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/models";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // ~5 min at 16 kHz mono 16-bit, well under API limits

export async function POST(req: Request) {
  if (await rateLimited(`transcribe:${clientIp(req)}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many recordings — retry in a few minutes." }, { status: 429 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart audio." }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "No audio received." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Recording too long — keep it under a few minutes." },
      { status: 413 },
    );
  }
  try {
    const text = await transcribeAudio(await audio.arrayBuffer());
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed.";
    console.error("transcribe error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
