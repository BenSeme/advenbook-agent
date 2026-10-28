// The confirmed-selection guarantee, kept pure for unit tests.

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

/** A book can only contain outings the user confirmed. Activities
 *  without a Strava id (typed list / GPX) are left untouched. */
/** Split a confirmed list into chronological volumes of at most `max`. */
export function chunkVolumes<T>(items: T[], max: number): T[][] {
  const size = Number.isFinite(max) && max > 0 ? Math.floor(max) : items.length || 1;
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function filterToConfirmed(
  activities: unknown[],
  confirmedIds: string[] | undefined,
): unknown[] {
  if (!confirmedIds || confirmedIds.length === 0) return activities;
  const allowed = new Set(confirmedIds);
  return activities.filter((a) => {
    const id = asRecord(a).strava_activity_id;
    return typeof id !== "string" || allowed.has(id);
  });
}
