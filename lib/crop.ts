// Subject-safe crop geometry (M2): largest crop of a target ratio that
// contains the SAM subject box (expanded), clamped to the image.

export type Box = { x1: number; y1: number; x2: number; y2: number };
export type CropRect = { left: number; top: number; width: number; height: number };

export function computeCrop(
  box: Box | null,
  imgW: number,
  imgH: number,
  ratio = 1.5, // 3:2 print ratio
  expand = 0.18,
): CropRect {
  const bw = box ? box.x2 - box.x1 : imgW;
  const bh = box ? box.y2 - box.y1 : imgH;
  const cx = box ? (box.x1 + box.x2) / 2 : imgW / 2;
  const cy = box ? (box.y1 + box.y2) / 2 : imgH / 2;
  const needW = bw * (1 + expand * 2);
  const needH = bh * (1 + expand * 2);
  let w = Math.max(needW, needH * ratio);
  let h = w / ratio;
  if (h < needH) {
    h = needH;
    w = h * ratio;
  }
  // Never force the subject out: if subject is bigger than ratio allows,
  // fall back to the largest ratio crop containing its centre.
  w = Math.min(w, imgW);
  h = Math.min(h, imgH);
  if (w / h > ratio) w = h * ratio;
  else h = w / ratio;
  const left = Math.round(Math.min(Math.max(cx - w / 2, 0), imgW - w));
  const top = Math.round(Math.min(Math.max(cy - h / 2, 0), imgH - h));
  return { left, top, width: Math.round(w), height: Math.round(h) };
}
