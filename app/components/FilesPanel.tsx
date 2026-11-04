"use client";

import { useState } from "react";
import { fmtDistance, fmtElevation, t, type Lang } from "@/lib/i18n";
import type { DeviceKind } from "@/lib/i18n";
import type { ManualActivity, PhotoItem } from "@/lib/chat-types";

export type KnownDate = { id: string; title: string; date: string };

const TRACK_EXT = [".gpx", ".tcx", ".fit"];
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".heic", ".webp"];

export function isTrackFile(f: File): boolean {
  const n = f.name.toLowerCase();
  return TRACK_EXT.some((e) => n.endsWith(e));
}
export function isImageFile(f: File): boolean {
  const n = f.name.toLowerCase();
  return f.type.startsWith("image/") || IMAGE_EXT.some((e) => n.endsWith(e));
}

type FsEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (ok: (f: File) => void, err?: (e: unknown) => void) => void;
  createReader?: () => { readEntries: (ok: (e: FsEntry[]) => void, err?: (e: unknown) => void) => void };
};

/** Recursively read a dropped folder (webkit entries), max 300 files. */
async function collectDroppedFiles(dt: DataTransfer): Promise<File[]> {
  const items = Array.from(dt.items ?? []).filter((i) => i.kind === "file");
  const entries = items
    .map((i) => (typeof i.webkitGetAsEntry === "function" ? i.webkitGetAsEntry() : null))
    .filter((e): e is NonNullable<typeof e> => Boolean(e)) as unknown as FsEntry[];
  if (entries.length === 0) return Array.from(dt.files).slice(0, 300);
  const out: File[] = [];
  async function walk(entry: FsEntry): Promise<void> {
    if (out.length >= 300) return;
    if (entry.isFile && entry.file) {
      const f = await new Promise<File | null>((res) => entry.file?.(res, () => res(null)));
      if (f) out.push(f);
      return;
    }
    if (entry.isDirectory && entry.createReader) {
      const reader = entry.createReader();
      for (;;) {
        const batch = await new Promise<FsEntry[]>((res) => reader.readEntries(res, () => res([])));
        if (batch.length === 0) break;
        for (const child of batch) {
          await walk(child);
          if (out.length >= 300) return;
        }
      }
    }
  }
  for (const e of entries) await walk(e);
  return out.slice(0, 300);
}

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
  onFolderFiles,
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
  onGpxFiles: (files: FileList | File[] | null) => void;
  onPhotoFiles: (files: FileList | File[] | null) => void;
  onFolderFiles?: (files: File[]) => void;
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
  const [foundLine, setFoundLine] = useState<string | null>(null);
  function dispatchFiles(files: File[]) {
    const capped = files.slice(0, 300);
    const tracks = capped.filter(isTrackFile);
    const imgs = capped.filter(isImageFile);
    if (tracks.length || imgs.length) {
      setFoundLine(
        lang === "en"
          ? `Found ${tracks.length} outings and ${imgs.length} photos`
          : `Trouvé ${tracks.length} sortie(s) et ${imgs.length} photo(s)`,
      );
    }
    if (onFolderFiles) {
      onFolderFiles(capped);
      return;
    }
    if (tracks.length) onGpxFiles(tracks);
    if (imgs.length) onPhotoFiles(imgs);
  }
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
        void collectDroppedFiles(e.dataTransfer).then(dispatchFiles);
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
            accept=".gpx,.tcx,.fit"
            multiple
            hidden
            onChange={(e) => {
              onGpxFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <label className="btn secondary" style={{ cursor: "pointer" }}>
          {t(lang, "chooseFolder")}
          <input
            type="file"
            multiple
            hidden
            ref={(el) => {
              el?.setAttribute("webkitdirectory", "");
            }}
            onChange={(e) => {
              dispatchFiles(Array.from(e.target.files ?? []));
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
      {foundLine && (
        <p style={{ margin: "8px 0 0", fontSize: 13 }} role="status">
          {foundLine}
        </p>
      )}
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
