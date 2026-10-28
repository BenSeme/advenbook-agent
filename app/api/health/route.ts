import { NextResponse } from "next/server";
import { listMcpTools } from "@/lib/mcp";

export const runtime = "nodejs";

// Liveness + dependency check for uptime monitors (e.g. UptimeRobot free
// tier pinging every 5 min). No secrets, no counts, just booleans.
export async function GET() {
  let mcp = false;
  try {
    mcp = (await listMcpTools()).length > 0;
  } catch {
    mcp = false;
  }
  const checks = {
    mcp,
    modelConfigured: Boolean(process.env.MODEL_API_KEY),
    blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    sharedKvStore: Boolean(
      (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL) &&
        (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN),
    ),
    turnstileConfigured: Boolean(process.env.TURNSTILE_SECRET_KEY),
    alertWebhookConfigured: Boolean(process.env.ALERT_WEBHOOK_URL),
  };
  const ok = checks.mcp && checks.modelConfigured;
  return NextResponse.json(
    { ok, at: new Date().toISOString(), checks },
    { status: ok ? 200 : 503 },
  );
}
