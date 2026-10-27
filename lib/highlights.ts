// Highlight detection for the selection checklist: outings worth showing
// off in the book (many photos, a race, a scenic route, a big climb).
// Pure functions over the fields list_strava_activities returns.

export type HighlightActivity = {
  title: string;
  date: string;
  sport?: string;
  distance_km?: number;
  elevation_gain_m?: number;
  photos?: number;
  has_route?: boolean;
  is_race?: boolean;
  [key: string]: unknown;
};

export function activityBadges(a: HighlightActivity): string[] {
  const badges: string[] = [];
  if (typeof a.photos === "number" && a.photos >= 3) {
    badges.push(`${a.photos} photos`);
  }
  if (a.is_race) badges.push("Course officielle");
  if (a.has_route && (a.elevation_gain_m ?? 0) >= 800) {
    badges.push("Beau tracé");
  }
  if ((a.elevation_gain_m ?? 0) >= 1500) badges.push("Gros dénivelé");
  if ((a.distance_km ?? 0) >= 80) badges.push("Longue distance");
  return badges;
}

/** Worth putting forward: at least two signals, or photos, or a race. */
export function isHighlight(a: HighlightActivity): boolean {
  return (
    activityBadges(a).length >= 2 ||
    (typeof a.photos === "number" && a.photos >= 5) ||
    Boolean(a.is_race)
  );
}
