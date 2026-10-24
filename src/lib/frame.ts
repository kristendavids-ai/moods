import { FULL, type PhotoKind, type Rect } from "../types";

export const WORN_ASPECT = 4 / 5;
const DISPLAY_EDGE = 1400;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function clampRect(r: Rect): Rect {
  const x = clamp01(r.x);
  const y = clamp01(r.y);
  return { x, y, w: Math.min(1 - x, Math.max(0.02, r.w)), h: Math.min(1 - y, Math.max(0.02, r.h)) };
}

export async function imageSize(blob: Blob): Promise<{ w: number; h: number }> {
  const bmp = await createImageBitmap(blob);
  const size = { w: bmp.width, h: bmp.height };
  bmp.close();
  return size;
}

/**
 * Product shots often sit on a light grey studio sweep. Lifting a plain, light
 * background to pure white lets it vanish into the plate (the board multiplies
 * images onto it), so every item floats on the same ground.
 */
function whitenBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const ring: number[][] = [];
  const step = Math.max(1, Math.round((w + h) / 400));
  const push = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    ring.push([px[i], px[i + 1], px[i + 2]]);
  };
  for (let x = 0; x < w; x += step) push(x, 0), push(x, h - 1);
  for (let y = 0; y < h; y += step) push(0, y), push(w - 1, y);
  const med = [0, 1, 2].map((c) => ring.map((p) => p[c]).sort((a, b) => a - b)[ring.length >> 1]);
  const plain = ring.filter((p) => Math.abs(p[0] - med[0]) + Math.abs(p[1] - med[1]) + Math.abs(p[2] - med[2]) < 24);
  if (plain.length < ring.length * 0.7 || Math.min(...med) < 200 || Math.max(...med) - Math.min(...med) > 18) return;
  const gain = med.map((v) => 255 / v);
  if (gain.every((g) => g < 1.005)) return;
  for (let i = 0; i < px.length; i += 4) {
    px[i] = Math.min(255, px[i] * gain[0]);
    px[i + 1] = Math.min(255, px[i + 1] * gain[1]);
    px[i + 2] = Math.min(255, px[i + 2] * gain[2]);
  }
  ctx.putImageData(img, 0, 0);
}

/** Renders the cropped region as the display image. */
export async function cropToBlob(orig: Blob, rect: Rect, kind: PhotoKind): Promise<Blob> {
  const bmp = await createImageBitmap(orig);
  const sx = rect.x * bmp.width;
  const sy = rect.y * bmp.height;
  const sw = rect.w * bmp.width;
  const sh = rect.h * bmp.height;
  const scale = Math.min(1, DISPLAY_EDGE / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: kind === "item" })!;
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bmp.close();
  if (kind === "item") whitenBackground(ctx, canvas.width, canvas.height);
  const webp = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.88));
  if (webp && webp.type === "image/webp") return webp;
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.88),
  );
}

/** Largest 4:5 frame inside `r`, centred across and biased upward (heads matter more than shoes). */
export function fitAspect(r: Rect, imgW: number, imgH: number, aspect = WORN_ASPECT): Rect {
  const rw = r.w * imgW;
  const rh = r.h * imgH;
  let w = rw;
  let h = rh;
  if (rw / rh > aspect) w = rh * aspect;
  else h = rw / aspect;
  return clampRect({
    x: (r.x * imgW + (rw - w) / 2) / imgW,
    y: (r.y * imgH + (rh - h) * 0.3) / imgH,
    w: w / imgW,
    h: h / imgH,
  });
}

/** Resizes `r` to `aspect` around its centre, staying inside the image. */
export function lockAspect(r: Rect, imgW: number, imgH: number, aspect = WORN_ASPECT): Rect {
  const cx = (r.x + r.w / 2) * imgW;
  const cy = (r.y + r.h / 2) * imgH;
  let w = r.w * imgW;
  let h = w / aspect;
  if (h > imgH) {
    h = imgH;
    w = h * aspect;
  }
  if (w > imgW) {
    w = imgW;
    h = w / aspect;
  }
  const x = Math.min(Math.max(0, cx - w / 2), imgW - w);
  const y = Math.min(Math.max(0, cy - h / 2), imgH - h);
  return { x: x / imgW, y: y / imgH, w: w / imgW, h: h / imgH };
}

