import { useState } from "react";
import type { Brand, EuTax } from "../types";
import { normalizeUrl } from "../lib/places";
import { newId } from "../db/store";
import { TaxChoice } from "./Tax";

interface Props {
  editing?: Brand;
  onCancel: () => void;
  onSave: (b: Brand) => void;
}

export function BrandForm({ editing, onCancel, onSave }: Props) {
  const [name, setName] = useState(editing?.name ?? "");
  const [website, setWebsite] = useState(editing?.website ?? "");
  const [euTax, setEuTax] = useState<EuTax>(editing?.euTax ?? "unknown");
  const ok = name.trim().length > 0;
  const save = () =>
    ok &&
    onSave({
      id: editing?.id ?? newId(),
      createdAt: editing?.createdAt ?? Date.now(),
      name: name.trim(),
      website: normalizeUrl(website),
      euTax,
    });

  return (
    <div className="page add">
      <div className="topbar">
        <button className="back" onClick={onCancel}>
          ← Cancel
        </button>
        <span className="box">
          <span>{editing ? "Edit brand" : "New brand"}</span>
          <span>+</span>
        </span>
      </div>
      <div className="form">
        <label className="field">
          <span>Brand</span>
          <input value={name} placeholder="e.g. Lemaire" autoCapitalize="words" autoFocus={!editing} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Website</span>
          <input
            value={website}
            placeholder="lemaire.fr"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
        <div className="field top">
          <span>EU duties</span>
          <div className="field-opts">
            <TaxChoice value={euTax} onChange={setEuTax} />
          </div>
        </div>
      </div>
      <p className="micro mute form-note">
        Paid: VAT and import duties are included at checkout when shipping to Europe. Customs due: you pay them on delivery.
      </p>
      <div className="bars">
        <button className="bar" disabled={!ok} onClick={save}>
          <span>{editing ? "Save changes" : "Save brand"}</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
