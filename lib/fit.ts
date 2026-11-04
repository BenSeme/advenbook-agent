// Garmin .fit parsing, browser-side (fit-file-parser). Lands in the
// same GpxActivity structure as GPX/TCX via activityFromPoints.
import FitParser from "fit-file-parser";
import { activityFromPoints, type GpxActivity, type Pt } from "./gpx.ts";

type FitRecord = {
  position_lat?: number;
  position_long?: number;
  altitude?: number;
  enhanced_altitude?: number;
  timestamp?: Date | string | number;
};

/** FIT stores positions in semicircles until the parser converts them;
 *  handle both (degrees pass through, semicircles are huge numbers). */
function toDegrees(v: number): number {
  return Math.abs(v) > 180 ? (v * 180) / 2 ** 31 : v;
}

function toIso(t: Date | string | number | undefined): string | undefined {
  if (t == null) return undefined;
  const d = t instanceof Date ? t : new Date(t);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function parseFit(buffer: ArrayBuffer, titleHint?: string): Promise<GpxActivity> {
  const parser = new FitParser({ force: true, lengthUnit: "m", speedUnit: "m/s" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await parser.parseAsync(buffer)) as any;
  const records: FitRecord[] = Array.isArray(data?.records) ? data.records : [];
  const points: Pt[] = [];
  for (const r of records) {
    if (typeof r.position_lat !== "number" || typeof r.position_long !== "number") continue;
    points.push({
      lat: toDegrees(r.position_lat),
      lon: toDegrees(r.position_long),
      ele: typeof r.altitude === "number" ? r.altitude : r.enhanced_altitude,
      time: toIso(r.timestamp),
    });
  }
  if (points.length < 2) throw new Error("FIT sans trace GPS exploitable (records).");
  const session = Array.isArray(data?.sessions) ? data.sessions[0] : undefined;
  const sport = typeof session?.sport === "string" ? session.sport : undefined;
  const title =
    (typeof titleHint === "string" && titleHint.replace(/\.(fit)$/i, "").trim()) ||
    (sport ? `Sortie ${sport}` : "Sortie Garmin");
  return activityFromPoints(title, points, {
    sport,
    distanceKm:
      typeof session?.total_distance === "number" ? session.total_distance / 1000 : undefined,
    elevationGainM:
      typeof session?.total_ascent === "number" ? session.total_ascent : undefined,
    durationSec:
      typeof session?.total_timer_time === "number"
        ? session.total_timer_time
        : typeof session?.total_elapsed_time === "number"
          ? session.total_elapsed_time
          : undefined,
  });
}
