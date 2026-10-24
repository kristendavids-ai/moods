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

export interface Item {
  id: string;
  imageId: string;
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
