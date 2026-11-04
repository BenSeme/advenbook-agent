// Komoot public-API helpers (pure parts; the network calls live in
// app/api/komoot/route.ts). A Komoot tour lands in the same outing
// structure as a GPX file (lib/gpx.ts), with data_source "other".
import { activityFromPoints, formatDurationSeconds, type GpxActivity, type Pt } from "./gpx.ts";

export type KomootLink =
  | { type: "tour"; id: string; shareToken?: string }
  | { type: "profile"; userId: string };

export type KomootTourMeta = {
  id: string;
  title: string;
  date: string;
  sport?: string;
  distance_km?: number;
  elevation_gain_m?: number;
  duration?: string;
};

/** Parse a pasted Komoot link (tour, share or public profile). */
export function parseKomootUrl(raw: string): KomootLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)komoot\.(com|de)$/i.test(url.hostname)) return null;
  const shareToken = url.searchParams.get("share_token") ?? undefined;
  const tour = url.pathname.match(/\/(?:tour|smarttour)\/(\d+)/i);
  if (tour) return { type: "tour", id: tour[1], ...(shareToken ? { shareToken } : {}) };
  const user = url.pathname.match(/\/user\/([\w-]+)/i);
  if (user) return { type: "profile", userId: user[1] };
  return null;
}

export type KomootCoord = { lat: number; lng: number; alt?: number; t?: number };

type KomootTour = {
  id?: number | string;
  name?: string;
  date?: string;
  start_date?: string;
  sport?: string;
  distance?: number;
  elevation_up?: number;
  duration?: number;
};

function tourDate(tour: KomootTour): string {
  const raw = tour.date ?? tour.start_date ?? "";
  return raw ? raw.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

export function komootTourMeta(tour: KomootTour): KomootTourMeta {
  return {
    id: String(tour.id ?? ""),
    title: tour.name ?? "Sortie Komoot",
    date: tourDate(tour),
    ...(tour.sport ? { sport: tour.sport } : {}),
    ...(typeof tour.distance === "number" ? { distance_km: Math.round(tour.distance / 100) / 10 } : {}),
    ...(typeof tour.elevation_up === "number" ? { elevation_gain_m: Math.round(tour.elevation_up) } : {}),
    ...(typeof tour.duration === "number" ? { duration: formatDurationSeconds(tour.duration) } : {}),
  };
}

/** Convert one Komoot tour + its coordinates to the shared outing shape. */
export function komootTourToActivity(
  tour: KomootTour,
  coords: KomootCoord[],
  photoUrls: string[] = [],
): GpxActivity {
  const startIso = tour.date ?? tour.start_date ?? new Date().toISOString();
  const startMs = new Date(startIso).getTime();
  const points: Pt[] = coords
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
    .map((c) => ({
      lat: c.lat,
      lon: c.lng,
      ele: typeof c.alt === "number" ? c.alt : undefined,
      time: Number.isFinite(startMs)
        ? new Date(startMs + (typeof c.t === "number" ? c.t : 0)).toISOString()
        : undefined,
    }));
  if (points.length < 2) throw new Error("Komoot tour without usable coordinates.");
  return activityFromPoints(tour.name ?? "Sortie Komoot", points, {
    sport: tour.sport,
    distanceKm: typeof tour.distance === "number" ? tour.distance / 1000 : undefined,
    elevationGainM: typeof tour.elevation_up === "number" ? tour.elevation_up : undefined,
    durationSec: typeof tour.duration === "number" ? tour.duration : undefined,
    date: tourDate(tour),
    source: "other",
    photoUrls,
  });
}

/** Cover-image `src` template -> 1600px URLs, at most 20 per tour. */
export function komootCoverUrls(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const urls: string[] = [];
  for (const item of items) {
    const src =
      typeof item === "object" && item !== null
        ? (item as { src?: unknown }).src
        : undefined;
    if (typeof src !== "string" || !src) continue;
    urls.push(
      src
        .replace("{width}", "1600")
        .replace("{height}", "1600")
        .replace("{crop}", "false"),
    );
    if (urls.length >= 20) break;
  }
  return urls;
}
