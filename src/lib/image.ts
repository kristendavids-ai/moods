const MAX_ORIGINAL = 4096;
const SCAN_EDGE = 1568; // the API downsizes anything larger, so sending more only costs bandwidth

/** One high-quality encode. iOS Safari can't encode WebP from a canvas, so it gets JPEG 0.95. */
export async function encodeHQ(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.95));
  if (webp && webp.type === "image/webp") return webp;
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.95),
  );
}

async function redraw(file: Blob, maxEdge: number): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // flatten transparency onto white
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas;
}

/**
 * The stored original. JPEG and WebP photos are kept byte-for-byte; PNG screenshots
 * (often 3–6 MB) are re-encoded once at full resolution, which is visually lossless.
 */
export async function prepareOriginal(file: Blob): Promise<Blob> {
  if (file.type === "image/jpeg" || file.type === "image/webp") {
    const bmp = await createImageBitmap(file);
    const fits = Math.max(bmp.width, bmp.height) <= MAX_ORIGINAL;
    bmp.close();
    if (fits) return file;
  }
  return encodeHQ(await redraw(file, MAX_ORIGINAL));
}

/** A small copy for Claude only; boxes come back normalised, so they map onto the original. */
export async function scanCopy(original: Blob): Promise<Blob> {
  const canvas = await redraw(original, SCAN_EDGE);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function base64ToBlob(b64: string, type: string): Promise<Blob> {
  const res = await fetch(`data:${type};base64,${b64}`);
  return res.blob();
}

const urlCache = new Map<string, string>();

export function objectUrl(id: string, blob: Blob): string {
  let url = urlCache.get(id);
  if (!url) {
    url = URL.createObjectURL(blob);
    urlCache.set(id, url);
  }
  return url;
}

export function revokeUrl(id: string) {
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
}
