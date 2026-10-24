import { useEffect, useRef, useState } from "react";
import type { FrameMode, Item, Photo, PhotoKind, Rect, Status } from "../types";
import { STATUSES } from "../types";
import { prepareOriginal } from "../lib/image";
import { autoFrame, imageSize, lockAspect, renderPhoto, type Framing } from "../lib/frame";
import type { ScanResult } from "../lib/scan";
import { getApiKey } from "../lib/settings";
import { currentSeason, suggestedSeasons } from "../lib/seasons";
import { getOriginal, newId, type PhotoWrite } from "../db/store";
import { Hanger } from "./Hanger";
import { PhotoView } from "./PhotoView";
import { CropEditor } from "./CropEditor";

interface Props {
  categories: string[];
  knownSeasons: string[];
  defaultCategory?: string;
  editing?: Item;
  /** Opens the picker straight away for this slot (from "+ Item shot" on the detail page). */
  addKind?: PhotoKind;
  onCancel: () => void;
  onSave: (item: Item, writes: PhotoWrite[], removed: string[]) => void;
}

type Draft = {
  brand: string;
  name: string;
  category: string;
  season: string;
  status: Status;
  size: string;
  colourName: string;
  colourHex: string;
  notes: string;
};

interface Slot {
  id: string;
  kind: PhotoKind;
  crop: Rect;
  /** Undefined for photos saved before 4:5 framing, until they're re-adjusted. */
  mode?: FrameMode;
  /** Suggested framing, restored by Reset in the crop screen. */
  auto: Rect;
  autoMode?: FrameMode;
  box?: Rect;
  orig?: Blob;
  display?: Blob;
  preview?: string;
  isNew: boolean;
  dirty: boolean;
  kindLocked: boolean;
  cropTouched: boolean;
}

type ScanState = { kind: "idle" } | { kind: "scanning" } | { kind: "done" } | { kind: "error"; message: string };

const other = (k: PhotoKind): PhotoKind => (k === "worn" ? "item" : "worn");
const label = (k: PhotoKind) => (k === "worn" ? "Worn" : "Item");

