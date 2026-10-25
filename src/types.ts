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

/** "crop": a 4:5 region of the original. "compose": the garment's box, centred on white in 4:5. */
export type FrameMode = "crop" | "compose";

export interface Photo {
  /** Key of the cropped display blob; the original is stored under `${id}.orig`. */
  id: string;
  kind: PhotoKind;
  crop: Rect;
  /** Missing on photos saved before 4:5 framing; those display letterboxed until re-adjusted. */
  mode?: FrameMode;
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

/** Duties & VAT when shipping to the EU: paid at checkout, due on delivery, or not yet checked. */
export type EuTax = "paid" | "due" | "unknown";

export const EU_TAX: { id: EuTax; label: string; short: string }[] = [
  { id: "paid", label: "Duties & VAT paid", short: "Paid" },
  { id: "due", label: "Customs due on delivery", short: "Customs due" },
  { id: "unknown", label: "Not checked yet", short: "Unknown" },
];

export interface Brand {
  id: string;
  name: string;
  website?: string;
  euTax: EuTax;
  createdAt: number;
}

export interface City {
  name: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
  lat: number;
  lon: number;
}

export interface Boutique {
  id: string;
  name: string;
  website?: string;
  euTax: EuTax;
  brandIds: string[];
  /** Missing for online-only shops, which then sit in the list but not on the globe. */
  city?: City;
  address?: string;
  createdAt: number;
}
