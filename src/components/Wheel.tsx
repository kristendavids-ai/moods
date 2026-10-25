import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Item, Photo } from "../types";
import { PhotoView } from "./PhotoView";
import { pad3 } from "./Header";

interface Props {
  items: Item[];
  onCategory: (c: string) => void;
  onOpen: (item: Item) => void;
}

interface Entry {
  item: Item;
  photo?: Photo;
  /** Solid block of the piece's colour instead of a photo. */
  swatch?: string;
  /** Width as a share of the stage, before perspective. */
  w: number;
}

/** Scroll distance per piece; one snap point each. */
const STEP = 96;
/** Angle between neighbouring pieces on the wheel, in radians. */
const ARC = 0.4;

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

// Each visit: a fresh order, and for each piece a random one of its photos (worn one
// time, product the next), with an occasional block of its colour.
function pick(items: Item[]): Entry[] {
  let swatches = 0;
  return shuffle(items.filter((i) => i.photos.length)).map((item, _n, all) => {
    const swatch = item.colour && swatches < 2 && all.length > 5 && Math.random() < 0.15 ? item.colour.hex : undefined;
    if (swatch) swatches++;
    return {
      item,
      swatch,
      photo: swatch ? undefined : item.photos[Math.floor(Math.random() * item.photos.length)],
      w: swatch ? 0.36 + Math.random() * 0.14 : 0.58 + Math.random() * 0.22,
    };
  });
}

/**
 * The board's main page: a vertical roulette of pieces, like a drum seen side-on. The
 * piece at the centre is largest; others shrink and fade as they turn away. Each carries
 * a hairline with dotted ends labelled with its category, joined by zig-zag connectors.
 */
export function Wheel({ items, onCategory, onOpen }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [offset, setOffset] = useState(0);
  const key = items.map((i) => `${i.id}:${i.photos.length}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entries = useMemo(() => pick(items), [key]);

  // Fill the screen between the tabs and the bottom bar, so the page itself never scrolls.
  useLayoutEffect(() => {
    const el = wrap.current!;
    const fit = () => {
      el.style.setProperty("--wheel-top", `${Math.max(0, el.getBoundingClientRect().top + window.scrollY)}px`);
      setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => (ro.disconnect(), window.removeEventListener("resize", fit));
  }, []);

  useEffect(() => {
    const el = scroller.current!;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setOffset(el.scrollTop / STEP));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => (el.removeEventListener("scroll", onScroll), cancelAnimationFrame(raf));
  }, []);

  const { w, h } = size;
  const R = h * 0.44;
  const current = Math.min(entries.length - 1, Math.max(0, Math.round(offset)));
  const scrollToIndex = (i: number) => scroller.current?.scrollTo({ top: i * STEP, behavior: "smooth" });

  // Place every piece within a quarter-turn of the front.
  const placed = entries.flatMap((e, i) => {
    const theta = (i - offset) * ARC;
    if (Math.abs(theta) > 1.42) return [];
    const c = Math.cos(theta);
    const y = h / 2 + R * Math.sin(theta);
    const ph = h * 0.42 * c;
    const pw = Math.min(w * 0.82, w * e.w * (0.62 + 0.38 * c));
    const half = w * (0.3 + 0.17 * c);
    return [{ e, i, c, y, ph, pw, l: w / 2 - half, r: w / 2 + half }];
  });
  const inset = w * 0.06;
  const connectors = placed.slice(0, -1).flatMap((a, k) => {
    const b = placed[k + 1];
    if (b.i !== a.i + 1) return [];
    const [wide, narrow] = a.c >= b.c ? [a, b] : [b, a];
    const o = Math.min(a.c, b.c);
    return [
      { x1: wide.l + inset, y1: wide.y, x2: narrow.l, y2: narrow.y, o },
      { x1: wide.r - inset, y1: wide.y, x2: narrow.r, y2: narrow.y, o },
    ];
  });

  const cur = entries[current];
  return (
    <section className="wheel" ref={wrap} aria-label="Index of pieces" aria-roledescription="carousel">
      <div className="wheel-scroll" ref={scroller}>
        <div className="wheel-stage" style={{ height: h, marginBottom: -h }}>
          {placed.map(({ e, i, c, y, ph, pw }) => (
            <button
              key={`${e.item.id}:${i}`}
              className={`wheel-panel${e.swatch ? " swatch" : ""}`}
              style={{
                width: pw,
                height: ph,
                left: (w - pw) / 2,
                top: y - ph / 2,
                zIndex: Math.round(c * 100),
                opacity: 0.25 + 0.75 * c * c,
                background: e.swatch,
              }}
              aria-label={[e.item.brand, e.item.name].filter(Boolean).join(" ") || "Piece"}
              aria-current={i === current}
              tabIndex={i === current ? 0 : -1}
              onClick={() => (i === current ? onOpen(e.item) : scrollToIndex(i))}
            >
              {e.photo && <PhotoView photo={e.photo} />}
            </button>
          ))}

          {w > 0 && (
            <svg className="wheel-lines" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
              {placed.map(({ i, c, y, l, r }) => (
                <g key={i} opacity={0.2 + 0.8 * c * c}>
                  <line x1={l} y1={y} x2={r} y2={y} />
                  <circle cx={l} cy={y} r={2.2 + 1.4 * c} />
                  <circle cx={r} cy={y} r={2.2 + 1.4 * c} />
                </g>
              ))}
              {connectors.map((k, n) => (
                <line key={n} x1={k.x1} y1={k.y1} x2={k.x2} y2={k.y2} opacity={0.2 + 0.8 * k.o * k.o} />
              ))}
            </svg>
          )}

          {placed.map(({ e, i, c, y, r }) =>
            c > 0.55 ? (
              <button
                key={`label-${i}`}
                className="wheel-label"
                style={{ top: y, right: Math.max(4, w - r + 2), opacity: (c - 0.55) / 0.45, fontSize: 11 + 4 * c }}
                tabIndex={i === current ? 0 : -1}
                onClick={() => onCategory(e.item.category)}
              >
                {e.item.category}
              </button>
            ) : null,
          )}

          {cur && (
            <div className="wheel-caption micro">
              <span className="mute">
                {pad3(current + 1)} / {pad3(entries.length)}
              </span>
              <button onClick={() => onOpen(cur.item)}>
                {cur.item.brand || "Unknown"} <span className="plus">+</span>{" "}
                <span className="mute">{[cur.item.name, cur.item.season].filter(Boolean).join(" · ")}</span>
              </button>
            </div>
          )}
        </div>
        {/* One snap point per piece; padding lets the first and last reach the centre. */}
        <div className="wheel-track" style={{ paddingTop: h / 2 - STEP / 2, paddingBottom: h / 2 - STEP / 2 }}>
          {entries.map((_e, i) => (
            <div key={i} className="wheel-snap" style={{ height: STEP }} />
          ))}
        </div>
      </div>
    </section>
  );
}
