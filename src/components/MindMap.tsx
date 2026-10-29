import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Item, Photo } from "../types";
import { PhotoView } from "./PhotoView";
import { CategoryIcon } from "./CategoryIcon";

interface Props {
  items: Item[];
  note: string;
  onOpen: (item: Item) => void;
}

interface Node {
  key: string;
  item: Item;
  photo: Photo;
  /** Centre and size, in world px. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A category's symbol, out on the ring around the pieces. */
interface Hub {
  category: string;
  x: number;
  y: number;
  /** Indices of the category's nodes (every photo). */
  nodes: number[];
  pieces: number;
}

interface Edge {
  id: string;
  /** Item ids at each end; a symbol end is `hub:<category>`. */
  a: string;
  b: string;
  p1: [number, number];
  p2: [number, number];
  d: string;
  from: string;
  to: string;
  /** Full-strength colour for glows and traced lines (the far end's piece). */
  strong: string;
  category: string;
  spoke: boolean;
}

const BASE = 120;
const CELL = 360; // world area per node, px² — generous, so photos sit well apart
const GAP = 60; // least clear space between photos
const SPREAD_TRIES = 24;
const RING = 160; // the outskirts around the pieces, where the symbols sit
const HUB = 56;
const SPOKE_INK = "#a9a7a0";
const CLOSE_FILL = 0.6; // a focused piece fills this share of the width
const MAX_ZOOM = 3.5;
const HIGHLIGHT_EVERY = 2400;
const HIGHLIGHT_FALLBACK = "#27c93f";
const PASTELS = ["#f5c6d0", "#f4e4a1", "#cfe3c4", "#c6dcf2", "#ddd0f2"];
const DEEPS = ["#e0889e", "#d4b13a", "#86b373", "#74a2d6", "#a48ed6"];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

/** Black or white text, whichever reads better on `hex`. */
const inkOn = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#0a0a0a" : "#ffffff";
};

/** The piece's colour mixed 35% towards white; a soft category pastel when it has none. */
export function pastelOf(item: Item): string {
  const hex = item.colour?.hex;
  if (hex && /^#[0-9a-f]{6}$/i.test(hex)) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c: number) => Math.round(c + (255 - c) * 0.35);
    const [r, g, b] = [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)];
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }
  return PASTELS[categoryHash(item.category) % PASTELS.length];
}

