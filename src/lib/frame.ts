import { FULL, type FrameMode, type PhotoKind, type Rect } from "../types";
import { encodeHQ } from "./image";

export const ASPECT = 4 / 5;
/** In a composed product shot the garment fills this share of whichever side binds. */
export const COMPOSE_FILL = 0.82;
const MAX_OUT = 2400;

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

/** Studio-background test: light and near-neutral (white page, grey product plate, soft sweep). */
const isBg = (px: ArrayLike<number>, i: number) => {
  const mn = Math.min(px[i], px[i + 1], px[i + 2]);
  return mn >= 226 && Math.max(px[i], px[i + 1], px[i + 2]) - mn <= 12;
};

/** Share of a region's border ring that looks like studio background. */
function borderPlainness(px: Uint8ClampedArray, w: number, h: number): number {
  let total = 0;
  let plain = 0;
  const step = Math.max(1, Math.round((w + h) / 600));
  const t = (i: number) => (total++, isBg(px, i) && plain++);
  for (let x = 0; x < w; x += step) t(x * 4), t(((h - 1) * w + x) * 4);
  for (let y = 0; y < h; y += step) t(y * w * 4), t((y * w + w - 1) * 4);
  return plain / total;
}

interface Garment {
  /** 1 where a pixel belongs to the garment (dilated slightly), 0 for background, captions and stray text. */
  keep: Uint8Array;
  box: { l: number; t: number; r: number; b: number } | null;
}

/**
 * Background = light neutral pixels connected to the region's border, so a white
 * page and a grey product plate both count. Whatever remains splits into blobs; the
 * garment is the large one(s), while caption and price glyphs are tiny and dropped.
 */
function findGarment(px: Uint8ClampedArray, w: number, h: number): Garment {
  const n = w * h;
  const bg = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const seed = (j: number) => {
    if (!bg[j] && isBg(px, j * 4)) {
      bg[j] = 1;
      stack[sp++] = j;
    }
  };
  for (let x = 0; x < w; x++) seed(x), seed((h - 1) * w + x);
  for (let y = 0; y < h; y++) seed(y * w), seed(y * w + w - 1);
  while (sp) {
    const j = stack[--sp];
    const x = j % w;
    if (x > 0) seed(j - 1);
    if (x < w - 1) seed(j + 1);
    if (j >= w) seed(j - w);
    if (j < n - w) seed(j + w);
  }

  const label = new Int32Array(n);
  const comps: { area: number; l: number; t: number; r: number; b: number }[] = [{ area: 0, l: 0, t: 0, r: 0, b: 0 }];
  for (let j0 = 0; j0 < n; j0++) {
    if (bg[j0] || label[j0]) continue;
    const id = comps.length;
    const c = { area: 0, l: w, t: h, r: 0, b: 0 };
    label[j0] = id;
    stack[sp++] = j0;
    while (sp) {
      const j = stack[--sp];
      const x = j % w;
      const y = (j - x) / w;
      c.area++;
      if (x < c.l) c.l = x;
      if (x > c.r) c.r = x;
      if (y < c.t) c.t = y;
      if (y > c.b) c.b = y;
      const visit = (k: number) => {
        if (!bg[k] && !label[k]) {
          label[k] = id;
          stack[sp++] = k;
        }
      };
      if (x > 0) visit(j - 1);
      if (x < w - 1) visit(j + 1);
      if (j >= w) visit(j - w);
      if (j < n - w) visit(j + w);
    }
    comps.push(c);
  }

  const largest = Math.max(0, ...comps.map((c) => c.area));
  const kept = new Set<number>();
  let box: Garment["box"] = null;
  comps.forEach((c, id) => {
    if (id === 0 || c.area < Math.max(largest * 0.03, 4)) return;
    kept.add(id);
    box = box
      ? { l: Math.min(box.l, c.l), t: Math.min(box.t, c.t), r: Math.max(box.r, c.r), b: Math.max(box.b, c.b) }
      : { l: c.l, t: c.t, r: c.r, b: c.b };
  });

  // Dilate by 2px so antialiased garment edges are never cut.
  const keep = new Uint8Array(n);
  for (let j = 0; j < n; j++) if (kept.has(label[j])) keep[j] = 1;
  for (let pass = 0; pass < 2; pass++) {
    const prev = keep.slice();
    for (let j = 0; j < n; j++) {
      if (prev[j]) continue;
      const x = j % w;
      if ((x > 0 && prev[j - 1]) || (x < w - 1 && prev[j + 1]) || (j >= w && prev[j - w]) || (j < n - w && prev[j + w])) keep[j] = 1;
    }
  }
  return { keep, box };
}

/** Small analysis copy of the whole image, for cheap pixel tests. */
async function sample(orig: Blob, edge = 480) {
  const bmp = await createImageBitmap(orig);
  const scale = Math.min(1, edge / Math.max(bmp.width, bmp.height));
  const W = Math.max(1, Math.round(bmp.width * scale));
  const H = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, W, H);
  bmp.close();
  const region = (r: Rect) => {
    const x0 = Math.floor(r.x * W);
    const y0 = Math.floor(r.y * H);
    const bw = Math.max(1, Math.min(W, Math.ceil((r.x + r.w) * W)) - x0);
    const bh = Math.max(1, Math.min(H, Math.ceil((r.y + r.h) * H)) - y0);
    return { x0, y0, bw, bh, px: ctx.getImageData(x0, y0, bw, bh).data };
  };
  return { W, H, region };
}

