// Pure payload-size helpers for photo requests (Vercel ~4.5 MB body cap).
// No browser APIs here so the logic is unit-testable in Node.

export const MAX_BODY_BYTES = 3 * 1024 * 1024;
export const MAX_PHOTO_DIM = 2400;
export const QUALITY_LADDER: readonly number[] = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25];

/** Approximate byte size of a data URL string (ASCII base64: 1 char ≈ 1 byte). */
export function dataUrlSize(dataUrl: string): number {
  return dataUrl.length;
}

export function fitsBody(sizeBytes: number, maxBytes: number = MAX_BODY_BYTES): boolean {
  return sizeBytes <= maxBytes;
}

/** Split images into consecutive batches whose cumulative data-URL size
 *  (+ a small per-image JSON overhead) stays under maxBytes. A single
 *  oversized image gets its own batch so callers can skip it alone. */
export function batchImagesBySize<T extends { dataUrl: string }>(
  images: readonly T[],
  maxBytes: number = MAX_BODY_BYTES,
  overheadPerImage = 256,
): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let currentSize = 0;
  for (const img of images) {
    const cost = dataUrlSize(img.dataUrl) + overheadPerImage;
    if (current.length > 0 && currentSize + cost > maxBytes) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(img);
    currentSize += cost;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** First candidate whose data URL fits; falls back to the smallest candidate. */
export function pickFittingCandidate<T extends { dataUrl: string }>(
  candidates: readonly T[],
  maxBytes: number = MAX_BODY_BYTES,
): T | undefined {
  for (const c of candidates) {
    if (fitsBody(dataUrlSize(c.dataUrl), maxBytes)) return c;
  }
  return candidates[candidates.length - 1];
}

export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false };

/** Parse a response body without ever leaking a raw SyntaxError message. */
export function parseJsonText(text: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

export const SELECT_BATCH_SIZE = 12;

/** Split into consecutive chunks of at most `size` items (order preserved). */
export function chunkItems<T>(items: readonly T[], size: number = SELECT_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  const n = Math.max(1, Math.floor(size) || 1);
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/** Safe Blob pathname for a direct browser upload (original, full quality). */
export function blobPathnameFor(id: string, fileName: string): string {
  const safeId = id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "photo";
  const base = fileName.split(/[\\/]/).pop() ?? "photo.jpg";
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 ? base.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10) : ".jpg";
  const stem = (dot > 0 ? base.slice(0, dot) : base)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "photo";
  return `advenbook/originals/${safeId}-${stem}${ext || ".jpg"}`;
}

/** Known-state line for photos dropped but not yet processed (null if none). */
export function pendingPhotosInstruction(pendingPhotos: number | undefined): string | null {
  if (!pendingPhotos || pendingPhotos <= 0) return null;
  return `Known state: ${pendingPhotos} photo(s) are waiting in the drop zone below, dropped by the user but not yet processed — you cannot see their content yet. If the user asks to use a photo (special page, full page, cover…), NEVER say you don't see any photo: answer in ONE line, in the user's language, telling them to tap "Use these photos in the book" below and that you will place them (a strong photo can get its own full page).`;
}

/** i18n key to show for a failed response, by HTTP status. */
export function errorKeyForStatus(status: number): "photoTooLarge" | "invalidResponse" {
  return status === 413 ? "photoTooLarge" : "invalidResponse";
}