function categoryHash(category: string) {
  let h = 0;
  for (const ch of category) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** The piece's own colour at full strength (darkened if too pale to see on paper). */
export function strongOf(item: Item): string {
  const hex = item.colour?.hex;
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return DEEPS[categoryHash(item.category) % DEEPS.length];
  const n = parseInt(hex.slice(1), 16);
  let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum > 190) [r, g, b] = [r, g, b].map((c) => Math.round(c * (150 / lum)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Where a ray from the centre at angle `a` meets the symbols' ring (a rectangle). */
function onRing(a: number, W: number, H: number) {
  const rx = W / 2 - RING * 0.5;
  const ry = H / 2 - RING * 0.5;
  const t = 1 / Math.max(Math.abs(Math.cos(a)) / rx, Math.abs(Math.sin(a)) / ry);
  return { x: W / 2 + Math.cos(a) * t, y: H / 2 + Math.sin(a) * t };
}

/**
 * Scatters one node per photo with no overlaps (dart throwing, growing the world if it
 * gets crowded). Category plays no part, so a category's lines cross the map.
 *
 * The symbols' slots are spaced evenly round the ring first, and photos keep clear of
 * the room each symbol takes at overview zoom (symbols stay a fixed size on screen, so
 * the more zoomed out, the more of the map they cover). Each category then takes the
 * slot nearest its pieces' side.
 *
 * `aspect` is the height ÷ width the whole map should have, and `viewW` the screen
 * width, so the map's shape and the symbols' room follow the screen.
 */
function layout(items: Item[], aspect: number, viewW: number): { nodes: Node[]; W: number; H: number; hubs: Hub[] } {
  const photos = shuffle(items.flatMap((item) => item.photos.map((photo) => ({ item, photo }))));
  const categories = [...new Set(items.map((i) => i.category))];
  // Inner width w with (h + 2R) / (w + 2R) = aspect and w·h = the area the photos need.
  const area = Math.max(1, photos.length) * CELL * CELL;
  const b = 2 * RING * (aspect - 1);
  let side = Math.max(360, (-b + Math.sqrt(b * b + 4 * aspect * area)) / (2 * aspect));
  const tall = (w: number) => Math.max(360, aspect * (w + 2 * RING) - 2 * RING);

  for (let attempt = 0; attempt < 10; attempt++, side *= 1.1) {
    const W = side + RING * 2;
    const H = tall(side) + RING * 2;
    const slots = ringSlots(categories.length, W, H);
    // A symbol's room on screen at overview (circle above, label below), in world px.
    const k = Math.min(1, (viewW - 80) / W);
    const [hw, up, down] = [44 / k, 24 / k, 42 / k];
    const nodes: Node[] = [];
    let ok = true;
    for (const { item, photo } of photos) {
      const w = BASE * rand(0.6, 1.4);
      const h = w * 1.25;
      // Of several clear spots, take the one furthest from everything already placed,
      // so photos spread evenly over the canvas instead of clumping.
      let best: { x: number; y: number; room: number } | undefined;
      for (let t = 0, found = 0; t < 400 && found < SPREAD_TRIES; t++) {
        const x = rand(RING + w / 2, W - RING - w / 2);
        const y = rand(RING + h / 2, H - RING - h / 2);
        const clear =
          nodes.every((o) => Math.abs(o.x - x) > (o.w + w) / 2 + GAP || Math.abs(o.y - y) > (o.h + h) / 2 + GAP) &&
          slots.every((sl) => x + w / 2 < sl.x - hw || x - w / 2 > sl.x + hw || y + h / 2 < sl.y - up || y - h / 2 > sl.y + down);
        if (!clear) continue;
        found++;
        const room = nodes.reduce((m, o) => Math.min(m, Math.hypot(o.x - x, o.y - y) - (o.w + w) / 2), Infinity);
        if (!best || room > best.room) best = { x, y, room };
      }
      if (best) nodes.push({ key: `${photo.id}`, item, photo, x: best.x, y: best.y, w, h });
      else {
        ok = false;
        break;
      }
    }
    if (ok) return { nodes, W, H, hubs: assignHubs(nodes, slots, W, H) };
  }

  // Fallback: a loose grid that can't overlap, ring round it.
  const cols = Math.ceil(Math.sqrt(photos.length));
  const W = cols * CELL + RING * 2;
  const H = Math.ceil(photos.length / cols) * CELL + RING * 2;
  const nodes = photos.map(({ item, photo }, i) => {
    const w = BASE * rand(0.6, 1.1);
    return { key: photo.id, item, photo, x: RING + (i % cols) * CELL + CELL / 2, y: RING + Math.floor(i / cols) * CELL + CELL / 2, w, h: w * 1.25 };
  });
  return { nodes, W, H, hubs: assignHubs(nodes, ringSlots(categories.length, W, H), W, H) };
}

/** `n` slots spaced evenly round the ring, starting at the top. */
function ringSlots(n: number, W: number, H: number) {
  const step = (Math.PI * 2) / Math.max(1, n);
  return Array.from({ length: n }, (_, i) => onRing(-Math.PI / 2 + i * step, W, H));
}

/**
 * Gives each category a slot: categories in order of where their pieces lie from the
 * centre, turned round the ring to sit as near their pieces' side as they can.
 */
function assignHubs(nodes: Node[], slots: { x: number; y: number }[], W: number, H: number): Hub[] {
  const angle = (x: number, y: number) => Math.atan2(y - H / 2, x - W / 2);
  const groups = new Map<string, number[]>();
  nodes.forEach((n, i) => groups.set(n.item.category, [...(groups.get(n.item.category) ?? []), i]));
  const cats = [...groups.entries()]
    .map(([category, idx]) => ({
      category,
      idx,
      angle: angle(idx.reduce((s, i) => s + nodes[i].x, 0) / idx.length, idx.reduce((s, i) => s + nodes[i].y, 0) / idx.length),
    }))
    .sort((a, b) => a.angle - b.angle);
  const ordered = [...slots].sort((a, b) => angle(a.x, a.y) - angle(b.x, b.y));
  const n = cats.length;
  const gap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  let shift = 0;
  let best = Infinity;
  for (let sh = 0; sh < n; sh++) {
    const cost = cats.reduce((sum, c, i) => sum + gap(c.angle, angle(ordered[(i + sh) % n].x, ordered[(i + sh) % n].y)), 0);
    if (cost < best) [best, shift] = [cost, sh];
  }
  return cats.map((c, i) => ({
    category: c.category,
    ...ordered[(i + shift) % n],
    nodes: c.idx,
    pieces: new Set(c.idx.map((j) => nodes[j].item.id)).size,
  }));
}

function curve(a: { x: number; y: number }, b: { x: number; y: number }, bend = rand(0.1, 0.25)): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const bow = bend * (Math.random() < 0.5 ? -1 : 1);
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${(mx - dy * bow).toFixed(1)},${(my + dx * bow).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}

/**
 * Per category, the shortest tree linking its pieces; each piece's two photos; and a
 * spoke from the category's symbol to every piece in it.
 */
function connect(nodes: Node[], hubs: Hub[]): Edge[] {
  const edges: Edge[] = [];
  const add = (a: number, b: number) =>
    edges.push({
      id: `e${edges.length}`,
      a: nodes[a].item.id,
      b: nodes[b].item.id,
      p1: [nodes[a].x, nodes[a].y],
      p2: [nodes[b].x, nodes[b].y],
      d: curve(nodes[a], nodes[b]),
      from: pastelOf(nodes[a].item),
      to: pastelOf(nodes[b].item),
      strong: strongOf(nodes[b].item),
      category: nodes[a].item.category,
      spoke: false,
    });

  const firstOfPiece = new Map<string, number>();
  nodes.forEach((n, i) => {
    const first = firstOfPiece.get(n.item.id);
    if (first === undefined) firstOfPiece.set(n.item.id, i);
    else add(first, i);
  });

  const byCategory = new Map<string, number[]>();
  for (const i of firstOfPiece.values()) {
    const c = nodes[i].item.category;
    byCategory.set(c, [...(byCategory.get(c) ?? []), i]);
  }
  for (const group of byCategory.values()) {
    // Prim's algorithm on straight-line distance.
    const inTree = new Set([group[0]]);
    while (inTree.size < group.length) {
      let best: [number, number, number] | undefined;
      for (const a of inTree)
        for (const b of group)
          if (!inTree.has(b)) {
            const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
            if (!best || d < best[2]) best = [a, b, d];
          }
      add(best![0], best![1]);
      inTree.add(best![1]);
    }
  }

  for (const hub of hubs) {
    for (const i of firstOfPiece.values()) {
      const n = nodes[i];
      if (n.item.category !== hub.category) continue;
      edges.push({
        id: `e${edges.length}`,
        a: `hub:${hub.category}`,
        b: n.item.id,
        p1: [hub.x, hub.y],
        p2: [n.x, n.y],
        d: curve(hub, n, rand(0.04, 0.12)),
        from: SPOKE_INK,
        to: pastelOf(n.item),
        strong: strongOf(n.item),
        category: hub.category,
        spoke: true,
      });
    }
  }
  return edges;
}

/**
 * The board's Index: a living mind map. Every photo is scattered over a white canvas you
 * drag and zoom; pastel lines link pieces in the same category and glow now and then; a
 * roving border picks out a piece at a time; tapping glides to a piece to view it.
 */
export function MindMap({ items, note, onOpen }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const nodeEls = useRef<(HTMLDivElement | null)[]>([]);
  const pathEls = useRef<(SVGPathElement | null)[]>([]);
  const hubEls = useRef<(HTMLDivElement | null)[]>([]);
  const glowEl = useRef<SVGSVGElement>(null);
  const captionEl = useRef<HTMLDivElement>(null);
  const hlEl = useRef<HTMLDivElement>(null);
  const hlTop = useRef<HTMLSpanElement>(null);
  const hlBottom = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState<number>(-1);
  const [level, setLevel] = useState(1);
  const [fitted, setFitted] = useState(false);
  const focusedRef = useRef(-1);
  focusedRef.current = focused;
  // The category whose symbol was tapped: its lines and pieces are picked out.
  const [active, setActive] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = active;

  const key = items.map((i) => `${i.id}:${i.photos.length}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { nodes, W, H, hubs } = useMemo(() => {
    // The map's shape follows the stage's free area at overview (see levels()): the stage
    // is the screen less ~200px of header, tabs and bottom bar.
    const aspect = Math.max(0.55, Math.min(2.2, (window.innerHeight - 200 - 110) / Math.max(240, window.innerWidth - 80)));
    return layout(items, aspect, window.innerWidth);
  }, [key]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const edges = useMemo(() => connect(nodes, hubs), [hubs]);

  const cam = useRef({
    x: 0,
    y: 0,
    k: 1,
    vel: [0, 0] as [number, number],
    size: { w: 0, h: 0 },
    glide: null as null | { from: [number, number, number]; to: [number, number, number]; start: number },
    pointers: new Map<number, { x: number; y: number }>(),
    drag: null as null | { x: number; y: number; t: number; moved: number; pinch?: number; k: number },
    started: false,
  });

  const levels = () => {
    const { w, h } = cam.current.size;
    // Clear of the zoom control and the note, so the symbols out on the ring stay visible.
    const overview = Math.min(1, Math.min((w - 80) / W, (h - 110) / H));
    return [overview, Math.min(1, overview * 2.1), Math.min(MAX_ZOOM, Math.max(2.2, (w * CLOSE_FILL) / BASE))];
  };
  const minZoom = () => Math.min(0.35, levels()[0]);

  const clampPan = () => {
    const c = cam.current;
    const m = 120;
    c.x = Math.max(-m, Math.min(W + m, c.x));
    c.y = Math.max(-m, Math.min(H + m, c.y));
  };

  const glideTo = (x: number, y: number, k: number) => {
    const c = cam.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      Object.assign(c, { x, y, k });
      return;
    }
    c.glide = { from: [c.x, c.y, c.k], to: [x, y, k], start: performance.now() };
    c.vel = [0, 0];
  };

  const focusNode = (i: number) => {
    const n = nodes[i];
    const { w } = cam.current.size;
    const k = Math.min(MAX_ZOOM, Math.max(1.5, (w * CLOSE_FILL) / n.w));
    glideTo(n.x, n.y + n.h * 0.12, k);
    setFocused(i);
  };

  const unfocus = () => focusedRef.current >= 0 && setFocused(-1);

  /** Picks out a category (or clears it) and frames its symbol and all its pieces. */
  const trace = (h: number) => {
    const hub = hubs[h];
    if (!hub) return;
    if (activeRef.current === hub.category) return setActive(null);
    setActive(hub.category);
    setFocused(-1);
    let [x0, y0, x1, y1] = [hub.x - HUB, hub.y - HUB, hub.x + HUB, hub.y + HUB];
    for (const i of hub.nodes) {
      const n = nodes[i];
      x0 = Math.min(x0, n.x - n.w / 2);
      y0 = Math.min(y0, n.y - n.h / 2);
      x1 = Math.max(x1, n.x + n.w / 2);
      y1 = Math.max(y1, n.y + n.h / 2);
    }
    const { w, h: sh } = cam.current.size;
    // Leave room for the zoom control and the note.
    const k = Math.max(minZoom(), Math.min(1.4, Math.min((w - 150) / (x1 - x0), (sh - 130) / (y1 - y0))));
    // Shifted left of centre, clear of the zoom control on the right.
    glideTo((x0 + x1) / 2 + 30 / k, (y0 + y1) / 2 + 30 / k, k);
  };

  // Fill the screen between the tabs and the bottom bar.
  useLayoutEffect(() => {
    const el = wrap.current!;
    const fit = () => {
      el.style.setProperty("--stage-top", `${Math.max(0, el.getBoundingClientRect().top + window.scrollY)}px`);
      cam.current.size = { w: el.clientWidth, h: el.clientHeight };
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => (ro.disconnect(), window.removeEventListener("resize", fit));
  }, []);

  // Open at mid zoom on a random piece, so the screen starts full.
  useEffect(() => {
    const c = cam.current;
    const n = nodes[Math.floor(Math.random() * nodes.length)];
    // Mid zoom: a handful of pieces on screen, as the reference opens.
    if (n) Object.assign(c, { x: n.x, y: n.y, k: levels()[1], glide: null, vel: [0, 0] });
    setFocused(-1);
    setActive(null);
  }, [nodes]);

  // Camera, caption and highlight loop.
  useEffect(() => {
    const c = cam.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    let lastLevel = -1;
    let lastFitted: boolean | undefined;
    const hl = { i: -1, since: 0, lastItem: "", category: null as string | null };

    const toScreen = (n: Node) => {
      const { w, h } = c.size;
      return { x: w / 2 + (n.x - n.w / 2 - c.x) * c.k, y: h / 2 + (n.y - n.h / 2 - c.y) * c.k, w: n.w * c.k, h: n.h * c.k };
    };

    const showHighlight = (i: number, now: number) => {
      const el = hlEl.current;
      if (!el) return;
      hl.i = i;
      hl.since = now;
      if (i < 0) {
        el.style.opacity = "0";
        return;
      }
      const { item } = nodes[i];
      hl.lastItem = item.id;
      const colour = item.colour?.hex || HIGHLIGHT_FALLBACK;
      el.style.setProperty("--hl", colour);
      el.style.setProperty("--hl-ink", inkOn(colour));
      el.dataset.item = item.id;
      el.dataset.node = String(i);
      if (hlTop.current) hlTop.current.textContent = item.brand || "Unknown";
      if (hlBottom.current) hlBottom.current.textContent = item.name || item.category;
      el.style.transition = "none";
      el.style.opacity = "0";
      requestAnimationFrame(() => {
        el.style.transition = reduced ? "none" : "opacity 120ms ease";
        el.style.opacity = "1";
      });
    };

    const pickHighlight = (now: number) => {
      const { w, h } = c.size;
      const onScreen = nodes
        .map((n, i) => ({ r: toScreen(n), i }))
        .filter(({ r }) => r.x > 12 && r.y > 22 && r.x + r.w < w - 52 && r.y + r.h < h - 110 && r.w > 46);
      const cat = activeRef.current;
      const inCat = cat ? onScreen.filter(({ i }) => nodes[i].item.category === cat) : onScreen;
      const fresh = inCat.filter(({ i }) => nodes[i].item.id !== hl.lastItem);
      const pool = fresh.length ? fresh : inCat;
      showHighlight(pool.length ? pool[Math.floor(Math.random() * pool.length)].i : -1, now);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w, h } = c.size;
      if (!w || !h) return;

      if (c.glide) {
        const t = Math.min(1, (now - c.glide.start) / 700);
        const e = 1 - Math.pow(1 - t, 3);
        const [fx, fy, fk] = c.glide.from;
        const [tx, ty, tk] = c.glide.to;
        c.x = fx + (tx - fx) * e;
        c.y = fy + (ty - fy) * e;
        c.k = fk * Math.pow(tk / fk, e);
        if (t >= 1) c.glide = null;
      } else if (!c.drag && (Math.abs(c.vel[0]) > 1 || Math.abs(c.vel[1]) > 1)) {
        c.x -= (c.vel[0] * dt) / c.k;
        c.y -= (c.vel[1] * dt) / c.k;
        const decay = Math.exp(-dt * 4);
        c.vel = [c.vel[0] * decay, c.vel[1] * decay];
        clampPan();
      }

      if (world.current) {
        world.current.style.transform = `translate3d(${(w / 2 - c.x * c.k).toFixed(1)}px, ${(h / 2 - c.y * c.k).toFixed(1)}px, 0) scale(${c.k.toFixed(4)})`;
      }
      wrap.current?.style.setProperty("--k", c.k.toFixed(4));
      // Symbols never shrink below ~36px on screen, so they stay tappable zoomed right out.
      wrap.current?.style.setProperty("--hub-s", Math.max(1, 0.64 / c.k).toFixed(3));

      // Zoom dashes: nearest of the three levels (on a log scale).
      const lv = levels();
      const nearest = lv.reduce((best, v, i) => (Math.abs(Math.log(c.k / v)) < Math.abs(Math.log(c.k / lv[best])) ? i : best), 0);
      if (nearest !== lastLevel) {
        lastLevel = nearest;
        setLevel(nearest);
      }
      // "−" stays live until the whole map, symbols and all, is in view.
      const isFitted = c.k <= lv[0] * 1.03;
      if (isFitted !== lastFitted) {
        lastFitted = isFitted;
        setFitted(isFitted);
      }

      // Caption follows the focused node.
      const f = focusedRef.current;
      if (captionEl.current && f >= 0 && nodes[f]) {
        const r = toScreen(nodes[f]);
        captionEl.current.style.transform = `translate3d(${(r.x + r.w / 2).toFixed(1)}px, ${(r.y + r.h + 10).toFixed(1)}px, 0) translateX(-50%)`;
      }

      // Highlight: hidden while a piece is focused; otherwise a new on-screen node every few seconds.
      if (f >= 0) {
        if (hl.i >= 0) showHighlight(-1, now);
      } else {
        const cur = hl.i >= 0 ? toScreen(nodes[hl.i]) : undefined;
        const gone = cur && (cur.x + cur.w < 0 || cur.y + cur.h < 0 || cur.x > w || cur.y > h);
        const traced = activeRef.current !== hl.category;
        if (traced) hl.category = activeRef.current;
        if (!cur || gone || traced || now - hl.since > HIGHLIGHT_EVERY) pickHighlight(now);
        if (hl.i >= 0 && hlEl.current) {
          const r = toScreen(nodes[hl.i]);
          const s = hlEl.current.style;
          s.transform = `translate3d(${(r.x - 5).toFixed(1)}px, ${(r.y - 5).toFixed(1)}px, 0)`;
          s.width = `${(r.w + 10).toFixed(1)}px`;
          s.height = `${(r.h + 10).toFixed(1)}px`;
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // Lines glow now and then, at irregular moments; several can glow at once.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !edges.length) return;
    let timer = 0;
    const tick = () => {
      const cat = activeRef.current;
      const free = pathEls.current.filter(
        (p) => p && !p.classList.contains("glow") && (!cat || p.dataset.category === cat),
      ) as SVGPathElement[];
      const p = free[Math.floor(Math.random() * free.length)];
      if (p) {
        const dur = `${rand(1.2, 2.8).toFixed(2)}s`;
        p.style.animationDuration = dur;
        p.classList.add("glow");
        p.addEventListener("animationend", () => p.classList.remove("glow"), { once: true });
        // A soft wide halo and a bright core in the piece's full colour, drawn over the line.
        for (const cls of ["halo", "flare"]) {
          const g = document.createElementNS("http://www.w3.org/2000/svg", "path");
          g.setAttribute("d", p.getAttribute("d")!);
          g.setAttribute("class", cls);
          g.style.stroke = p.dataset.strong!;
          g.style.animationDuration = dur;
          g.addEventListener("animationend", () => g.remove(), { once: true });
          glowEl.current?.appendChild(g);
        }
      }
      timer = window.setTimeout(tick, rand(250, 1600));
    };
    timer = window.setTimeout(tick, rand(250, 900));
    return () => window.clearTimeout(timer);
  }, [edges]);

  // Gestures: drag to pan (with momentum), pinch or wheel to zoom, tap to focus/open.
  const down = (e: RPointerEvent<HTMLDivElement>) => {
    const c = cam.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    c.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...c.pointers.values()];
    c.vel = [0, 0];
    c.glide = null;
    c.drag = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      moved: c.drag?.moved ?? 0,
      k: c.k,
      pinch: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined,
    };
  };

  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const c = cam.current;
    if (!c.drag || !c.pointers.has(e.pointerId)) return;
    c.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...c.pointers.values()];
    if (pts.length === 2 && c.drag.pinch) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      c.k = Math.max(minZoom(), Math.min(MAX_ZOOM, (c.drag.k * dist) / c.drag.pinch));
      c.drag.moved += 10;
      unfocus();
      return;
    }
    const now = performance.now();
    const dx = e.clientX - c.drag.x;
    const dy = e.clientY - c.drag.y;
    c.x -= dx / c.k;
    c.y -= dy / c.k;
    clampPan();
    const dt = Math.max(0.008, (now - c.drag.t) / 1000);
    c.vel = [dx / dt, dy / dt];
    c.drag = { ...c.drag, x: e.clientX, y: e.clientY, t: now, moved: c.drag.moved + Math.abs(dx) + Math.abs(dy) };
    if (c.drag.moved > 6) unfocus();
  };

  const up = (e: RPointerEvent<HTMLDivElement>) => {
    const c = cam.current;
    c.pointers.delete(e.pointerId);
    if (c.pointers.size) return;
    const d = c.drag;
    c.drag = null;
    if (!d) return;
    if (performance.now() - d.t > 80) c.vel = [0, 0];
    if (d.moved >= 6) return;
    c.vel = [0, 0];
    // Nodes and symbols ignore pointer events (the stage owns gestures), so hit-test them here.
    const hubHit = hubEls.current.findIndex((el) => {
      const r = el?.querySelector(".map-hub-mark")?.getBoundingClientRect();
      return r && e.clientX >= r.left - 8 && e.clientX <= r.right + 8 && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8;
    });
    if (hubHit >= 0) return trace(hubHit);
    let hit = -1;
    nodeEls.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) hit = i;
    });
    if (hit < 0) return focusedRef.current >= 0 ? unfocus() : setActive(null);
    if (hit === focusedRef.current) onOpen(nodes[hit].item);
    else focusNode(hit);
  };

  const step = (dir: 1 | -1) => {
    const c = cam.current;
    const lv = levels();
    const next = Math.max(0, Math.min(2, level + dir));
    if (dir < 0) unfocus();
    if (next === 2 && dir > 0) {
      // Zooming to close: focus the node nearest the centre of the screen.
      let best = 0;
      nodes.forEach((n, i) => {
        if (Math.hypot(n.x - c.x, n.y - c.y) < Math.hypot(nodes[best].x - c.x, nodes[best].y - c.y)) best = i;
      });
      if (nodes[best]) return focusNode(best);
    }
    // Overview sits a little high, clear of the note.
    if (next === 0) glideTo(W / 2 + 15 / lv[0], H / 2 + 30 / lv[0], lv[0]);
    else glideTo(c.x, c.y, lv[next]);
  };

  const fItem = focused >= 0 ? nodes[focused]?.item : undefined;

  return (
    <section className="map" ref={wrap} aria-label="Index: a map of your pieces">
      <div
        className="map-stage"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={(e) => {
          const c = cam.current;
          c.glide = null;
          c.k = Math.max(minZoom(), Math.min(MAX_ZOOM, c.k * Math.exp(-e.deltaY * 0.0015)));
          if (e.deltaY > 0) unfocus();
        }}
      >
        <div className="map-world" ref={world} style={{ width: W, height: H }}>
          <svg className="map-lines" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
            <defs>
              {edges.map((e) => (
                <linearGradient
                  key={e.id}
                  id={`g-${e.id}`}
                  gradientUnits="userSpaceOnUse"
                  x1={e.p1[0]}
                  y1={e.p1[1]}
                  x2={e.p2[0]}
                  y2={e.p2[1]}
                >
                  <stop offset="0" stopColor={e.from} />
                  <stop offset="1" stopColor={e.to} />
                </linearGradient>
              ))}
            </defs>
            {edges.map((e, i) => (
              <path
                key={e.id}
                ref={(el) => {
                  pathEls.current[i] = el;
                }}
                d={e.d}
                className={[e.spoke && "spoke", active && (e.category === active ? "on" : "off")].filter(Boolean).join(" ") || undefined}
                stroke={`url(#g-${e.id})`}
                data-from={e.from}
                data-to={e.to}
                data-a={e.a}
                data-b={e.b}
                data-category={e.category}
                data-strong={e.strong}
                style={{ ["--strong" as string]: e.strong }}
              />
            ))}
          </svg>
          <svg className="map-glow" ref={glowEl} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden />
          {nodes.map((n, i) => (
            <div
              key={n.key}
              ref={(el) => {
                nodeEls.current[i] = el;
              }}
              className={`map-node${n.photo.kind === "item" && n.photo.mode === "compose" ? " cutout" : ""}${i === focused ? " focused" : ""}${active && n.item.category !== active ? " off" : ""}`}
              data-item={n.item.id}
              data-kind={n.photo.kind}
              aria-label={[n.item.brand, n.item.name].filter(Boolean).join(" ") || "Piece"}
              style={{ left: n.x - n.w / 2, top: n.y - n.h / 2, width: n.w, height: n.h, animationDelay: `${Math.min(600, i * 12)}ms` }}
            >
              <PhotoView photo={n.photo} />
            </div>
          ))}
          {hubs.map((hub, i) => (
            <div
              key={hub.category}
              ref={(el) => {
                hubEls.current[i] = el;
              }}
              className={`map-hub${active === hub.category ? " on" : active ? " off" : ""}`}
              data-category={hub.category}
              role="button"
              aria-pressed={active === hub.category}
              aria-label={`${hub.category}: ${hub.pieces} ${hub.pieces === 1 ? "piece" : "pieces"}`}
              style={{ left: hub.x, top: hub.y }}
            >
              <span className="map-hub-mark">
                <CategoryIcon category={hub.category} size={HUB} />
              </span>
              <span className="map-hub-label">
                {hub.category}
                <sup>{hub.pieces}</sup>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="map-hl" ref={hlEl} aria-hidden>
        <span className="map-hl-tag top" ref={hlTop} />
        <span className="map-hl-tag bottom" ref={hlBottom} />
      </div>

      {fItem && (
        <div className="map-caption" ref={captionEl}>
          <span>{[fItem.brand, fItem.name].filter(Boolean).join(" — ") || "Piece"}</span>
          <button onClick={() => onOpen(fItem)}>View piece →</button>
        </div>
      )}

      {note.trim() && <p className="map-note">{note}</p>}

      <div className="map-zoom" role="group" aria-label="Zoom">
        <button onClick={() => step(1)} aria-label="Zoom in" disabled={level === 2}>
          +
        </button>
        <div className="map-levels" aria-label={`Zoom level ${level + 1} of 3`}>
          {[2, 1, 0].map((l) => (
            <span key={l} className={l === level ? "on" : undefined} />
          ))}
        </div>
        <button onClick={() => step(-1)} aria-label="Zoom out" disabled={level === 0 && fitted}>
          −
        </button>
      </div>
    </section>
  );
}