/** Can the garment in `r` be lifted off its background and composed on white? */
export async function plainBackground(orig: Blob, r: Rect): Promise<boolean> {
  const { region } = await sample(orig);
  const { px, bw, bh } = region(r);
  return bw >= 8 && bh >= 8 && borderPlainness(px, bw, bh) >= 0.6;
}

/**
 * Lifts the garment off its studio background: everything that isn't garment turns
 * white, and light neutral background inside the garment's outline is ramped to white
 * so there's no hard edge. The mask is found on a ≤900px copy and applied at full size.
 */
function liftOffBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const a = Math.min(1, 900 / Math.max(w, h));
  const aw = Math.max(1, Math.round(w * a));
  const ah = Math.max(1, Math.round(h * a));
  let small = px;
  if (a < 1) {
    const c = document.createElement("canvas");
    c.width = aw;
    c.height = ah;
    const sctx = c.getContext("2d", { willReadFrequently: true })!;
    sctx.drawImage(ctx.canvas, 0, 0, aw, ah);
    small = sctx.getImageData(0, 0, aw, ah).data;
  }
  if (borderPlainness(small, aw, ah) < 0.6) return;
  const { keep, box } = findGarment(small, aw, ah);
  if (!box) return;

  for (let y = 0; y < h; y++) {
    const row = Math.min(ah - 1, Math.floor(y * a)) * aw;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!keep[row + Math.min(aw - 1, Math.floor(x * a))]) {
        px[i] = px[i + 1] = px[i + 2] = 255;
        continue;
      }
      const mn = Math.min(px[i], px[i + 1], px[i + 2]);
      const spread = Math.max(px[i], px[i + 1], px[i + 2]) - mn;
      const t = Math.min(1, Math.max(0, (mn - 214) / 20)) * Math.min(1, Math.max(0, (16 - spread) / 8));
      if (t > 0) {
        px[i] += (255 - px[i]) * t;
        px[i + 1] += (255 - px[i + 1]) * t;
        px[i + 2] += (255 - px[i + 2]) * t;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

export interface Framing {
  kind: PhotoKind;
  crop: Rect;
  mode: FrameMode;
}

/**
 * The display image: always exactly 4:5, at the source's native resolution
 * (never upscaled, capped at `maxEdge`), encoded once at high quality.
 *  - "crop": the 4:5 region `crop` of the original.
 *  - "compose": `crop` is the garment's box; it is centred on white with equal margins.
 */
export async function renderPhoto(orig: Blob, f: Framing, maxEdge = MAX_OUT): Promise<Blob> {
  const bmp = await createImageBitmap(orig);
  const sx = f.crop.x * bmp.width;
  const sy = f.crop.y * bmp.height;
  const sw = Math.max(1, f.crop.w * bmp.width);
  const sh = Math.max(1, f.crop.h * bmp.height);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  if (f.mode === "compose") {
    // Frame big enough that the garment fills COMPOSE_FILL of the binding side.
    const fw = Math.max(sw, sh * ASPECT) / COMPOSE_FILL;
    const scale = Math.min(1, maxEdge / (fw / ASPECT));
    canvas.width = Math.round(fw * scale);
    canvas.height = Math.round(canvas.width / ASPECT);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gw = Math.max(1, Math.round(sw * scale));
    const gh = Math.max(1, Math.round(sh * scale));
    const garment = document.createElement("canvas");
    garment.width = gw;
    garment.height = gh;
    const gctx = garment.getContext("2d", { willReadFrequently: true })!;
    gctx.imageSmoothingQuality = "high";
    gctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, gw, gh);
    liftOffBackground(gctx, gw, gh);
    ctx.drawImage(garment, Math.round((canvas.width - gw) / 2), Math.round((canvas.height - gh) / 2));
  } else {
    const scale = Math.min(1, maxEdge / sh);
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.round(canvas.width / ASPECT);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }
  bmp.close();
  return encodeHQ(canvas);
}

/** Largest 4:5 frame inside `r`, centred across and biased upward (heads matter more than shoes). */
export function fitAspect(r: Rect, imgW: number, imgH: number, aspect = ASPECT): Rect {
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
export function lockAspect(r: Rect, imgW: number, imgH: number, aspect = ASPECT): Rect {
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
 * Shrinks a rough product box to the garment itself: studio background, captions and
 * prices are excluded. Returns `r` unchanged when the result can't be trusted.
 */
export async function refineTight(orig: Blob, r: Rect): Promise<Rect> {
  const { W, H, region } = await sample(orig, 720);
  const { x0, y0, bw, bh, px } = region(r);
  if (bw < 8 || bh < 8) return r;
  const { box } = findGarment(px, bw, bh);
  if (!box) return r;
  const gw = box.r - box.l + 1;
  const gh = box.b - box.t + 1;
  if (gw * gh < bw * bh * 0.06) return r; // almost nothing left: distrust it
  // One sample pixel of slack so antialiased edges aren't clipped; composition adds the margins.
  return clampRect({ x: (x0 + box.l - 1) / W, y: (y0 + box.t - 1) / H, w: (gw + 2) / W, h: (gh + 2) / H });
}

/** Turns Claude's rough box (if any) into the saved framing for that kind of photo. */
export async function autoFrame(orig: Blob, kind: PhotoKind, box?: Rect): Promise<{ crop: Rect; mode: FrameMode }> {
  const { w, h } = await imageSize(orig);
  if (kind === "item") {
    const region = box ? clampRect({ x: box.x - 0.015, y: box.y - 0.015, w: box.w + 0.03, h: box.h + 0.03 }) : FULL;
    if (await plainBackground(orig, region)) return { crop: await refineTight(orig, region), mode: "compose" };
  }
  return { crop: fitAspect(box ?? FULL, w, h), mode: "crop" };
}
