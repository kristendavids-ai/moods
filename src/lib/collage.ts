import type { Item, Photo } from "../types";
import { boardPhoto } from "../types";

/**
 * Editorial collage layout. Every image is 4:5, so a slot is fully described by its
 * left edge, width and top offset, all as % of the board width (its height is 1.25w).
 * Templates leave a caption's worth of space below each image so nothing collides.
 */

export type SlotVariant = "photo" | "cutout";

export interface Slot {
  item: Item;
  photo?: Photo;
  variant: SlotVariant;
  caption: boolean;
  x: number;
  y: number;
  w: number;
}

export interface Spread {
  key: string;
  /** Height of the images' extent, % of board width; captions add a fixed allowance on top. */
  height: number;
  slots: Slot[];
}

type Cell = { x: number; y: number; w: number };

// Photos (worn shots, cropped product shots) and cut-outs can fill any cell; solo
// spreads give a photo the full width and a cut-out a centred 72%.
const TEMPLATES: Cell[][] = [
  // Lead: a large image with a small one dropped beside it.
  [
    { x: 0, y: 0, w: 64 },
    { x: 70, y: 30, w: 30 },
  ],
  // Stagger: two mid-size images at different heights.
  [
    { x: 4, y: 14, w: 42 },
    { x: 52, y: 0, w: 48 },
  ],
  // Solo.
  [{ x: 14, y: 0, w: 72 }],
  // Trio: small, large, small tucked under the first.
  [
    { x: 0, y: 0, w: 36 },
    { x: 42, y: 16, w: 58 },
    { x: 8, y: 60, w: 30 },
  ],
];

// A piece with both photos: the look, and the product beside it like a lookbook spread.
const PAIR: Cell[] = [
  { x: 0, y: 0, w: 60 },
  { x: 64, y: 34, w: 36 },
];

const variantOf = (p?: Photo): SlotVariant => (p?.kind === "item" && p.mode === "compose" ? "cutout" : "photo");
const mirror = (c: Cell): Cell => ({ ...c, x: 100 - c.x - c.w });
const extent = (cells: Cell[]) => Math.max(...cells.map((c) => c.y + c.w * 1.25));

function spreadOf(items: Item[], cells: Cell[], flip: boolean): Spread {
  let placed = flip ? cells.map(mirror) : cells;
  // Newest piece takes the lead cell, so the board reads newest-first throughout.
  const slots: Slot[] = [...items].reverse().map((item, i) => {
    const photo = boardPhoto(item);
    return { item, photo, variant: variantOf(photo), caption: true, ...placed[i] };
  });
  // A solo photo runs full width.
  if (slots.length === 1 && slots[0].variant === "photo") {
    Object.assign(slots[0], { x: 0, y: 0, w: 100 });
    placed = [{ x: 0, y: 0, w: 100 }];
  }
  return { key: items.map((i) => i.id).join("|"), height: extent(placed), slots };
}

function pairOf(item: Item, flip: boolean): Spread {
  const worn = item.photos.find((p) => p.kind === "worn")!;
  const product = item.photos.find((p) => p.kind === "item")!;
  const [a, b] = flip ? PAIR.map(mirror) : PAIR;
  return {
    key: `pair:${item.id}`,
    height: extent(PAIR),
    slots: [
      { item, photo: worn, variant: "photo", caption: false, ...a },
      { item, photo: product, variant: variantOf(product), caption: true, ...b },
    ],
  };
}

/**
 * Lays out `items` (newest first, as the board lists them). Layout runs from the
 * oldest piece, so adding a piece only ever changes the spread at the top.
 */
export function layout(items: Item[]): Spread[] {
  const spreads: Spread[] = [];
  let queue: Item[] = [];
  let t = 0;
  let flip = false;

  const pour = (final: boolean) => {
    for (;;) {
      let cells = TEMPLATES[t % TEMPLATES.length];
      if (queue.length < cells.length) {
        if (!final || !queue.length) return;
        // Leftovers: the next template in the cycle that fits them exactly.
        const n = queue.length;
        for (let k = 0; k < TEMPLATES.length; k++) {
          const c = TEMPLATES[(t + k) % TEMPLATES.length];
          if (c.length === n) {
            cells = c;
            break;
          }
        }
      }
      spreads.push(spreadOf(queue.slice(0, cells.length), cells, flip));
      queue = queue.slice(cells.length);
      t++;
      if (t % TEMPLATES.length === 0) flip = !flip;
    }
  };

  for (const item of [...items].reverse()) {
    const kinds = new Set(item.photos.map((p) => p.kind));
    if (kinds.has("worn") && kinds.has("item")) {
      pour(true); // older singles go down first, so the board stays in date order
      spreads.push(pairOf(item, spreads.length % 2 === 1));
    } else {
      queue.push(item);
      pour(false);
    }
  }
  pour(true);
  return spreads.reverse();
}
