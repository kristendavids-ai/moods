import { useEffect, useRef, type PointerEvent as RPointerEvent } from "react";
import { geoDistance, geoGraticule10, geoOrthographic, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import type { EuTax } from "../types";

export interface Dot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  tax: EuTax;
}

interface Props {
  dots: Dot[];
  selected?: string;
  /** Changes whenever the globe should ease round to a place. */
  focus?: { lat: number; lon: number; token: number };
  onSelect: (id: string | undefined) => void;
}

const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
const LAND = feature(topo, topo.objects.countries) as GeoPermissibleObjects;
const BORDERS = mesh(topo, topo.objects.countries, (a, b) => a !== b) as GeoPermissibleObjects;
const GRATICULE = geoGraticule10();
const SPHERE = { type: "Sphere" } as GeoPermissibleObjects;

const css = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Several shops in one city fan out slightly so each dot stays tappable. */
function spread(dots: Dot[]): Dot[] {
  const seen = new Map<string, number>();
  return dots.map((d) => {
    const k = `${d.lat.toFixed(2)},${d.lon.toFixed(2)}`;
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    if (!n) return d;
    const a = n * 2.4;
    const r = 0.18 * Math.sqrt(n);
    return { ...d, lat: d.lat + r * Math.sin(a), lon: d.lon + (r * Math.cos(a)) / Math.cos((d.lat * Math.PI) / 180) };
  });
}