/**
 * Shrinks a rough product box to the garment's actual edges by trimming rows and
 * columns that match the plain studio background, then adds a little air.
 */
export async function refineTight(orig: Blob, r: Rect): Promise<Rect> {
  const bmp = await createImageBitmap(orig);
  const scale = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
  const W = Math.round(bmp.width * scale);
  const H = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, W, H);
  bmp.close();

  const x0 = Math.floor(r.x * W);
  const y0 = Math.floor(r.y * H);
  const x1 = Math.min(W, Math.ceil((r.x + r.w) * W));
  const y1 = Math.min(H, Math.ceil((r.y + r.h) * H));
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (bw < 8 || bh < 8) return r;
  const px = ctx.getImageData(x0, y0, bw, bh).data;
  const at = (x: number, y: number) => (y * bw + x) * 4;

  // Background = median colour of the box's border ring.
  const ring: number[][] = [];
  for (let x = 0; x < bw; x++) ring.push([...px.slice(at(x, 0), at(x, 0) + 3)], [...px.slice(at(x, bh - 1), at(x, bh - 1) + 3)]);
  for (let y = 0; y < bh; y++) ring.push([...px.slice(at(0, y), at(0, y) + 3)], [...px.slice(at(bw - 1, y), at(bw - 1, y) + 3)]);
  const med = [0, 1, 2].map((c) => ring.map((p) => p[c]).sort((a, b) => a - b)[ring.length >> 1]);
  // A noisy border means a photographic background; trimming would eat into it.
  const noisy = ring.filter((p) => Math.abs(p[0] - med[0]) + Math.abs(p[1] - med[1]) + Math.abs(p[2] - med[2]) > 36).length;
  if (noisy > ring.length * 0.25) return r;

  const isFg = (i: number) => Math.abs(px[i] - med[0]) + Math.abs(px[i + 1] - med[1]) + Math.abs(px[i + 2] - med[2]) > 42;
  const rows = new Array(bh).fill(0);
  const cols = new Array(bw).fill(0);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++)
      if (isFg(at(x, y))) {
        rows[y]++;
        cols[x]++;
      }
  const rowMin = Math.max(2, bw * 0.01);
  const colMin = Math.max(2, bh * 0.01);
  const top = rows.findIndex((n) => n >= rowMin);
  const bottom = bh - 1 - [...rows].reverse().findIndex((n) => n >= rowMin);
  const left = cols.findIndex((n) => n >= colMin);
  const right = bw - 1 - [...cols].reverse().findIndex((n) => n >= colMin);
  if (top < 0 || left < 0 || bottom <= top || right <= left) return r;
  if ((bottom - top) * (right - left) < bw * bh * 0.08) return r; // trimmed away too much: distrust it

  const pad = Math.max(bottom - top, right - left) * 0.04;
  return clampRect({
    x: (x0 + left - pad) / W,
    y: (y0 + top - pad) / H,
    w: (right - left + 2 * pad) / W,
    h: (bottom - top + 2 * pad) / H,
  });
}

/** Turns Claude's rough box into the saved crop for that kind of photo. */
export async function autoCrop(orig: Blob, kind: PhotoKind, box?: Rect): Promise<Rect> {
  const { w, h } = await imageSize(orig);
  if (kind === "worn") return fitAspect(box ?? FULL, w, h);
  if (!box) return FULL;
  const grown = clampRect({ x: box.x - 0.015, y: box.y - 0.015, w: box.w + 0.03, h: box.h + 0.03 });
  return refineTight(orig, grown);
}
