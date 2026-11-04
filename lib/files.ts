// Browser file helpers for GPX/photo drops.
// Photos are NOT sent through our API routes as data URLs: they are
// uploaded straight from the browser to Vercel Blob (full quality) and
// only their public URL travels onwards (see app/page.tsx preparePhotos).

/** Downscaled JPEG data URL (small previews), with a FileReader fallback. */
export async function fileToDataUrl(file: File, maxDim = 900): Promise<string> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return fullDataUrl(file);
  }
}

/** Full-resolution data URL read locally (no network, no size cap). */
export function fullDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
