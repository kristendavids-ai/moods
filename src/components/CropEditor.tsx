import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import type { PhotoKind, Rect } from "../types";
import { WORN_ASPECT } from "../lib/frame";

interface Props {
  src: string;
  size: { w: number; h: number };
  kind: PhotoKind;
  rect: Rect;
  auto: Rect;
  onDone: (r: Rect) => void;
  onCancel: () => void;
}

type Corner = "tl" | "tr" | "bl" | "br";
type Drag = { mode: "move" | Corner; px: number; py: number; start: Rect };

const MIN = 0.08;

export function CropEditor({ src, size, kind, rect: initial, auto, onDone, onCancel }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [disp, setDisp] = useState({ w: 0, h: 0 });
  const [r, setR] = useState(initial);
  const drag = useRef<Drag | null>(null);
  // Normalised height per unit of normalised width that keeps a 4:5 frame in pixels.
  const k = size.w / (size.h * WORN_ASPECT);
  const locked = kind === "worn";

  useLayoutEffect(() => {
    const el = stageRef.current!;
    const fit = () => {
      const s = Math.min(el.clientWidth / size.w, el.clientHeight / size.h);
      setDisp({ w: size.w * s, h: size.h * s });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size.w, size.h]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const down = (mode: Drag["mode"]) => (e: PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, px: e.clientX, py: e.clientY, start: r };
  };

  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || !disp.w) return;
    const dx = (e.clientX - d.px) / disp.w;
    const dy = (e.clientY - d.py) / disp.h;
    const s = d.start;

    if (d.mode === "move") {
      setR({ ...s, x: Math.min(Math.max(0, s.x + dx), 1 - s.w), y: Math.min(Math.max(0, s.y + dy), 1 - s.h) });
      return;
    }

    // Resize from a corner around the opposite, anchored corner.
    const sx = d.mode === "tr" || d.mode === "br" ? 1 : -1;
    const sy = d.mode === "bl" || d.mode === "br" ? 1 : -1;
    const ax = sx > 0 ? s.x : s.x + s.w;
    const ay = sy > 0 ? s.y : s.y + s.h;
    const maxW = sx > 0 ? 1 - ax : ax;
    const maxH = sy > 0 ? 1 - ay : ay;
    let w = (sx > 0 ? s.x + s.w + dx : s.x + dx) - ax;
    let h = (sy > 0 ? s.y + s.h + dy : s.y + dy) - ay;
    w *= sx;
    h *= sy;
    if (locked) {
      w = Math.min(Math.max(w, h / k, MIN), maxW, maxH / k);
      h = w * k;
    } else {
      w = Math.min(Math.max(w, MIN), maxW);
      h = Math.min(Math.max(h, MIN), maxH);
    }
    setR({ x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h });
  };

  const up = () => {
    drag.current = null;
  };

  const style = {
    left: r.x * disp.w,
    top: r.y * disp.h,
    width: r.w * disp.w,
    height: r.h * disp.h,
  };

  return (
    <div className="crop" role="dialog" aria-label="Adjust framing">
      <div className="topbar">
        <button className="back" onClick={onCancel}>
          ← Cancel
        </button>
        <span className="box">
          <span>{kind === "worn" ? "Worn shot" : "Item shot"}</span>
          <span>{locked ? "4:5" : "Free"}</span>
        </span>
      </div>
      <p className="crop-hint micro mute">
        {kind === "worn" ? "Drag to frame the photo. Corners resize." : "Frame the garment. It sits centred on the board."}
      </p>
      <div className="crop-stage" ref={stageRef}>
        <div className="crop-img" style={{ width: disp.w, height: disp.h }} onPointerMove={move} onPointerUp={up}>
          <img src={src} alt="" draggable={false} />
          <div className="crop-rect" style={style} onPointerDown={down("move")} onPointerMove={move} onPointerUp={up}>
            {(["tl", "tr", "bl", "br"] as Corner[]).map((c) => (
              <span
                key={c}
                className={`crop-h ${c}`}
                onPointerDown={down(c)}
                onPointerMove={move}
                onPointerUp={up}
                aria-hidden
              />
            ))}
          </div>
        </div>
      </div>
      <div className="bars">
        <button className="bar light small" onClick={() => setR(auto)}>
          <span>Reset</span>
          <span>↺</span>
        </button>
        <button className="bar" onClick={() => onDone(r)}>
          <span>Done</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
