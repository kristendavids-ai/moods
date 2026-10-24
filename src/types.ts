export type Status = "wishlist" | "owned" | "soldout";

export const STATUSES: { id: Status; label: string }[] = [
  { id: "wishlist", label: "Wishlist" },
  { id: "owned", label: "Owned" },
  { id: "soldout", label: "Sold out" },
];

export interface Colour {
  name: string;
  hex: string;
}

export type PhotoKind = "worn" | "item";

/** Normalised crop of the original image, 0–1 on each axis. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Photo {
  /** Key of the cropped display blob; the original is stored under `${id}.orig`. */
  id: string;
  kind: PhotoKind;
  crop: Rect;
}

export interface Item {
  id: string;
  photos: Photo[];
  brand: string;
  name?: string;
  category: string;
  season?: string;
  status: Status;
  size?: string;
  colour?: Colour;
  notes?: string;
  createdAt: number;
}

export interface Filters {
  category: string; // "All" or a category
  season: string | null;
  status: Status | null;
}

export const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };

/** Board shows the clean product shot; the detail page leads with the worn one. */
export const boardPhoto = (item: Item) => item.photos.find((p) => p.kind === "item") ?? item.photos[0];
export const heroPhotos = (item: Item) =>
  [...item.photos].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "worn" ? -1 : 1));
