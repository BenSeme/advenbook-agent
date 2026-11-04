// Minimal GPX parsing for user-dropped files (M2, no-Strava path).
// Pure functions — unit-tested in test/gpx.test.mjs.

export type GpxActivity = {
  title: string;
  date: string;
  distanceKm: number;
  elevationGainM: number;
  duration: string;
  polyline: string;
  pointCount: number;
  sport?: string;
  /** Public photo URLs already attached (e.g. Komoot cover images). */
  photoUrls?: string[];
  /** Book data_source for this outing: "gpx_files" (default) or "other" (Komoot). */
  source?: "gpx_files" | "other";
};

export type Pt = { lat: number; lon: number; ele?: number; time?: string };
/** Backwards-friendly alias: one GPS point of a track. */
export type TrackPoint = Pt;

function haversineKm(a: Pt, b: Pt): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Google encoded polyline (precision 5), input downsampled by caller. */
export function encodePolyline(points: Pt[]): string {
  let out = "";
  let prevLat = 0;
  let prevLon = 0;
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
  };
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lon = Math.round(p.lon * 1e5);
    out += enc(lat - prevLat) + enc(lon - prevLon);
    prevLat = lat;
    prevLon = lon;
  }
  return out;
}

export function formatDurationSeconds(totalSec: number): string {
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}min${String(sec).padStart(2, "0")}s` : `${m}min${String(sec).padStart(2, "0")}s`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}min${String(s).padStart(2, "0")}s` : `${m}min${String(s).padStart(2, "0")}s`;
}

export function parseGpx(xml: string): GpxActivity {
  const nameMatch = xml.match(/<name>([^<]+)<\/name>/);
  const title = nameMatch ? nameMatch[1].trim() : "Sortie GPX";
  const points: Pt[] = [];
  const re = /<trkpt[^>]*lat="([\d.-]+)"[^>]*lon="([\d.-]+)"[^>]*>([\s\S]*?)<\/trkpt>|<trkpt[^>]*lat="([\d.-]+)"[^>]*lon="([\d.-]+)"[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const lat = parseFloat(m[1] ?? m[4]);
    const lon = parseFloat(m[2] ?? m[5]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const inner = m[3] ?? "";
    const ele = inner.match(/<ele>([\d.-]+)<\/ele>/);
    const time = inner.match(/<time>([^<]+)<\/time>/);
    points.push({
      lat,
      lon,
      ele: ele ? parseFloat(ele[1]) : undefined,
      time: time ? time[1] : undefined,
    });
  }
  if (points.length < 2) throw new Error("GPX sans trace exploitable (trkpt).");
  return activityFromPoints(title, points);
}

/** Shared builder: every track format (GPX, TCX, FIT, Komoot) lands here. */
export function activityFromPoints(
  title: string,
  points: Pt[],
  opts?: {
    sport?: string;
    distanceKm?: number;
    elevationGainM?: number;
    durationSec?: number;
    date?: string;
    source?: "gpx_files" | "other";
    photoUrls?: string[];
  },
): GpxActivity {
  if (points.length < 2) throw new Error("Trace sans points GPS exploitables.");
  let distanceKm = 0;
  let elevationGainM = 0;
  for (let i = 1; i < points.length; i++) {
    distanceKm += haversineKm(points[i - 1], points[i]);
    const dEle = (points[i].ele ?? 0) - (points[i - 1].ele ?? 0);
    if (points[i].ele != null && points[i - 1].ele != null && dEle > 0) {
      elevationGainM += dEle;
    }
  }
  const times = points.map((p) => p.time).filter(Boolean) as string[];
  const date =
    opts?.date ?? (times.length ? times[0].slice(0, 10) : new Date().toISOString().slice(0, 10));
  const duration =
    opts?.durationSec != null
      ? formatDurationSeconds(opts.durationSec)
      : times.length > 1
        ? formatDuration(new Date(times[times.length - 1]).getTime() - new Date(times[0]).getTime())
        : "";
  // Downsample so the polyline stays comfortably under MCP field limits.
  const maxPts = 400;
  const step = Math.max(1, Math.floor(points.length / maxPts));
  const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  return {
    title: title.trim() || "Sortie",
    date,
    distanceKm:
      opts?.distanceKm != null ? Math.round(opts.distanceKm * 10) / 10 : Math.round(distanceKm * 10) / 10,
    elevationGainM:
      opts?.elevationGainM != null ? Math.round(opts.elevationGainM) : Math.round(elevationGainM),
    duration,
    polyline: encodePolyline(sampled),
    pointCount: points.length,
    ...(opts?.sport ? { sport: opts.sport } : {}),
    ...(opts?.source ? { source: opts.source } : {}),
    ...(opts?.photoUrls?.length ? { photoUrls: opts.photoUrls } : {}),
  };
}

function tagText(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
  return m ? m[1].trim() : undefined;
}

/** Garmin Connect TCX export: Trackpoint Latitude/Longitude/Altitude/Time. */
export function parseTcx(xml: string): GpxActivity {
  const sport = xml.match(/<Activity[^>]*\bSport="([^"]+)"/i)?.[1];
  const name = tagText(xml, "Name");
  const title = name && !/^\d{4}-\d{2}-\d{2}/.test(name) ? name : sport ? `Sortie ${sport}` : "Sortie TCX";
  const points: Pt[] = [];
  const re = /<Trackpoint>([\s\S]*?)<\/Trackpoint>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const lat = parseFloat(tagText(block, "LatitudeDegrees") ?? "");
    const lon = parseFloat(tagText(block, "LongitudeDegrees") ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const alt = tagText(block, "AltitudeMeters");
    points.push({
      lat,
      lon,
      ele: alt != null ? parseFloat(alt) : undefined,
      time: tagText(block, "Time"),
    });
  }
  if (points.length < 2) throw new Error("TCX sans trace exploitable (Trackpoint).");
  return activityFromPoints(title, points, { sport });
}
