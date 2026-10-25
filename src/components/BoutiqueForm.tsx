import { useState } from "react";
import type { Boutique, Brand, City, EuTax } from "../types";
import { normalizeUrl } from "../lib/places";
import { newId } from "../db/store";
import { TaxChoice } from "./Tax";
import { CityPicker } from "./CityPicker";

interface Props {
  editing?: Boutique;
  brands: Brand[];
  onCreateBrand: (name: string) => Promise<Brand>;
  onCancel: () => void;
  onSave: (b: Boutique) => void;
  onDelete?: () => void;
}

export function BoutiqueForm({ editing, brands, onCreateBrand, onCancel, onSave, onDelete }: Props) {
  const [name, setName] = useState(editing?.name ?? "");
  const [website, setWebsite] = useState(editing?.website ?? "");
  const [city, setCity] = useState<City | undefined>(editing?.city);
  const [address, setAddress] = useState(editing?.address ?? "");
  const [euTax, setEuTax] = useState<EuTax>(editing?.euTax ?? "unknown");
  const [stocks, setStocks] = useState<string[]>(editing?.brandIds ?? []);
  const [q, setQ] = useState("");
  const [confirming, setConfirming] = useState(false);

  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const matches = q.trim()
    ? brands.filter((b) => !stocks.includes(b.id) && fold(b.name).includes(fold(q.trim()))).slice(0, 6)
    : [];
  const exact = brands.some((b) => fold(b.name) === fold(q.trim()));
  const byId = new Map(brands.map((b) => [b.id, b]));

  const ok = name.trim().length > 0;
  const save = () =>
    ok &&
    onSave({
      id: editing?.id ?? newId(),
      createdAt: editing?.createdAt ?? Date.now(),
      name: name.trim(),
      website: normalizeUrl(website),
      city,
      address: address.trim() || undefined,
      euTax,
      brandIds: stocks.filter((id) => byId.has(id)),
    });

  const addNew = async () => {
    const b = await onCreateBrand(q.trim());
    setStocks((s) => [...s, b.id]);
    setQ("");
  };

  return (
    <div className="page add">
      <div className="topbar">
        <button className="back" onClick={onCancel}>
          ← Cancel
        </button>
        <span className="box">
          <span>{editing ? "Edit boutique" : "New boutique"}</span>
          <span>+</span>
        </span>
      </div>
      <div className="form">
        <label className="field">
          <span>Boutique</span>
          <input value={name} placeholder="e.g. Dover Street Market" autoCapitalize="words" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Website</span>
          <input value={website} placeholder="doverstreetmarket.com" inputMode="url" autoCapitalize="none" autoCorrect="off" onChange={(e) => setWebsite(e.target.value)} />
        </label>
        <div className="field top">
          <span>City</span>
          <CityPicker value={city} onChange={setCity} />
        </div>
        <label className="field">
          <span>Address</span>
          <input value={address} placeholder="Optional" onChange={(e) => setAddress(e.target.value)} />
        </label>
        <div className="field top">
          <span>EU duties</span>
          <div className="field-opts">
            <TaxChoice value={euTax} onChange={setEuTax} />
          </div>
        </div>
        <div className="field top">
          <span>Stocks</span>
          <div className="stocks">
            {stocks.length > 0 && (
              <div className="stock-chips">
                {stocks.map((id) =>
                  byId.has(id) ? (
                    <button key={id} className="chip" onClick={() => setStocks((s) => s.filter((x) => x !== id))}>
                      {byId.get(id)!.name} <span aria-label={`Remove ${byId.get(id)!.name}`}>×</span>
                    </button>
                  ) : null,
                )}
              </div>
            )}
            <input value={q} placeholder="Add a brand it stocks" aria-label="Add a brand it stocks" autoComplete="off" onChange={(e) => setQ(e.target.value)} />
            {q.trim() && (
              <ul className="city-results">
                {matches.map((b) => (
                  <li key={b.id}>
                    <button onClick={() => (setStocks((s) => [...s, b.id]), setQ(""))}>
                      <span>{b.name}</span>
                    </button>
                  </li>
                ))}
                {!exact && (
                  <li>
                    <button onClick={addNew}>
                      <span>+ Add ‘{q.trim()}’</span>
                      <span className="mute">new brand</span>
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
      <p className="micro mute form-note">
        Paid: VAT and import duties are included at checkout when shipping to Europe. Customs due: you pay them on delivery.
      </p>
      {editing && onDelete && (
        <div className="form-note">
          {confirming ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn" onClick={onDelete}>
                Delete boutique
              </button>
              <button className="btn ghost" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </div>
          ) : (
            <button className="micro" style={{ textDecoration: "underline" }} onClick={() => setConfirming(true)}>
              Delete boutique
            </button>
          )}
        </div>
      )}
      <div className="bars">
        <button className="bar" disabled={!ok} onClick={save}>
          <span>{editing ? "Save changes" : "Save boutique"}</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