export function ItemForm({ categories, knownSeasons, defaultCategory, editing, addKind, onCancel, onSave }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const forced = useRef<PhotoKind | undefined>(undefined);
  const [slots, setSlots] = useState<Slot[]>(() =>
    (editing?.photos ?? []).map((p) => ({
      ...p,
      auto: p.crop,
      autoMode: p.mode,
      isNew: false,
      dirty: false,
      kindLocked: true,
      cropTouched: true,
    })),
  );
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(0);
  const [cropping, setCropping] = useState<{
    id: string;
    orig: Blob;
    src: string;
    size: { w: number; h: number };
    crop: Rect;
    mode: FrameMode;
    auto: Rect;
    autoMode: FrameMode;
  }>();
  const [scan, setScan] = useState<ScanState>({ kind: "idle" });
  const [scanned, setScanned] = useState<Set<keyof Draft>>(new Set());
  const touched = useRef(new Set<keyof Draft>());

  const [d, setD] = useState<Draft>(() => ({
    brand: editing?.brand ?? "",
    name: editing?.name ?? "",
    category: editing?.category ?? (defaultCategory && defaultCategory !== "All" ? defaultCategory : categories[0]),
    season: editing?.season ?? currentSeason(),
    status: editing?.status ?? "wishlist",
    size: editing?.size ?? "",
    colourName: editing?.colour?.name ?? "",
    colourHex: editing?.colour?.hex ?? "#c8c4bc",
    notes: editing?.notes ?? "",
  }));

  // When editing, fields that already hold a value count as the user's own.
  useEffect(() => {
    if (!editing) return;
    (Object.keys(d) as (keyof Draft)[]).forEach((k) => {
      if (k !== "category" && k !== "status" && d[k]) touched.current.add(k);
    });
    if (editing.colour) touched.current.add("colourHex");
    touched.current.add("category");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => slotsRef.current.forEach((s) => s.preview && URL.revokeObjectURL(s.preview)), []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    touched.current.add(k);
    setScanned((s) => {
      const n = new Set(s);
      n.delete(k);
      return n;
    });
    setD((prev) => ({ ...prev, [k]: v }));
  };

  const patchSlot = (id: string, patch: Partial<Slot>) =>
    setSlots((all) =>
      all.map((s) => {
        if (s.id !== id) return s;
        if (patch.preview && s.preview && patch.preview !== s.preview) URL.revokeObjectURL(s.preview);
        return { ...s, ...patch };
      }),
    );

  const track = async <T,>(p: Promise<T>): Promise<T> => {
    setBusy((n) => n + 1);
    try {
      return await p;
    } finally {
      setBusy((n) => n - 1);
    }
  };

  const ensureOrig = async (s: Slot): Promise<Blob | undefined> => {
    if (s.orig) return s.orig;
    const orig = await getOriginal(s.id);
    if (orig) patchSlot(s.id, { orig });
    return orig;
  };

  const reframe = async (id: string, orig: Blob, f: Framing, extra: Partial<Slot> = {}) => {
    const display = await renderPhoto(orig, f);
    patchSlot(id, { ...extra, ...f, display, preview: URL.createObjectURL(display), dirty: true });
  };

  // Claude's (or the default) framing for `kind`; a framing the user set by hand is kept, converted if needed.
  const frameFor = async (s: Slot, orig: Blob, kind: PhotoKind, box?: Rect) => {
    const a = await autoFrame(orig, kind, box);
    const auto = { auto: a.crop, autoMode: a.mode };
    if (!s.cropTouched || !s.mode) return { framing: { kind, ...a }, auto };
    const size = await imageSize(orig);
    const crop = a.mode === "crop" ? lockAspect(s.crop, size.w, size.h) : s.crop;
    return { framing: { kind, crop, mode: a.mode }, auto };
  };

  const applyFields = (r: ScanResult) => {
    const patch: Partial<Draft> = {};
    if (r.brand) patch.brand = r.brand;
    if (r.name) patch.name = r.name;
    if (r.category && categories.includes(r.category)) patch.category = r.category;
    if (r.season) patch.season = r.season;
    if (r.colour) {
      patch.colourName = r.colour.name;
      patch.colourHex = r.colour.hex;
    }
    const keys = (Object.keys(patch) as (keyof Draft)[]).filter((k) => !touched.current.has(k));
    setD((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, patch[k]])) }));
    setScanned(new Set(keys));
  };

  const runScan = async (targets: Slot[]) => {
    if (!targets.length) return;
    setScan({ kind: "scanning" });
    // Loaded on demand: the SDK is most of the bundle and the board doesn't need it.
    const { scanImages, ScanError } = await import("../lib/scan");
    try {
      const origs = await Promise.all(targets.map(ensureOrig));
      const sendable = targets.filter((_, i) => origs[i]);
      const result = await scanImages(getApiKey(), origs.filter((o): o is Blob => !!o), categories);
      applyFields(result);

      // Kinds: trust Claude unless the user chose; never leave two photos of the same kind.
      const kinds = new Map<string, PhotoKind>();
      sendable.forEach((s, i) => kinds.set(s.id, s.kindLocked ? s.kind : (result.photos[i]?.kind ?? s.kind)));
      const all = slotsRef.current.map((s) => ({ s, kind: kinds.get(s.id) ?? s.kind }));
      if (all.length === 2 && all[0].kind === all[1].kind) {
        const flip = all.find((a) => kinds.has(a.s.id) && !a.s.kindLocked) ?? all[1];
        flip.kind = other(flip.kind);
      }

      await Promise.all(
        all.map(async ({ s, kind }) => {
          const i = sendable.findIndex((t) => t.id === s.id);
          const box = i >= 0 ? result.photos[i]?.box : s.box;
          if (kind === s.kind && i < 0) return;
          const orig = s.orig ?? origs[targets.findIndex((t) => t.id === s.id)];
          if (!orig) return;
          if (s.cropTouched && kind === s.kind) return patchSlot(s.id, { box });
          const { framing, auto } = await frameFor(s, orig, kind, box);
          await reframe(s.id, orig, framing, { ...auto, box });
        }),
      );
      setScan({ kind: "done" });
    } catch (e) {
      const message = e instanceof ScanError ? e.message : "Couldn't read the brand — fill it in below.";
      setScan({ kind: "error", message });
    }
  };

  const onFiles = async (files: FileList | null) => {
    const picked = Array.from(files ?? []).slice(0, 2);
    if (!picked.length) return;
    const want = forced.current;
    forced.current = undefined;

    await track(
      (async () => {
        const current = slotsRef.current;
        const created: Slot[] = [];
        for (const [i, file] of picked.entries()) {
          const orig = await prepareOriginal(file).catch(() => file);
          const taken = new Set([...current, ...created].map((s) => s.kind));
          const kind: PhotoKind = want && i === 0 ? want : !taken.has("item") ? "item" : "worn";
          const a = await autoFrame(orig, kind);
          const display = await renderPhoto(orig, { kind, ...a });
          created.push({
            id: newId(),
            kind,
            ...a,
            auto: a.crop,
            autoMode: a.mode,
            orig,
            display,
            preview: URL.createObjectURL(display),
            isNew: true,
            dirty: true,
            kindLocked: !!want && i === 0,
            cropTouched: false,
          });
        }
        // Keep at most one photo of each kind: a new photo replaces the old one in its slot.
        const replaced = current.filter((s) => created.some((c) => c.kind === s.kind) || current.length + created.length > 2);
        const keep = current.filter((s) => !replaced.includes(s)).slice(0, 2 - created.length);
        const dropped = current.filter((s) => !keep.includes(s));
        dropped.forEach((s) => s.preview && URL.revokeObjectURL(s.preview));
        setRemoved((r) => [...r, ...dropped.filter((s) => !s.isNew).map((s) => s.id)]);
        const next = [...keep, ...created];
        slotsRef.current = next;
        setSlots(next);
        return created;
      })(),
    ).then(runScan);
  };

  const pick = (kind?: PhotoKind) => {
    forced.current = kind;
    if (fileRef.current) {
      fileRef.current.multiple = !kind;
      fileRef.current.value = "";
      fileRef.current.click();
    }
  };

  useEffect(() => {
    if (!editing || addKind) pick(addKind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const swap = () =>
    track(
      Promise.all(
        slotsRef.current.map(async (s) => {
          const orig = await ensureOrig(s);
          if (!orig) return;
          const { framing, auto } = await frameFor(s, orig, other(s.kind), s.box);
          await reframe(s.id, orig, framing, { ...auto, kindLocked: true });
        }),
      ),
    );

  const remove = (s: Slot) => {
    if (!s.isNew) setRemoved((r) => [...r, s.id]);
    if (s.preview) URL.revokeObjectURL(s.preview);
    setSlots((all) => all.filter((x) => x.id !== s.id));
  };

  const adjust = async (s: Slot) => {
    const orig = await track(ensureOrig(s));
    if (!orig) return;
    // Photos saved before 4:5 framing start from a fresh automatic framing.
    const a = s.mode && s.autoMode ? null : await track(autoFrame(orig, s.kind, s.box));
    setCropping({
      id: s.id,
      orig,
      src: URL.createObjectURL(orig),
      size: await imageSize(orig),
      crop: a?.crop ?? s.crop,
      mode: a?.mode ?? s.mode!,
      auto: a?.crop ?? s.auto,
      autoMode: a?.mode ?? s.autoMode!,
    });
  };

  const finishCrop = async (result?: { crop: Rect; mode: FrameMode }) => {
    const c = cropping!;
    URL.revokeObjectURL(c.src);
    setCropping(undefined);
    const s = slotsRef.current.find((x) => x.id === c.id);
    if (!result || !s) return;
    await track(
      reframe(s.id, c.orig, { kind: s.kind, ...result }, { cropTouched: true, auto: c.auto, autoMode: c.autoMode }),
    );
  };

  const canSave = slots.length > 0 && busy === 0 && scan.kind !== "scanning";
  const meta = (s: Slot): Photo => ({ id: s.id, kind: s.kind, crop: s.crop, ...(s.mode ? { mode: s.mode } : {}) });
  const save = () => {
    if (!canSave) return;
    const photos: Photo[] = slots.map(meta);
    const writes: PhotoWrite[] = slots
      .filter((s) => s.dirty && s.display)
      .map((s) => ({ photo: meta(s), display: s.display!, orig: s.orig }));
    const item: Item = {
      id: editing?.id ?? newId(),
      photos,
      createdAt: editing?.createdAt ?? Date.now(),
      brand: d.brand.trim(),
      name: d.name.trim() || undefined,
      category: d.category,
      season: d.season.trim().toUpperCase() || undefined,
      status: d.status,
      size: d.size.trim() || undefined,
      colour: d.colourName.trim() ? { name: d.colourName.trim(), hex: d.colourHex } : undefined,
      notes: d.notes.trim() || undefined,
    };
    onSave(item, writes, removed);
  };

  const cls = (k: keyof Draft) => (scanned.has(k) ? "scanned" : undefined);
  const seasons = Array.from(new Set([...knownSeasons, ...suggestedSeasons()]));
  const ordered = [...slots].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "worn" ? -1 : 1));
  const missing = slots.length === 1 ? other(slots[0].kind) : undefined;
  const reading = scan.kind === "scanning";
  const cropSlot = cropping && slots.find((s) => s.id === cropping.id);

  return (
    <div className="page add">
      <div className="topbar">
        <button className="back" onClick={onCancel}>
          ← Cancel
        </button>
        <span className="box">
          <span>{editing ? "Edit" : "New"}</span>
          <span>{reading || busy ? "…" : `${slots.length}/2`}</span>
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="Choose photos"
        onChange={(e) => onFiles(e.target.files)}
      />

      {slots.length === 0 ? (
        <button className="picker" onClick={() => pick()}>
          <Hanger />
          <span>Add a piece</span>
          <span className="mute">Choose one or two photos — worn and item +</span>
        </button>
      ) : (
        <>
          <div className="slots">
            {ordered.map((s) => (
              <div key={s.id} className="slot">
                <button className={`plate${reading ? " scanning" : ""}`} onClick={() => adjust(s)} aria-label={`Adjust ${label(s.kind)} shot`}>
                  <PhotoView photo={s} src={s.preview} />
                  {reading && <span className="scan-note">Reading…</span>}
                </button>
                <div className="slot-cap">
                  <span>{label(s.kind)} +</span>
                  <span className="slot-ctrls">
                    <button onClick={() => adjust(s)}>Adjust</button>
                    <button onClick={() => remove(s)} aria-label={`Remove ${label(s.kind)} shot`}>
                      ×
                    </button>
                  </span>
                </div>
              </div>
            ))}
            {missing && (
              <div className="slot">
                <button className="plate add-slot" onClick={() => pick(missing)}>
                  <span>+ {label(missing)} shot</span>
                  <span className="mute">{missing === "worn" ? "Someone wearing it" : "The piece on its own"}</span>
                </button>
                <div className="slot-cap mute">
                  <span>Optional</span>
                </div>
              </div>
            )}
          </div>
          <div className="slot-bar micro">
            <span className="mute">
              {reading
                ? "Claude is reading the brand and framing…"
                : scan.kind === "done"
                  ? "Read and framed by Claude — tap a photo to adjust."
                  : "Tap a photo to adjust its framing."}
            </span>
            <button onClick={swap} disabled={!!busy || reading}>
              Swap worn / item ⇄
            </button>
          </div>
        </>
      )}

      {scan.kind === "error" && <div className="err">{scan.message}</div>}

      <div className="form">
        <label className="field">
          <span>Brand</span>
          <input
            className={cls("brand")}
            value={d.brand}
            placeholder={reading ? "Reading…" : "e.g. Our Legacy"}
            onChange={(e) => set("brand", e.target.value)}
            autoCapitalize="words"
          />
        </label>
        <label className="field">
          <span>Piece</span>
          <input
            className={cls("name")}
            value={d.name}
            placeholder="e.g. Sheepskin flying jacket"
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Category</span>
          <select className={cls("category")} value={d.category} onChange={(e) => set("category", e.target.value)}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Season</span>
          <input
            className={cls("season")}
            value={d.season}
            list="seasons"
            placeholder="AW26"
            autoCapitalize="characters"
            onChange={(e) => set("season", e.target.value)}
          />
          <datalist id="seasons">
            {seasons.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Status</span>
          <select value={d.status} onChange={(e) => set("status", e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Size</span>
          <input value={d.size} placeholder="e.g. 48 / M / UK 8" onChange={(e) => set("size", e.target.value)} />
        </label>
        <div className="field">
          <span>Colour</span>
          <div className="colour-input">
            <input
              type="color"
              aria-label="Colour swatch"
              value={d.colourHex}
              onChange={(e) => set("colourHex", e.target.value)}
            />
            <input
              className={cls("colourName")}
              value={d.colourName}
              aria-label="Colour name"
              placeholder="e.g. Chocolate"
              onChange={(e) => set("colourName", e.target.value)}
            />
          </div>
        </div>
        <label className="field top">
          <span>Notes</span>
          <textarea value={d.notes} placeholder="Fit, where to buy, price…" onChange={(e) => set("notes", e.target.value)} />
        </label>
      </div>

      <div className="bars">
        {slots.length > 0 && !reading && (
          <button className="bar light small" onClick={() => runScan(slotsRef.current)} disabled={!!busy}>
            Rescan
          </button>
        )}
        <button className="bar" disabled={!canSave} onClick={save}>
          <span>{editing ? "Save changes" : "Save to board"}</span>
          <span>{d.category}</span>
        </button>
      </div>

      {cropping && cropSlot && (
        <CropEditor
          orig={cropping.orig}
          src={cropping.src}
          size={cropping.size}
          kind={cropSlot.kind}
          rect={cropping.crop}
          mode={cropping.mode}
          auto={cropping.auto}
          autoMode={cropping.autoMode}
          onDone={finishCrop}
          onCancel={() => finishCrop()}
        />
      )}
    </div>
  );
}
