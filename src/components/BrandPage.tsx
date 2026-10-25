import { useState } from "react";
import type { Boutique, Brand, EuTax } from "../types";
import { EU_TAX } from "../types";
import { countryName, domainOf } from "../lib/places";
import { TaxChoice, TaxMark } from "./Tax";

interface Props {
  brand: Brand;
  boutiques: Boutique[];
  onBack: () => void;
  onEdit: () => void;
  onTax: (t: EuTax) => void;
  onDelete: () => void;
  onOpenBoutique: (b: Boutique) => void;
}

export function BrandPage({ brand, boutiques, onBack, onEdit, onTax, onDelete, onOpenBoutique }: Props) {
  const [confirming, setConfirming] = useState(false);
  const stockists = boutiques.filter((b) => b.brandIds.includes(brand.id));
  return (
    <div className="page">
      <div className="topbar">
        <button className="back" onClick={onBack}>
          ← Brands
        </button>
        <button className="box" onClick={onEdit}>
          <span>Edit</span>
          <span>→</span>
        </button>
      </div>
      <div className="spec entry">
        <h1 className="entry-title">{brand.name}</h1>
        {brand.website && (
          <a className="box visit" href={brand.website} target="_blank" rel="noopener noreferrer">
            <span>Visit {domainOf(brand.website)}</span>
            <span>↗</span>
          </a>
        )}

        <div className="opt-row">
          <span className="mute">EU duties</span>
          <div>
            <TaxChoice value={brand.euTax} onChange={onTax} />
            <p className="micro mute entry-note">{EU_TAX.find((t) => t.id === brand.euTax)!.label}, shipping to Europe.</p>
          </div>
        </div>

        <h2 className="entry-h">
          Stocked at <span className="mute">{String(stockists.length).padStart(3, "0")}</span>
        </h2>
        {stockists.length ? (
          <ul className="catlist stockists">
            {stockists.map((b) => (
              <li key={b.id}>
                <button onClick={() => onOpenBoutique(b)}>
                  <span>{b.name}</span>
                  <span className="mute">{b.city ? `${b.city.name}, ${countryName(b.city.country)}` : "Online"}</span>
                  <TaxMark tax={b.euTax} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="micro mute">No boutiques yet. Add one and tick this brand under Stocks.</p>
        )}

        <div className="entry-danger">
          {confirming ? (
            <div className="row" style={{ display: "flex", gap: 6 }}>
              <button className="btn" onClick={onDelete}>
                Delete brand
              </button>
              <button className="btn ghost" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </div>
          ) : (
            <button className="micro" style={{ textDecoration: "underline" }} onClick={() => setConfirming(true)}>
              Delete brand
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
