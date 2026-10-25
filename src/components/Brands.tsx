import { useMemo, useRef, useState } from "react";
import type { Boutique, Brand, EuTax } from "../types";
import { EU_TAX } from "../types";
import { domainOf } from "../lib/places";
import { pad3 } from "./Header";
import { TaxMark } from "./Tax";
import { Hanger } from "./Hanger";

interface Props {
  brands: Brand[];
  boutiques: Boutique[];
  onOpen: (b: Brand) => void;
  onAdd: () => void;
}

const letterOf = (name: string) => {
  const c = name.trim().normalize("NFD")[0]?.toUpperCase() ?? "#";
  return /[A-Z]/.test(c) ? c : "#";
};

export function Brands({ brands, boutiques, onOpen, onAdd }: Props) {
  const [tax, setTax] = useState<EuTax | null>(null);
  const [sheet, setSheet] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  const stockedAt = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of boutiques) for (const id of b.brandIds) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [boutiques]);

  const shown = brands.filter((b) => !tax || b.euTax === tax);
  const groups = new Map<string, Brand[]>();
  for (const b of shown) groups.set(letterOf(b.name), [...(groups.get(letterOf(b.name)) ?? []), b]);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

  const jump = (l: string) =>
    list.current?.querySelector(`[data-letter="${l}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <div className="tabs letters" role="navigation" aria-label="Jump to letter">
        {letters.map((l) => (
          <button key={l} className="tab" disabled={!groups.has(l)} onClick={() => jump(l)}>
            {l}
          </button>
        ))}
      </div>
      {tax && (
        <div className="chips">
          <button className="chip" onClick={() => setTax(null)}>
            {EU_TAX.find((t) => t.id === tax)!.short} <span aria-label="clear">×</span>
          </button>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="empty">
          <Hanger />
          <p>{brands.length ? "No brands match." : "No brands yet."}</p>
          <p className="mute">{brands.length ? "Try another filter." : "Add the labels you love, with a link to their site."}</p>
        </div>
      ) : (
        <div className="index" ref={list}>
          {[...groups.entries()].map(([letter, rows]) => (
            <section key={letter} data-letter={letter} className="index-group">
              <h2 className="index-letter">{letter}</h2>
              {rows.map((b) => (
                <div key={b.id} className="index-row" role="button" tabIndex={0} onClick={() => onOpen(b)}
                  onKeyDown={(e) => e.key === "Enter" && onOpen(b)}>
                  <span className="index-name">{b.name}</span>
                  {b.website ? (
                    <a className="index-link" href={b.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      {domainOf(b.website)} ↗
                    </a>
                  ) : (
                    <span className="index-link mute">—</span>
                  )}
                  <TaxMark tax={b.euTax} />
                  <span className="index-count mute" title="Boutiques stocking it">
                    {pad3(stockedAt.get(b.id) ?? 0)}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <div className="bars">
        <button className="bar light small" onClick={() => setSheet(true)}>
          <span>Filter</span>
          <span>{tax ? "01" : "+"}</span>
        </button>
        <button className="bar" onClick={onAdd}>
          <span>Add brand</span>
          <span>{pad3(shown.length)}</span>
        </button>
      </div>

      {sheet && (
        <>
          <div className="menu-scrim" onClick={() => setSheet(false)} />
          <div className="sheet" role="dialog" aria-label="Filter brands">
            <div className="sheet-head">
              <span>Filter</span>
              <button onClick={() => setSheet(false)} aria-label="Close filter">
                ×
              </button>
            </div>
            <div className="opt-row">
              <span className="mute">EU duties</span>
              <div className="opts">
                <button aria-pressed={!tax} onClick={() => setTax(null)}>
                  <span className="radio" aria-hidden />
                  Any
                </button>
                {EU_TAX.map((t) => (
                  <button key={t.id} aria-pressed={tax === t.id} onClick={() => setTax(t.id)}>
                    <span className="radio" aria-hidden />
                    {t.short}
                  </button>
                ))}
              </div>
            </div>
            <div className="bars static">
              <button className="bar" onClick={() => setSheet(false)}>
                <span>Show {pad3(shown.length)}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
