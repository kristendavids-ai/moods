import { useEffect, useRef, useState } from "react";
import type { Item, Status } from "../types";
import { STATUSES } from "../types";
import { compressImage, objectUrl } from "../lib/image";
import type { ScanResult } from "../lib/scan";
import { getApiKey } from "../lib/settings";
import { currentSeason, suggestedSeasons } from "../lib/seasons";
import { newId } from "../db/store";
import { useImage } from "../lib/useImage";
import { Hanger } from "./Hanger";

interface Props {
  categories: string[];
  knownSeasons: string[];
  defaultCategory?: string;
  editing?: Item;
  onCancel: () => void;
  onSave: (item: Item, image?: Blob) => void;
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

type ScanState = { kind: "idle" } | { kind: "scanning" } | { kind: "done" } | { kind: "error"; message: string };

export function ItemForm({ categories, knownSeasons, defaultCategory, editing, onCancel, onSave }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<Blob>();
  const [previewId] = useState(() => editing?.imageId ?? newId());
  const existingUrl = useImage(editing?.imageId);
  const previewUrl = image ? objectUrl(`draft-${previewId}`, image) : existingUrl;
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

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    touched.current.add(k);
    setScanned((s) => {
      const n = new Set(s);
      n.delete(k);
      return n;
    });
    setD((prev) => ({ ...prev, [k]: v }));
  };

  // Scan results only fill fields the user hasn't typed into yet.
  const apply = (r: ScanResult) => {
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

  const runScan = async (blob: Blob) => {
    setScan({ kind: "scanning" });
    // Loaded on demand: the SDK is most of the bundle and the board doesn't need it.
    const { scanImage, ScanError } = await import("../lib/scan");
    try {
      apply(await scanImage(getApiKey(), blob, categories));
      setScan({ kind: "done" });
    } catch (e) {
      const message = e instanceof ScanError ? e.message : "Couldn't read the brand — fill it in below.";
      setScan({ kind: "error", message });
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const blob = await compressImage(file).catch(() => file);
    setImage(blob);
    runScan(blob);
  };

  useEffect(() => {
    if (!editing) fileRef.current?.click();
  }, [editing]);

  const canSave = !!(image || editing) && scan.kind !== "scanning";
  const save = () => {
    if (!canSave) return;
    const item: Item = {
      id: editing?.id ?? newId(),
      imageId: previewId,
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
    onSave(item, image);
  };

  const cls = (k: keyof Draft) => (scanned.has(k) ? "scanned" : undefined);
  const seasons = Array.from(new Set([...knownSeasons, ...suggestedSeasons()]));

  return (
    <div className="page add">
      <div className="topbar">
        <button className="back" onClick={onCancel}>
          ← Cancel
        </button>
        <span className="box">
          <span>{editing ? "Edit" : "New"}</span>
          <span>{scan.kind === "scanning" ? "…" : "+"}</span>
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose photo"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {previewUrl ? (
        <div className={`hero${scan.kind === "scanning" ? " scanning" : ""}`}>
          <img src={previewUrl} alt="" onClick={() => fileRef.current?.click()} />
          {scan.kind === "scanning" && <span className="scan-note">Reading brand…</span>}
          {scan.kind === "done" && scanned.size > 0 && <span className="scan-note">Read by Claude — check below</span>}
        </div>
      ) : (
        <button className="picker" onClick={() => fileRef.current?.click()}>
          <Hanger />
          <span>Add a piece</span>
          <span className="mute">Choose a photo or screenshot +</span>
        </button>
      )}

      {scan.kind === "error" && <div className="err">{scan.message}</div>}

      <div className="form">
        <label className="field">
          <span>Brand</span>
          <input
            className={cls("brand")}
            value={d.brand}
            placeholder={scan.kind === "scanning" ? "Reading…" : "e.g. Our Legacy"}
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
        {image && scan.kind !== "scanning" && (
          <button className="bar light small" onClick={() => runScan(image)}>
            Rescan
          </button>
        )}
        <button className="bar" disabled={!canSave} onClick={save}>
          <span>{editing ? "Save changes" : "Save to board"}</span>
          <span>{d.category}</span>
        </button>
      </div>
    </div>
  );
}
