import { useEffect, useLayoutEffect, useMemo, useRef, type PointerEvent as RPointerEvent } from "react";
import type { Item, Photo } from "../types";
import { PhotoView } from "./PhotoView";
import { pad3 } from "./Header";

interface Props {
  items: Item[];
  season: string | null;
  onOpen: (item: Item) => void;
}

interface Tile {
  key: string;
  item: Item;
  photo: Photo;
  size: number;
  /** Unit vector on the sphere. */
  p: [number, number, number];
}

const MIN_TILES = 48;
const MAX_TILES = 160;
const AUTO_SPIN = (7 * Math.PI) / 180; // rad/s
const CAMERA = 2.4; // camera distance, in sphere radii
const HIGHLIGHT_EVERY = 2400; // ms, as in the reference
const HIGHLIGHT_FALLBACK = "#27c93f";
/** Black or white text, whichever reads better on `hex`. */
const inkOn = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#0a0a0a" : "#ffffff";
};
const deg = (r: number) => (((r * 180) / Math.PI) % 360 + 360) % 360;

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

/** Every photo of every piece, repeated to fill a small board, capped for a big one. */
function buildTiles(items: Item[]): Tile[] {
  const photos = items.flatMap((item) => item.photos.map((photo) => ({ item, photo })));
  if (!photos.length) return [];
  let list = shuffle(photos);
  while (list.length < MIN_TILES) list.push(photos[Math.floor(Math.random() * photos.length)]);
  list = shuffle(list).slice(0, MAX_TILES);
  // Fibonacci sphere: even coverage whatever the count.
  const n = list.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  return list.map(({ item, photo }, i) => {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const phi = i * golden;
    return { key: `${photo.id}:${i}`, item, photo, size: 0.6 + Math.random() * 0.85, p: [Math.cos(phi) * r, y, Math.sin(phi) * r] };
  });
}

/**
 * The board's Index: every photo on a slowly turning sphere, at various sizes. Drag to
 * spin (with momentum), pinch or scroll to zoom, tap an image to open its piece.
 */
