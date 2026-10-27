// The confirmed-selection guarantee, kept pure for unit tests.

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

/** A book can only contain outings the user confirmed. Activities
 *  without a Strava id (typed list / GPX) are left untouched. */
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
