"use client";

import { fmtDistance, fmtElevation, t, type Lang } from "@/lib/i18n";
import type { DeviceKind } from "@/lib/i18n";
import type { ManualActivity, PhotoItem } from "@/lib/chat-types";

export type KnownDate = { id: string; title: string; date: string };

export function FilesPanel({
  lang,
  device,
  busy,
  photoBusy,
  manual,
  photos,
  photosOpen,
  known,
  onGpxFiles,
  onPhotoFiles,
  onRemoveManual,
  onCreateManual,
  onTogglePhotosOpen,
  onAssignPhoto,
  onPreparePhotos,
  onRemovePhoto,
  onClearPhotos,
}: {
  lang: Lang;
  device: DeviceKind;
  busy: boolean;
  photoBusy: boolean;
  manual: ManualActivity[];
  photos: PhotoItem[];
  photosOpen: boolean;
  known: KnownDate[];
  onGpxFiles: (files: FileList | null) => void;
  onPhotoFiles: (files: FileList | null) => void;
  onRemoveManual: (id: string) => void;
  onCreateManual: () => void;
  onTogglePhotosOpen: () => void;
  onAssignPhoto: (id: string, activityId: string) => void;
  onPreparePhotos: () => void;
  onRemovePhoto: (id: string) => void;
  onClearPhotos: () => void;
}) {
  const hint =
    device === "iphone"
      ? t(lang, "hintIPhone")
      : device === "android"
        ? t(lang, "hintAndroid")
        : t(lang, "hintDesktop");
  const shortHint =
    device === "iphone"
      ? lang === "en" ? "iPhone — Photos opens directly." : "iPhone — la photothèque s’ouvre directement."
      : device === "android"
        ? lang === "en" ? "Android — your gallery opens directly." : "Android — la galerie s’ouvre directement."
        : lang === "en" ? "Drop files here, or use the buttons." : "Glissez des fichiers ici, ou utilisez les boutons.";

  return (
    <section
      className="files-panel"
      aria-label="Ajouter GPX et photos"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        const gpx = files.filter((f) => f.name.toLowerCase().endsWith(".gpx"));
        const imgs = files.filter((f) => f.type.startsWith("image/"));
        if (gpx.length) {
          const dt = new DataTransfer();
          gpx.forEach((f) => dt.items.add(f));
          onGpxFiles(dt.files);
        }
        if (imgs.length) {
          const dt = new DataTransfer();
          imgs.forEach((f) => dt.items.add(f));
          onPhotoFiles(dt.files);
        }
      }}
    >
      <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--brand-muted)" }} title={hint}>
        {shortHint}
      </p>
      <div className="row" style={{ marginTop: 0 }}>
        <label className="btn secondary" style={{ cursor: "pointer" }}>
          {t(lang, "addGpx")}
          <input
            type="file"
            accept=".gpx"
            multiple
            hidden
            onChange={(e) => {
              onGpxFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <label className="btn secondary" style={{ cursor: "pointer" }}>
          {t(lang, "addPhotos")}
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              onPhotoFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {manual.length > 0 && (
          <button className="btn cta" disabled={busy} onClick={onCreateManual}>
            {t(lang, "createWithMine")} ({manual.length})
          </button>
        )}
      </div>
      {manual.map((a) => (
        <p key={a.id} style={{ margin: "8px 0 0", fontSize: 13 }}>
          <strong>{a.title}</strong> · {a.date} · {fmtDistance(a.distanceKm, lang)} · {fmtElevation(a.elevationGainM, lang)} · GPS OK
          <button
            className="btn secondary"
            style={{ marginLeft: 8, minHeight: 32, padding: "4px 10px" }}
            onClick={() => onRemoveManual(a.id)}
          >
            {t(lang, "remove")}
          </button>
        </p>
      ))}
      {photos.length > 0 && (
        <>
          <div className="photo-strip" aria-label="Photos ajoutées">
            {photos.map((p) => (
              <span key={p.id} style={{ position: "relative", flex: "none" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.thumb}
                  alt={p.name}
                  title={`${p.name} — ${p.kept === true ? "gardée" : p.kept === false ? "écartée" : "ajoutée"}${p.reason ? ` : ${p.reason}` : ""}`}
                />
                <button
                  type="button"
                  aria-label={`${t(lang, "remove")} ${p.name}`}
                  title={t(lang, "remove")}
                  onClick={() => onRemovePhoto(p.id)}
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: "1px solid var(--brand-line)",
                    background: "var(--brand-card)",
                    color: "var(--brand-ink)",
                    cursor: "pointer",
                    lineHeight: 1,
                    fontSize: 13,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <span style={{ fontSize: 13, alignSelf: "center" }}>
              {photos.length} photo(s)
              {photos.some((p) => p.kept) ? ` · ${photos.filter((p) => p.kept).length} gardée(s)` : ""}
            </span>
            <button
              className="btn secondary"
              style={{ minHeight: 36, padding: "6px 10px" }}
              onClick={onTogglePhotosOpen}
              aria-expanded={photosOpen}
            >
              {photosOpen ? "Masquer le détail" : "Détail / ranger"}
            </button>
            <button
              className="btn secondary"
              style={{ minHeight: 36, padding: "6px 10px" }}
              onClick={onClearPhotos}
            >
              {lang === "en" ? "Clear all" : "Tout retirer"}
            </button>
          </div>
          {photosOpen && (
            <div className="photo-grid">
              {photos.map((p) => (
                <figure key={p.id} className="photo-cell">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt={p.name} />
                  <figcaption>
                    {p.exifDate ?? "date inconnue"}
                    {p.kept === true ? " · gardée" : p.kept === false ? " · écartée" : ""}
                    {p.reason ? ` — ${p.reason}` : ""}
                    {p.status ? ` · ${p.status}` : ""}
                    <select
                      value={p.activityId}
                      onChange={(e) => onAssignPhoto(p.id, e.target.value)}
                      aria-label="Sortie de cette photo"
                    >
                      <option value="">Photo libre — l’agent la place tout seul</option>
                      {known.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.title} ({k.date})
                        </option>
                      ))}
                    </select>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          <div className="row">
            <button className="btn cta" disabled={photoBusy || busy} onClick={onPreparePhotos}>
              {photoBusy
                ? lang === "en" ? "Preparing…" : "Préparation en cours…"
                : lang === "en" ? "Use these photos in the book" : "Utiliser ces photos dans le livre"}
            </button>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--brand-muted)" }}>
            {lang === "en"
              ? "One tap: the AI keeps the best, crops them safely, sends them, and places free photos itself (attached, full page, or its own page)."
              : "Un seul toucher : l’IA garde les meilleures, les recadre sans couper le sujet, les envoie, et place elle-même les photos libres (rattachées, pleine page, ou page à part)."}
          </p>
        </>
      )}
    </section>
  );
}
