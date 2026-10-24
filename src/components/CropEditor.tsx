import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import type { FrameMode, PhotoKind, Rect } from "../types";
import { ASPECT, lockAspect, renderPhoto } from "../lib/frame";

interface Props {
  orig: Blob;
  src: string;
  size: { w: number; h: number };
  kind: PhotoKind;
  rect: Rect;
  mode: FrameMode;
  auto: Rect;
  autoMode: FrameMode;
  onDone: (r: { crop: Rect; mode: FrameMode }) => void;
  onCancel: () => void;
}

type Corner = "tl" | "tr" | "bl" | "br";
type Drag = { mode: "move" | Corner; px: number; py: number; start: Rect };

const MIN = 0.06;

export function CropEditor({ orig, src, size, kind, rect: initial, mode: initialMode, auto, autoMode, onDone, onCancel }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [disp, setDisp] = useState({ w: 0, h: 0 });
  const [r, setR] = useState(initial);
  const [mode, setMode] = useState(initialMode);
  const [settled, setSettled] = useState(0);
  const [preview, setPreview] = useState<string>();
  const drag = useRef<Drag | null>(null);
  // Normalised height per unit of normalised width that keeps a 4:5 frame in pixels.
  const k = size.w / (size.h * ASPECT);
  const locked = mode === "crop";

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

  // Live 4:5 result for composed product shots, refreshed when a drag ends.
  useEffect(() => {
    if (mode !== "compose") return setPreview(undefined);
    let live = true;
    let url: string | undefined;
    renderPhoto(orig, { kind, crop: r, mode }, 360).then((b) => {
      if (!live) return;
      url = URL.createObjectURL(b);
      setPreview(url);
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, mode]);

  const switchMode = (m: FrameMode) => {
    if (m === "crop") setR(lockAspect(r, size.w, size.h));
    setMode(m);
  };

  const down = (m: Drag["mode"]) => (e: PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { mode: m, px: e.clientX, py: e.clientY, start: r };
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
    let w = ((sx > 0 ? s.x + s.w + dx : s.x + dx) - ax) * sx;
    let h = ((sy > 0 ? s.y + s.h + dy : s.y + dy) - ay) * sy;
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
    if (drag.current) setSettled((n) => n + 1);
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
          <span>4:5</span>
        </span>
      </div>
      <div className="crop-hint micro">
        <span className="mute">
          {mode === "compose"
            ? "Box the garment. It's centred in a 4:5 frame for you."
            : "Drag to frame. Corners resize."}
        </span>
        {kind === "item" && (
          <span className="crop-modes" role="group" aria-label="Framing">
            <button aria-pressed={mode === "compose"} onClick={() => switchMode("compose")}>
              Composed
            </button>
            <button aria-pressed={mode === "crop"} onClick={() => switchMode("crop")}>
              Crop
            </button>
          </span>
        )}
      </div>
      <div className="crop-stage" ref={stageRef}>
        <div className="crop-img" style={{ width: disp.w, height: disp.h }} onPointerMove={move} onPointerUp={up}>
          <img src={src} alt="" draggable={false} />
          <div
            className={`crop-rect${mode === "compose" ? " free" : ""}`}
            style={style}
            onPointerDown={down("move")}
            onPointerMove={move}
            onPointerUp={up}
          >
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
        {preview && (
          <div className="crop-preview" aria-label="Result preview">
            <img src={preview} alt="" />
            <span className="micro">Result</span>
          </div>
        )}
      </div>
      <div className="bars">
        <button
          className="bar light small"
          onClick={() => {
            setR(auto);
            setMode(autoMode);
            setSettled((n) => n + 1);
          }}
        >
          <span>Reset</span>
          <span>↺</span>
        </button>
        <button className="bar" onClick={() => onDone({ crop: r, mode })}>
          <span>Done</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
