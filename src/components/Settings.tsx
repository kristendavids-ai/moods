import { useRef, useState } from "react";
import { clearAll, exportBackup, importBackup } from "../db/store";
import { DEFAULT_CATEGORIES } from "../data/categories";
import { getApiKey, setApiKey } from "../lib/settings";

interface Props {
  categories: string[];
  onCategories: (c: string[]) => void;
  onBack: () => void;
  onChanged: () => void;
  toast: (msg: string) => void;
  note: string;
  onNote: (n: string) => void;
}

export function Settings({ categories, onCategories, onBack, onChanged, toast, note, onNote }: Props) {
  const [key, setKey] = useState(getApiKey());
  const [newCat, setNewCat] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= categories.length) return;
    const next = [...categories];
    [next[i], next[j]] = [next[j], next[i]];
    onCategories(next);
  };

  const addCat = () => {
    const c = newCat.trim();
    if (!c || categories.some((x) => x.toLowerCase() === c.toLowerCase())) return;
    onCategories([...categories, c]);
    setNewCat("");
  };

  const doExport = async () => {
    const blob = await exportBackup();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `moods-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const doImport = async (file?: File) => {
    if (!file) return;
    try {
      const n = await importBackup(file);
      onChanged();
      const count = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
      const extra = [n.brands && count(n.brands, "brand", "brands"), n.boutiques && count(n.boutiques, "boutique", "boutiques")];
      toast(`Imported ${[count(n.items, "piece", "pieces"), ...extra].filter(Boolean).join(", ")}`);
    } catch {
      toast("That file isn't a MOODS backup");
    }
  };

  return (
    <div className="page settings">
      <div className="topbar">
        <button className="back" onClick={onBack}>
          ← <span className="wordmark">Moods</span>
        </button>
      </div>
      <h1>Settings</h1>

      <section>
        <h2>Index note</h2>
        <textarea
          className="input note-input"
          rows={3}
          value={note}
          aria-label="Index note"
          placeholder="A line or two about your board. Leave empty to hide it."
          onChange={(e) => onNote(e.target.value)}
        />
        <p className="micro">Shown at the bottom left of the Index map.</p>
      </section>

      <section>
        <h2>Brand scan</h2>
        <div className="row">
          <input
            className="input"
            type="password"
            autoComplete="off"
            placeholder="sk-ant-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            aria-label="Anthropic API key"
          />
          <button
            className="btn"
            onClick={() => {
              setApiKey(key);
              toast(key.trim() ? "Key saved" : "Key removed");
            }}
          >
            Save
          </button>
        </div>
        <p className="micro">
          Paste an Anthropic API key to have Claude read the brand, piece, colour and category from each photo. The key
          is stored only on this device and sent only to Anthropic. A scan costs roughly 1–2¢ from your API credits (a little more with two photos) and never touches your Claude app usage.
        </p>
      </section>

      <section>
        <h2>Categories</h2>
        <ul className="catlist">
          {categories.map((c, i) => (
            <li key={c}>
              <span>{c}</span>
              <span className="ctrls">
                <button aria-label={`Move ${c} up`} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button aria-label={`Move ${c} down`} onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button
                  aria-label={`Remove ${c}`}
                  onClick={() => categories.length > 1 && onCategories(categories.filter((x) => x !== c))}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div className="row">
          <input
            className="input"
            placeholder="New category"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCat()}
          />
          <button className="btn" onClick={addCat}>
            Add
          </button>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => onCategories(DEFAULT_CATEGORIES)}>
            Reset to default
          </button>
        </div>
      </section>

      <section>
        <h2>Backup</h2>
        <p className="micro">
          Your board lives on this device only. Export a backup now and then, and import it to move to a new phone.
        </p>
        <div className="row">
          <button className="btn" onClick={doExport}>
            Export backup
          </button>
          <button className="btn ghost" onClick={() => importRef.current?.click()}>
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Import backup"
            onChange={(e) => doImport(e.target.files?.[0])}
          />
        </div>
      </section>

      <section>
        <h2>Danger</h2>
        <p className="micro">Clears the board, brands and boutiques from this device. Export a backup first.</p>
        <div className="row">
          {confirmClear ? (
            <>
              <button
                className="btn"
                onClick={async () => {
                  await clearAll();
                  onChanged();
                  setConfirmClear(false);
                  toast("Board cleared");
                }}
              >
                Delete everything
              </button>
              <button className="btn ghost" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn ghost" onClick={() => setConfirmClear(true)}>
              Clear everything
            </button>
          )}
        </div>
      </section>
      <section>
        <h2>Credits</h2>
        <p className="micro">
          City data from GeoNames (geonames.org), CC BY 4.0. Country outlines from Natural Earth via world-atlas.
        </p>
      </section>
    </div>
  );
}
