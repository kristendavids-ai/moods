import { openDB, type DBSchema } from "idb";
import type { Item } from "../types";
import { base64ToBlob, blobToBase64 } from "../lib/image";

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

export async function listItems(): Promise<Item[]> {
  const db = await dbPromise;
  const all = await db.getAllFromIndex("items", "createdAt");
  return all.reverse();
}

export async function getImage(id: string): Promise<Blob | undefined> {
  return (await dbPromise).get("images", id);
}

export async function saveItem(item: Item, image?: Blob) {
  const db = await dbPromise;
  const tx = db.transaction(["items", "images"], "readwrite");
  if (image) await tx.objectStore("images").put(image, item.imageId);
  await tx.objectStore("items").put(item);
  await tx.done;
}

export async function deleteItem(item: Item) {
  const db = await dbPromise;
  const tx = db.transaction(["items", "images"], "readwrite");
  await tx.objectStore("items").delete(item.id);
  await tx.objectStore("images").delete(item.imageId);
  await tx.done;
}

export async function clearAll() {
  const db = await dbPromise;
  const tx = db.transaction(["items", "images"], "readwrite");
  await tx.objectStore("items").clear();
  await tx.objectStore("images").clear();
  await tx.done;
}

interface Backup {
  app: "moods";
  version: 1;
  items: (Item & { image?: { type: string; data: string } })[];
}

export async function exportBackup(): Promise<Blob> {
  const items = await listItems();
  const out: Backup = { app: "moods", version: 1, items: [] };
  for (const item of items) {
    const blob = await getImage(item.imageId);
    out.items.push({
      ...item,
      image: blob ? { type: blob.type, data: await blobToBase64(blob) } : undefined,
    });
  }
  return new Blob([JSON.stringify(out)], { type: "application/json" });
}

// Merges by id, so importing the same backup twice is harmless.
export async function importBackup(file: Blob): Promise<number> {
  const parsed = JSON.parse(await file.text()) as Backup;
  if (parsed.app !== "moods" || !Array.isArray(parsed.items)) throw new Error("Not a MOODS backup");
  for (const { image, ...item } of parsed.items) {
    await saveItem(item, image ? await base64ToBlob(image.data, image.type) : undefined);
  }
  return parsed.items.length;
}
