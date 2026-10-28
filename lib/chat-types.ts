// Shared chat/UI types (page, cards, files panel).
import type { GpxActivity } from "./gpx";

export type Activity = {
  strava_activity_id: string;
  title: string;
  date: string;
  sport?: string;
  distance_km?: number;
  elevation_gain_m?: number;
  photos?: number;
  has_route?: boolean;
  is_race?: boolean;
};

export type UiEvent =
  | { kind: "connect"; connectUrl: string; connectionId: string }
  | { kind: "activities"; activities: Activity[] }
  | {
      kind: "cover";
      title: string;
      photos: { id: string; thumb: string; url: string }[];
    }
  | {
      kind: "book";
      bookId: string;
      claimUrl: string;
      editorUrl?: string;
      orderUrl?: string;
      estimatedPages?: number;
      price?: unknown;
    };

export type Msg = {
  role: "user" | "assistant";
  content: string;
  display?: string;
  ui?: UiEvent[];
};

export type ManualActivity = GpxActivity & { id: string };

export type PhotoItem = {
  id: string;
  name: string;
  thumb: string;
  exifDate: string | null;
  activityId: string;
  kept: boolean | null;
  reason?: string;
  uploadedUrl?: string;
  status?: string;
};
