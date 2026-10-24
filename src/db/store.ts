import { openDB, type DBSchema } from "idb";
import { FULL, type Item, type Photo } from "../types";
import { base64ToBlob, blobToBase64 } from "../lib/image";
import { renderPhoto } from "../lib/frame";

interface MoodsDB extends DBSchema {
  items: { key: string; value: Item; indexes: { createdAt: number } };
  images: { key: string; value: Blob };
}

const dbPromise = openDB<MoodsDB>("moods", 1, {
  upgrade(db) {
    const items = db.createObjectStore("items", { keyPath: "id" });
    items.createIndex("createdAt", "createdAt");
    db.createObjectStore("images");
  },
});

export const newId = () => crypto.randomUUID();
export const origKey = (photoId: string) => `${photoId}.orig`;

// Items saved before two-photo support had a single `imageId` and no stored original.
type LegacyItem = Omit<Item, "photos"> & { photos?: Photo[]; imageId?: string };

function normalize(raw: LegacyItem): Item {
  const { imageId, photos, ...rest } = raw;
  return { ...rest, photos: photos ?? (imageId ? [{ id: imageId, kind: "item", crop: FULL }] : []) };
}

export async function listItems(): Promise<Item[]> {
  const db = await dbPromise;
  const all = (await db.getAllFromIndex("items", "createdAt")) as LegacyItem[];
  return all.reverse().map(normalize);
}

export async function getImage(key: string): Promise<Blob | undefined> {
  return (await dbPromise).get("images", key);
}

/** The uncropped source, falling back to the display image for legacy photos. */
export async function getOriginal(photoId: string): Promise<Blob | undefined> {
  return (await getImage(origKey(photoId))) ?? (await getImage(photoId));
}

export interface PhotoWrite {
  photo: Photo;
  display: Blob;
  orig?: Blob;
}

/** Saves the item, writes any new/re-cropped photos and drops blobs of photos it no longer has. */
export async function saveItem(item: Item, writes: PhotoWrite[] = [], removed: string[] = []) {
  const db = await dbPromise;
  const tx = db.transaction(["items", "images"], "readwrite");
  const images = tx.objectStore("images");
  for (const w of writes) {
    await images.put(w.display, w.photo.id);
    if (w.orig) await images.put(w.orig, origKey(w.photo.id));
  }
  for (const id of removed) {
    await images.delete(id);
    await images.delete(origKey(id));
  }
  await tx.objectStore("items").put(item);
  await tx.done;
}

export async function deleteItem(item: Item) {
  const db = await dbPromise;
  const tx = db.transaction(["items", "images"], "readwrite");
  await tx.objectStore("items").delete(item.id);
  for (const p of item.photos) {
    await tx.objectStore("images").delete(p.id);
    await tx.objectStore("images").delete(origKey(p.id));
  }
  await tx.done;
}

export async function clearAll() {
  const db = await dbPromise;
  const tx = db.transaction(["items", "images"], "readwrite");
  await tx.objectStore("items").clear();
  await tx.objectStore("images").clear();
  await tx.done;
}

type Encoded = { type: string; data: string };
const encode = async (b: Blob): Promise<Encoded> => ({ type: b.type, data: await blobToBase64(b) });
const decode = (e: Encoded) => base64ToBlob(e.data, e.type);

interface BackupV2 {
  app: "moods";
  version: 2 | 3;
  items: (Item & { blobs: Record<string, Encoded> })[];
}

interface BackupV1 {
  app: "moods";
  version: 1;
  items: (LegacyItem & { image?: Encoded })[];
}

// v3 carries originals only for framed photos; their display images are re-rendered on import.
export async function exportBackup(): Promise<Blob> {
  const out: BackupV2 = { app: "moods", version: 3, items: [] };
  for (const item of await listItems()) {
    const blobs: Record<string, Encoded> = {};
    for (const p of item.photos) {
      const orig = await getImage(origKey(p.id));
      if (orig) blobs[origKey(p.id)] = await encode(orig);
      if (!p.mode || !orig) {
        const display = await getImage(p.id);
        if (display) blobs[p.id] = await encode(display);
      }
    }
    out.items.push({ ...item, blobs });
  }
  return new Blob([JSON.stringify(out)], { type: "application/json" });
}

// Merges by id, so importing the same backup twice is harmless.
export async function importBackup(file: Blob): Promise<number> {
  const parsed = JSON.parse(await file.text()) as BackupV1 | BackupV2;
  if (parsed.app !== "moods" || !Array.isArray(parsed.items)) throw new Error("Not a MOODS backup");
  const db = await dbPromise;
  for (const raw of parsed.items) {
    if (parsed.version === 1) {
      const { image, ...item } = raw as BackupV1["items"][number];
      if (image && item.imageId) await db.put("images", await decode(image), item.imageId);
      await db.put("items", normalize(item));
      continue;
    }
    const { blobs, ...rest } = raw as BackupV2["items"][number];
    const item = normalize(rest);
    for (const [key, enc] of Object.entries(blobs)) await db.put("images", await decode(enc), key);
    for (const p of item.photos) {
      const orig = blobs[origKey(p.id)];
      if (p.mode && orig && !blobs[p.id]) await db.put("images", await renderPhoto(await decode(orig), p as Required<Photo>), p.id);
    }
    await db.put("items", item);
  }
  return parsed.items.length;
}
