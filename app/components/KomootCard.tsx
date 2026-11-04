"use client";

import { useState } from "react";
import { fmtDistance, fmtElevation, t, type Lang } from "@/lib/i18n";
import type { UiEvent } from "@/lib/chat-types";

type KomootEvent = Extract<UiEvent, { kind: "komoot" }>;

export function KomootCard({
  e,
  lang,
  busy,
  onImport,
}: {
  e: KomootEvent;
  lang: Lang;
  busy: boolean;
  onImport: (tourIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(e.tours.map((tour) => [tour.id, true])),
  );
  const chosen = e.tours.filter((tour) => selected[tour.id]);
  return (
    <div className="card">
      <h2>{lang === "en" ? "Your Komoot outings" : "Vos sorties Komoot"}</h2>
      <p style={{ margin: "0 0 6px", fontSize: 14 }}>
        <strong>
          {chosen.length} {t(lang, "ticked")}
        </strong>{" "}
        {t(lang, "on")} {e.tours.length}
      </p>
      {e.tours.map((tour) => (
        <label className="check" key={tour.id}>
          <input
            type="checkbox"
            checked={!!selected[tour.id]}
            onChange={(ev) => setSelected((s) => ({ ...s, [tour.id]: ev.target.checked }))}
          />
          <span>
            {tour.title}
            <small>
              {tour.date}
              {tour.sport ? ` · ${tour.sport}` : ""}
              {tour.distance_km != null ? ` · ${fmtDistance(tour.distance_km, lang)}` : ""}
              {tour.elevation_gain_m != null ? ` · ${fmtElevation(tour.elevation_gain_m, lang)}` : ""}
            </small>
          </span>
        </label>
      ))}
      <div className="row">
        <button
          className="btn"
          disabled={busy || chosen.length === 0}
          onClick={() => onImport(chosen.map((tour) => tour.id))}
        >
          {lang === "en" ? `Import selected (${chosen.length})` : `Importer la sélection (${chosen.length})`}
        </button>
      </div>
    </div>
  );
}
