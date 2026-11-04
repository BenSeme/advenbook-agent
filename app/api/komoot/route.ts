import { NextResponse } from "next/server";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { logError } from "@/lib/monitor";
import {
  komootCoverUrls,
  komootTourMeta,
  komootTourToActivity,
  parseKomootUrl,
  type KomootCoord,
} from "@/lib/komoot";
import type { GpxActivity } from "@/lib/gpx";

export const runtime = "nodejs";
export const maxDuration = 60;

const BASE = "https://api.komoot.de/v007";
const HEADERS = {
  "User-Agent": "AdvenBookAgent/1.0 (+https://agent.advenbook.com)",
  Accept: "application/hal+json, application/json",
};

const PRIVATE_MSG =
  "Ce tour Komoot est privé : rendez-le public ou utilisez son lien de partage, ou téléchargez son GPX depuis Komoot et déposez-le ici. / This Komoot tour is private: make it public or use its share link, or download its GPX from Komoot and drop it here.";

// At most 5 Komoot requests per second: space calls >=200 ms apart.
let nextSlot = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const start = Math.max(now, nextSlot);
  nextSlot = start + 200;
  if (start > now) await new Promise((r) => setTimeout(r, start - now));
}

class KomootError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function komootGet(path: string): Promise<Record<string, unknown>> {
  await throttle();
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (res.status === 401 || res.status === 403) {
    throw new KomootError(PRIVATE_MSG, 403);
  }
  if (!res.ok) throw new KomootError(`Komoot a répondu ${res.status}.`, 502);
  return (await res.json()) as Record<string, unknown>;
}

function embedded(rec: Record<string, unknown>): Record<string, unknown> {
  return typeof rec._embedded === "object" && rec._embedded !== null
    ? (rec._embedded as Record<string, unknown>)
    : {};
}

function withToken(path: string, shareToken?: string): string {
  if (!shareToken) return path;
  return `${path}${path.includes("?") ? "&" : "?"}share_token=${encodeURIComponent(shareToken)}`;
}

async function fetchTour(id: string, shareToken?: string): Promise<GpxActivity> {
  const tour = await komootGet(withToken(`/tours/${encodeURIComponent(id)}?_embedded=coordinates`, shareToken));
  const coordsRaw = embedded(tour).coordinates;
  const items =
    typeof coordsRaw === "object" && coordsRaw !== null && Array.isArray((coordsRaw as { items?: unknown }).items)
      ? ((coordsRaw as { items: unknown[] }).items as KomootCoord[])
      : [];
  let photoUrls: string[] = [];
  try {
    const photos = await komootGet(withToken(`/tours/${encodeURIComponent(id)}/cover_images/?limit=100`, shareToken));
    photoUrls = komootCoverUrls(embedded(photos).items);
  } catch (err) {
    if (err instanceof KomootError && err.status === 403) throw err;
    photoUrls = []; // photos are a bonus; the outing itself still imports
  }
  return komootTourToActivity(tour as Parameters<typeof komootTourToActivity>[0], items, photoUrls);
}

async function resolveShortLink(raw: string): Promise<string> {
  try {
    const res = await fetch(raw, { headers: HEADERS, redirect: "follow" });
    return res.url || raw;
  } catch {
    return raw;
  }
}

export async function POST(req: Request) {
  // 200 Komoot imports per visitor (IP) per day.
  if (await rateLimited(`komoot:${clientIp(req)}`, 200, 24 * 3600 * 1000)) {
    return NextResponse.json(
      { error: "Limite Komoot du jour atteinte — réessayez demain. / Daily Komoot limit reached — please retry tomorrow." },
      { status: 429 },
    );
  }
  let body: { url?: unknown; tourIds?: unknown; shareToken?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const shareToken = typeof body.shareToken === "string" ? body.shareToken : undefined;
  try {
    // Import already-ticked profile tours.
    if (Array.isArray(body.tourIds)) {
      const ids = body.tourIds.filter((x): x is string => typeof x === "string").slice(0, 50);
      if (ids.length === 0) return NextResponse.json({ error: "No tour selected." }, { status: 400 });
      const outings: GpxActivity[] = [];
      for (const id of ids) outings.push(await fetchTour(id, shareToken));
      return NextResponse.json({ mode: "tours", outings });
    }

    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
    if (!rawUrl) return NextResponse.json({ error: "Missing Komoot link." }, { status: 400 });
    let link = parseKomootUrl(rawUrl);
    if (!link && /komoot\.(com|de)/i.test(rawUrl)) {
      link = parseKomootUrl(await resolveShortLink(rawUrl));
    }
    if (!link) {
      return NextResponse.json(
        { error: "Lien Komoot non reconnu : collez un lien de tour (komoot.com/tour/…) ou de profil public (komoot.com/user/…). / Unrecognised Komoot link: paste a tour link or a public profile link." },
        { status: 400 },
      );
    }
    if (link.type === "tour") {
      const outing = await fetchTour(link.id, link.shareToken);
      return NextResponse.json({ mode: "tour", outings: [outing] });
    }
    // Public profile: up to 4 pages of recorded public tours.
    const tours: ReturnType<typeof komootTourMeta>[] = [];
    for (let page = 0; page < 4; page++) {
      const data = await komootGet(
        `/users/${encodeURIComponent(link.userId)}/tours/?type=tour_recorded&status=public&sort_field=date&sort_direction=desc&limit=50&page=${page}`,
      );
      const list = embedded(data).tours;
      if (!Array.isArray(list) || list.length === 0) break;
      for (const t of list) tours.push(komootTourMeta(t as Parameters<typeof komootTourMeta>[0]));
      if (list.length < 50) break;
    }
    if (tours.length === 0) {
      return NextResponse.json(
        { error: "Aucune sortie publique trouvée sur ce profil Komoot. / No public outings found on this Komoot profile." },
        { status: 404 },
      );
    }
    return NextResponse.json({ mode: "profile", tours });
  } catch (err) {
    if (err instanceof KomootError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logError("komoot", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Komoot import failed." },
      { status: 502 },
    );
  }
}
