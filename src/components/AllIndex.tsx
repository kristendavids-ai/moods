import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Item, Photo } from "../types";
import { PhotoView } from "./PhotoView";

interface Props {
  items: Item[];
  /** Category order, as in the tabs. */
  categories: string[];
  onCategory: (c: string) => void;
  onOpen: (item: Item) => void;
}

interface Panel {
  item: Item;
  photo?: Photo;
  /** Solid swatch of the piece's colour instead of a photo. */
  swatch?: string;
  w: number; // % of the stage width
  h: number; // % of the stage height
}

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

/**
 * A random cluster of the board: each panel is one piece, shown by a random one of its
 * photos (worn one visit, product the next) or now and then by a block of its colour.
 * Panels rise towards the middle, like the stack in the reference.
 */
function pickPanels(items: Item[], max: number): Panel[] {
  const chosen = shuffle(items.filter((i) => i.photos.length)).slice(0, max);
  let swatches = 0;
  const raw = chosen.map((item) => {
    const useSwatch = item.colour && swatches < 2 && chosen.length > 4 && Math.random() < 0.2;
    if (useSwatch) swatches++;
    return {
      item,
      photo: useSwatch ? undefined : item.photos[Math.floor(Math.random() * item.photos.length)],
      swatch: useSwatch ? item.colour!.hex : undefined,
      w: useSwatch ? 5 + Math.random() * 4 : 8 + Math.random() * 7,
      h: 0,
    };
  });
  // Heights: tallest in the centre, falling away to both sides with a little jitter.
  const n = raw.length;
  const heights = raw.map(() => 46 + Math.random() * 40).sort((a, b) => b - a);
  const order = raw.map((_, i) => i).sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2));
  order.forEach((slot, rank) => (raw[slot].h = heights[rank]));
  // Keep the cluster inside ~78% of the width.
  const total = raw.reduce((s, p) => s + p.w, 0);
  const k = total > 78 ? 78 / total : 1;
  return raw.map((p) => ({ ...p, w: p.w * k }));
}

export function AllIndex({ items, categories, onCategory, onOpen }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // A fresh shuffle each time the All page opens (it remounts), not on every re-render.
  const key = items.map((i) => `${i.id}:${i.photos.length}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const panels = useMemo(() => pickPanels(items, 9), [key]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return m;
  }, [items]);
  // Up to seven labelled lines: the categories in use, in tab order.
  const labels = categories.filter((c) => counts.has(c)).slice(0, 7);

  useLayoutEffect(() => {
    const el = stage.current!;
    const fit = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lines: an unlabelled one above and below frame the labelled ones. Their half-widths
  // swell towards the middle like rings of a barrel seen side-on.
  const { w, h } = size;
  const rows = labels.length + 2;
  const top = h * 0.1;
  const gap = (h * 0.8) / Math.max(1, rows - 1);
  const lines = Array.from({ length: rows }, (_, i) => {
    const t = rows === 1 ? 0.5 : i / (rows - 1);
    const swell = Math.sin(Math.PI * t);
    const half = w * (0.3 + 0.17 * swell);
    return { y: top + i * gap, l: w / 2 - half, r: w / 2 + half, label: i === 0 || i === rows - 1 ? undefined : labels[i - 1] };
  });
  // Each connector runs from just inside one line's end to the next line's endpoint.
  const inset = w * 0.07;
  const connectors = lines.slice(0, -1).flatMap((a, i) => {
    const b = lines[i + 1];
    const up = i < (rows - 1) / 2;
    return [
      { x1: (up ? b.l : a.l) + inset, y1: up ? b.y : a.y, x2: up ? a.l : b.l, y2: up ? a.y : b.y },
      { x1: (up ? b.r : a.r) - inset, y1: up ? b.y : a.y, x2: up ? a.r : b.r, y2: up ? a.y : b.y },
    ];
  });

  return (
    <section className="allx" aria-label="All pieces by category">
      <div className="allx-stage" ref={stage}>
        <div className="allx-panels">
          {panels.map((p, i) => (
            <button
              key={`${p.item.id}:${i}`}
              className={`allx-panel${p.swatch ? " swatch" : ""}${p.photo?.mode === "compose" ? " cutout" : ""}`}
              style={{
                width: `${p.w}%`,
                height: `${p.h}%`,
                zIndex: 10 - Math.round(Math.abs(i - (panels.length - 1) / 2)),
                background: p.swatch,
                animationDelay: `${120 + Math.abs(i - (panels.length - 1) / 2) * 70}ms`,
              }}
              aria-label={[p.item.brand, p.item.name].filter(Boolean).join(" ") || "Piece"}
              onClick={() => onOpen(p.item)}
            >
              {p.photo && <PhotoView photo={p.photo} />}
            </button>
          ))}
        </div>

        {w > 0 && (
          <svg className="allx-lines" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
            {lines.map((ln, i) => (
              <g key={i} style={{ animationDelay: `${i * 60}ms` }}>
                <line x1={ln.l} y1={ln.y} x2={ln.r} y2={ln.y} pathLength={1} />
                <circle cx={ln.l} cy={ln.y} r={3.5} />
                <circle cx={ln.r} cy={ln.y} r={3.5} />
              </g>
            ))}
            {connectors.map((c, i) => (
              <line key={i} className="allx-conn" x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} pathLength={1} style={{ animationDelay: `${300 + i * 30}ms` }} />
            ))}
          </svg>
        )}

        {lines.map(
          (ln) =>
            ln.label && (
              <button
                key={ln.label}
                className="allx-label"
                style={{ top: ln.y, right: Math.max(4, w - ln.r + 2) }}
                onClick={() => onCategory(ln.label!)}
              >
                {ln.label}
                <sup>{counts.get(ln.label)}</sup>
              </button>
            ),
        )}
      </div>
      <p className="allx-hint micro mute">Tap a category, or a piece. Scroll for everything.</p>
    </section>
  );
}