export function Globe({ dots, selected, focus, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({
    rot: [-10, -30] as [number, number],
    zoom: 1,
    vel: [0, 0] as [number, number],
    lastTouch: 0,
    anim: null as null | { from: [number, number]; to: [number, number]; start: number },
    pointers: new Map<number, { x: number; y: number }>(),
    drag: null as null | { x: number; y: number; t: number; moved: number; pinch?: number; zoom: number },
    size: { w: 0, h: 0, dpr: 1 },
    dirty: true,
  });
  const latest = useRef({ dots: spread(dots), selected, onSelect });
  latest.current = { dots: spread(dots), selected, onSelect };

  useEffect(() => {
    state.current.dirty = true;
  }, [dots, selected]);

  // Ease round to a focused place, taking the short way across the date line.
  useEffect(() => {
    if (!focus) return;
    const s = state.current;
    const to: [number, number] = [-focus.lon, Math.max(-70, Math.min(70, -focus.lat))];
    const d = ((((to[0] - s.rot[0]) % 360) + 540) % 360) - 180;
    s.anim = { from: [...s.rot] as [number, number], to: [s.rot[0] + d, to[1]], start: performance.now() };
    s.vel = [0, 0];
    s.lastTouch = performance.now();
  }, [focus?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = wrap.current!;
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    const s = state.current;
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      s.size = { w: el.clientWidth, h: el.clientHeight, dpr };
      cv.width = Math.round(s.size.w * dpr);
      cv.height = Math.round(s.size.h * dpr);
      s.dirty = true;
    });
    ro.observe(el);

    const colours = {
      paper: css("--white", "#fff"),
      plate: css("--plate", "#efeeeb"),
      ink: css("--ink", "#0a0a0a"),
      mute: css("--mute", "#8d8d88"),
      hair: css("--hair", "rgba(10,10,10,.12)"),
    };
    let raf = 0;
    let lastDots = "";

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const { w, h, dpr } = s.size;
      if (!w || !h) return;

      if (s.anim) {
        const t = Math.min(1, (now - s.anim.start) / 900);
        const e = 1 - Math.pow(1 - t, 3);
        s.rot = [s.anim.from[0] + (s.anim.to[0] - s.anim.from[0]) * e, s.anim.from[1] + (s.anim.to[1] - s.anim.from[1]) * e];
        if (t >= 1) s.anim = null;
        s.dirty = true;
      } else if (!s.drag && (Math.abs(s.vel[0]) > 0.01 || Math.abs(s.vel[1]) > 0.01)) {
        s.rot = [s.rot[0] + s.vel[0], Math.max(-80, Math.min(80, s.rot[1] + s.vel[1]))];
        s.vel = [s.vel[0] * 0.94, s.vel[1] * 0.94];
        s.dirty = true;
      } else if (!s.drag && !latest.current.selected && !reduced() && now - s.lastTouch > 6000) {
        s.rot = [s.rot[0] + 0.06, s.rot[1]];
        s.dirty = true;
      }
      if (!s.dirty) return;
      s.dirty = false;

      const r = (Math.min(w, h) / 2 - 10) * s.zoom;
      const proj = geoOrthographic().rotate(s.rot).scale(r).translate([w / 2, h / 2]).clipAngle(90).precision(0.4);
      const path = geoPath(proj, ctx);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      ctx.beginPath();
      path(SPHERE);
      ctx.fillStyle = colours.paper;
      ctx.fill();
      ctx.beginPath();
      path(GRATICULE);
      ctx.strokeStyle = colours.hair;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.beginPath();
      path(LAND);
      ctx.fillStyle = colours.plate;
      ctx.fill();
      ctx.beginPath();
      path(BORDERS);
      ctx.strokeStyle = "rgba(10,10,10,.32)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.beginPath();
      path(SPHERE);
      ctx.strokeStyle = colours.ink;
      ctx.lineWidth = 1;
      ctx.stroke();

      const centre: [number, number] = [-s.rot[0], -s.rot[1]];
      const visible: { id: string; x: number; y: number }[] = [];
      const { dots: ds, selected: sel } = latest.current;
      for (const d of ds) {
        if (geoDistance([d.lon, d.lat], centre) > Math.PI / 2 - 0.03) continue;
        const p = proj([d.lon, d.lat]);
        if (!p) continue;
        const [x, y] = p;
        visible.push({ id: d.id, x: Math.round(x), y: Math.round(y) });
        ctx.beginPath();
        if (d.tax === "paid") {
          ctx.arc(x, y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = colours.ink;
          ctx.fill();
        } else if (d.tax === "due") {
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = colours.paper;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = colours.ink;
          ctx.stroke();
        } else {
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = colours.mute;
          ctx.fill();
        }
        if (d.id === sel) {
          ctx.beginPath();
          ctx.arc(x, y, 10, 0, Math.PI * 2);
          ctx.lineWidth = 1;
          ctx.strokeStyle = colours.ink;
          ctx.stroke();
          ctx.font = "500 11px Inter, Helvetica Neue, Arial, sans-serif";
          const label = d.name;
          const tw = ctx.measureText(label).width;
          const lx = Math.min(x + 14, w - tw - 12);
          ctx.fillStyle = colours.ink;
          ctx.fillRect(lx - 5, y - 9, tw + 10, 18);
          ctx.fillStyle = colours.paper;
          ctx.fillText(label, lx, y + 4);
        }
      }
      // Exposed for tests and accessibility tooling: which dots are on screen, and where.
      const sig = JSON.stringify(visible);
      if (sig !== lastDots) {
        cv.dataset.dots = sig;
        lastDots = sig;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const s = state.current;
  const down = (e: RPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    s.anim = null;
    s.vel = [0, 0];
    s.lastTouch = performance.now();
    const pts = [...s.pointers.values()];
    s.drag = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      moved: s.drag?.moved ?? 0,
      zoom: s.zoom,
      pinch: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined,
    };
  };

  const move = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!s.drag || !s.pointers.has(e.pointerId)) return;
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...s.pointers.values()];
    if (pts.length === 2 && s.drag.pinch) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      s.zoom = Math.max(0.8, Math.min(6, (s.drag.zoom * dist) / s.drag.pinch));
      s.drag.moved += 10;
      s.dirty = true;
      return;
    }
    const dx = e.clientX - s.drag.x;
    const dy = e.clientY - s.drag.y;
    const k = 0.3 / s.zoom;
    s.rot = [s.rot[0] + dx * k, Math.max(-80, Math.min(80, s.rot[1] - dy * k))];
    s.vel = [dx * k, -dy * k];
    s.drag = { ...s.drag, x: e.clientX, y: e.clientY, moved: s.drag.moved + Math.abs(dx) + Math.abs(dy) };
    s.lastTouch = performance.now();
    s.dirty = true;
  };

  const up = (e: RPointerEvent<HTMLCanvasElement>) => {
    s.pointers.delete(e.pointerId);
    const d = s.drag;
    if (s.pointers.size) return;
    s.drag = null;
    if (!d) return;
    if (d.moved < 6) {
      s.vel = [0, 0];
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const visible: { id: string; x: number; y: number }[] = JSON.parse(e.currentTarget.dataset.dots || "[]");
      let best: { id: string; dist: number } | undefined;
      for (const v of visible) {
        const dist = Math.hypot(v.x - x, v.y - y);
        if (dist < 18 && (!best || dist < best.dist)) best = { id: v.id, dist };
      }
      latest.current.onSelect(best?.id);
    }
  };

  const zoomBy = (f: number) => {
    s.zoom = Math.max(0.8, Math.min(6, s.zoom * f));
    s.lastTouch = performance.now();
    s.dirty = true;
  };

  return (
    <div className="globe" ref={wrap}>
      <canvas
        ref={canvas}
        className="globe-canvas"
        aria-label="Globe of boutiques"
        role="img"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1)}
      />
      <div className="globe-zoom">
        <button onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">
          −
        </button>
        <button onClick={() => zoomBy(1.4)} aria-label="Zoom in">
          +
        </button>
      </div>
    </div>
  );
}