export function Sphere({ items, season, onOpen }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const tileEls = useRef<(HTMLButtonElement | null)[]>([]);
  const readRotate = useRef<HTMLSpanElement>(null);
  const readZoom = useRef<HTMLSpanElement>(null);
  const hlEl = useRef<HTMLDivElement>(null);
  const hlTop = useRef<HTMLSpanElement>(null);
  const hlBottom = useRef<HTMLSpanElement>(null);
  const key = items.map((i) => `${i.id}:${i.photos.length}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tiles = useMemo(() => buildTiles(items), [key]);
  const photoCount = items.reduce((n, i) => n + i.photos.length, 0);

  const s = useRef({
    yaw: Math.random() * Math.PI * 2,
    pitch: -0.25,
    vel: [0, 0] as [number, number],
    zoom: 1,
    size: { w: 0, h: 0 },
    start: 0,
    pointers: new Map<number, { x: number; y: number }>(),
    drag: null as null | { x: number; y: number; t: number; moved: number; pinch?: number; zoom: number },
  });

  // Fill the screen between the tabs and the bottom bar, so the page itself never scrolls.
  useLayoutEffect(() => {
    const el = wrap.current!;
    const fit = () => {
      el.style.setProperty("--stage-top", `${Math.max(0, el.getBoundingClientRect().top + window.scrollY)}px`);
      s.current.size = { w: el.clientWidth, h: el.clientHeight };
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => (ro.disconnect(), window.removeEventListener("resize", fit));
  }, []);

  useEffect(() => {
    const st = s.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    st.start = performance.now();
    let raf = 0;
    let last = performance.now();
    let lastRead = 0;
    const geo = tiles.map(() => ({ x: 0, y: 0, size: 0, depth: 0 }));
    const hl = { i: -1, since: 0, lastItem: "" };
    const PAD = 5;

    // Outline one front tile in its piece's colour, with brand and piece-name tags.
    const highlight = (i: number, now: number) => {
      const el = hlEl.current;
      if (!el) return;
      hl.i = i;
      hl.since = now;
      if (i < 0) {
        el.style.opacity = "0";
        return;
      }
      const { item } = tiles[i];
      hl.lastItem = item.id;
      const colour = item.colour?.hex || HIGHLIGHT_FALLBACK;
      el.style.setProperty("--hl", colour);
      el.style.setProperty("--hl-ink", inkOn(colour));
      el.dataset.item = item.id;
      el.dataset.tile = String(i);
      if (hlTop.current) hlTop.current.textContent = item.brand || "Unknown";
      if (hlBottom.current) hlBottom.current.textContent = item.name || item.category;
      el.style.transition = "none";
      el.style.opacity = "0";
      requestAnimationFrame(() => {
        el.style.transition = reduced ? "none" : "opacity 120ms ease";
        el.style.opacity = "1";
      });
    };

    // Is tile i's centre covered by a nearer tile?
    const covered = (i: number) => {
      const g = geo[i];
      const cx = g.x + g.size / 2;
      const cyy = g.y + g.size * 0.625;
      return geo.some((o, j) => j !== i && o.depth > g.depth && cx > o.x && cx < o.x + o.size && cyy > o.y && cyy < o.y + o.size * 1.25);
    };
    let lastCoverCheck = 0;

    const pickHighlight = (now: number) => {
      const { w, h } = st.size;
      const inside = (g: (typeof geo)[number]) =>
        g.x >= 10 + PAD && g.x + g.size <= w - 10 - PAD && g.y >= 22 + PAD + 14 && g.y + g.size * 1.25 <= h - 22 - PAD - 14;
      // Only tiles you can actually see: near the front, not tiny, and not covered at
      // their centre by a nearer tile.
      const minSize = Math.min(w, h) * 0.13 * st.zoom * 0.9;
      const front = geo
        .map((g, i) => ({ g, i }))
        .filter(({ g, i }) => g.depth >= 0.78 && g.size >= minSize && inside(g) && !covered(i));
      const fresh = front.filter(({ i }) => tiles[i].item.id !== hl.lastItem);
      const pool = fresh.length ? fresh : front;
      highlight(pool.length ? pool[Math.floor(Math.random() * pool.length)].i : -1, now);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w, h } = st.size;
      if (!w || !h) return;

      if (!st.drag) {
        st.yaw += (reduced ? 0 : AUTO_SPIN * dt) + st.vel[0] * dt;
        st.pitch = Math.max(-1.2, Math.min(1.2, st.pitch + st.vel[1] * dt));
        const decay = Math.exp(-dt * 2.6);
        st.vel = [st.vel[0] * decay, st.vel[1] * decay];
      }

      const t = reduced ? 1 : Math.min(1, (now - st.start) / 700);
      const assemble = 1 - Math.pow(1 - t, 3);
      const R = Math.min(w, h) * 0.34 * st.zoom * assemble;
      const base = Math.min(w, h) * 0.13 * st.zoom;
      const cy = Math.cos(st.yaw);
      const sy = Math.sin(st.yaw);
      const cp = Math.cos(st.pitch);
      const sp = Math.sin(st.pitch);

      for (let i = 0; i < tiles.length; i++) {
        const el = tileEls.current[i];
        if (!el) continue;
        const [x, y, z] = tiles[i].p;
        const x1 = x * cy + z * sy;
        const z1 = -x * sy + z * cy;
        const y2 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp; // towards the viewer is positive
        const persp = CAMERA / (CAMERA - z2);
        const depth = (z2 + 1) / 2;
        const size = base * tiles[i].size * persp;
        const px = w / 2 + x1 * R * persp - size / 2;
        const py = h / 2 + y2 * R * persp - (size * 1.25) / 2;
        el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) scale(${(size / 100).toFixed(4)})`;
        el.style.opacity = ((0.28 + 0.72 * Math.pow(depth, 1.5)) * assemble).toFixed(3);
        el.style.zIndex = String(Math.round(depth * 1000));
        geo[i] = { x: px, y: py, size, depth };
      }

      // Highlight: none while assembling; then a new front tile every few seconds, or
      // sooner if the current one turns away. It follows its tile every frame.
      if (t >= 1) {
        const cur = hl.i >= 0 ? geo[hl.i] : undefined;
        // Move on when it's time, or early if the tile turns away or a nearer one drifts over it.
        let hidden = false;
        if (cur && now - lastCoverCheck > 200) {
          lastCoverCheck = now;
          hidden = covered(hl.i);
        }
        if (!cur || cur.depth < 0.6 || hidden || now - hl.since > HIGHLIGHT_EVERY) pickHighlight(now);
        const g = hl.i >= 0 ? geo[hl.i] : undefined;
        if (g && hlEl.current) {
          const s2 = hlEl.current.style;
          s2.transform = `translate3d(${(g.x - PAD).toFixed(1)}px, ${(g.y - PAD).toFixed(1)}px, 0)`;
          s2.width = `${(g.size + PAD * 2).toFixed(1)}px`;
          s2.height = `${(g.size * 1.25 + PAD * 2).toFixed(1)}px`;
        }
      }

      if (now - lastRead > 100) {
        lastRead = now;
        if (readRotate.current) readRotate.current.textContent = `${deg(st.yaw).toFixed(1)}°`;
        if (readZoom.current) readZoom.current.textContent = st.zoom.toFixed(2);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [tiles]);

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    const st = s.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...st.pointers.values()];
    st.vel = [0, 0];
    st.drag = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      moved: st.drag?.moved ?? 0,
      zoom: st.zoom,
      pinch: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined,
    };
  };

  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const st = s.current;
    if (!st.drag || !st.pointers.has(e.pointerId)) return;
    st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...st.pointers.values()];
    if (pts.length === 2 && st.drag.pinch) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      st.zoom = Math.max(0.7, Math.min(2.2, (st.drag.zoom * dist) / st.drag.pinch));
      st.drag.moved += 10;
      return;
    }
    const now = performance.now();
    const dx = e.clientX - st.drag.x;
    const dy = e.clientY - st.drag.y;
    const k = 0.006 / st.zoom;
    st.yaw += dx * k;
    st.pitch = Math.max(-1.2, Math.min(1.2, st.pitch + dy * k));
    const dt = Math.max(0.008, (now - st.drag.t) / 1000);
    st.vel = [(dx * k) / dt, (dy * k) / dt];
    st.drag = { ...st.drag, x: e.clientX, y: e.clientY, t: now, moved: st.drag.moved + Math.abs(dx) + Math.abs(dy) };
  };

  const up = (e: RPointerEvent<HTMLDivElement>) => {
    const st = s.current;
    st.pointers.delete(e.pointerId);
    if (st.pointers.size) return;
    const d = st.drag;
    st.drag = null;
    if (!d) return;
    // A lift after a pause shouldn't fling.
    if (performance.now() - d.t > 80) st.vel = [0, 0];
    if (d.moved < 6) {
      st.vel = [0, 0];
      // Tiles ignore pointer events (the stage owns the gesture), so hit-test them here:
      // the top-most tile under the finger wins.
      let best: { z: number; i: number } | undefined;
      tileEls.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const z = +el.style.zIndex;
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom && (!best || z > best.z)) best = { z, i };
      });
      if (best) onOpen(tiles[best.i].item);
    }
  };

  return (
    <section className="sph" ref={wrap} aria-label="Index of pieces">
      <div
        className="sph-stage"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={(e) => (s.current.zoom = Math.max(0.7, Math.min(2.2, s.current.zoom * Math.exp(-e.deltaY * 0.0012))))}
      >
        {tiles.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              tileEls.current[i] = el;
            }}
            className="sph-tile"
            data-item={t.item.id}
            data-kind={t.photo.kind}
            tabIndex={-1}
            aria-label={[t.item.brand, t.item.name].filter(Boolean).join(" ") || "Piece"}
          >
            <PhotoView photo={t.photo} />
          </button>
        ))}
      </div>

      <div className="sph-hl" ref={hlEl} aria-hidden>
        <span className="sph-hl-tag top" ref={hlTop} />
        <span className="sph-hl-tag bottom" ref={hlBottom} />
      </div>
      <div className="sph-frame" aria-hidden />
      <span className="sph-read tl">
        rotate~ <span ref={readRotate}>0.0°</span>
      </span>
      <span className="sph-read tc">Moods · index · {pad3(items.length)}</span>
      <span className="sph-read tr">photos~ {pad3(photoCount)}</span>
      <span className="sph-read bl">
        zoom~ <span ref={readZoom}>1.00</span>
      </span>
      <span className="sph-read bc">shape~ sphere {pad3(tiles.length)}</span>
      <span className="sph-read br">season~ {season ?? "all"}</span>
    </section>
  );
}
