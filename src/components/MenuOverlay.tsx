import { useEffect, useState } from "react";
import type { Filters, Item, Status } from "../types";
import { STATUSES, boardPhoto } from "../types";
import { Header } from "./Header";
import { useImage } from "../lib/useImage";
import type { Section } from "../lib/settings";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "board", label: "Board" },
  { id: "brands", label: "Brands" },
  { id: "boutiques", label: "Boutiques" },
];

interface Props {
  section: Section;
  counts: Record<Section, number>;
  onSection: (s: Section) => void;
  categories: string[];
  seasons: string[];
  items: Item[];
  filters: Filters;
  onFilters: (f: Filters) => void;
  onClose: () => void;
  onSettings: () => void;
  onAdd: () => void;
  onOpenItem: (item: Item) => void;
}

export function MenuOverlay(p: Props) {
  const [closing, setClosing] = useState(false);
  const latest = p.items[0];
  const bg = useImage(latest && boardPhoto(latest)?.id);

  const close = (then?: () => void) => {
    setClosing(true);
    setTimeout(() => {
      p.onClose();
      then?.();
    }, 200);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const count = (c: string) => (c === "All" ? p.items.length : p.items.filter((i) => i.category === c).length);
  const pick = (f: Partial<Filters>) => close(() => p.onFilters({ ...p.filters, ...f }));
  const toggleStatus = (s: Status) => pick({ status: p.filters.status === s ? null : s });
  const toggleSeason = (s: string) => pick({ season: p.filters.season === s ? null : s });

  return (
    <>
      <div className="menu-scrim" onClick={() => close()} />
      <nav className={`menu${closing ? " closing" : ""}`} aria-label="Menu">
        <div className="menu-bg" style={bg ? { backgroundImage: `url(${bg})` } : undefined} />
        <div className="menu-glass" />
        <div className="menu-inner">
          <Header open count={p.counts[p.section]} onToggle={() => close()} />
          <ul className="menu-list">
            {SECTIONS.map((s, i) => (
              <li key={s.id} style={{ animationDelay: `${20 + i * 18}ms` }}>
                <button
                  className="menu-cat menu-section"
                  aria-current={p.section === s.id}
                  onClick={() => close(() => p.onSection(s.id))}
                >
                  {s.label}
                  {p.counts[s.id] > 0 && <sup>{p.counts[s.id]}</sup>}
                </button>
              </li>
            ))}
            {p.section === "board" && <li className="menu-rule" aria-hidden />}
            {p.section === "board" && ["All", ...p.categories].map((c, i) => (
              <li key={c} className="menu-sub" style={{ animationDelay: `${90 + i * 18}ms` }}>
                <button
                  className="menu-cat"
                  aria-current={p.filters.category === c}
                  onClick={() => pick({ category: c })}
                >
                  {c}
                  {count(c) > 0 && <sup>{count(c)}</sup>}
                </button>
              </li>
            ))}
          </ul>

          {p.section === "board" && p.seasons.length > 0 && (
            <div className="menu-row">
              <span className="label">Season</span>
              {p.seasons.map((s) => (
                <button key={s} aria-pressed={p.filters.season === s} onClick={() => toggleSeason(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="menu-row">
            <span className="label">{p.section === "board" ? "Status" : ""}</span>
            {p.section === "board" && STATUSES.map((s) => (
              <button key={s.id} aria-pressed={p.filters.status === s.id} onClick={() => toggleStatus(s.id)}>
                {s.label}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <button onClick={() => close(p.onSettings)}>Settings</button>
          </div>

          {p.section === "board" && (
            <button
              className="menu-feature"
              onClick={() => close(() => (latest ? p.onOpenItem(latest) : p.onAdd()))}
            >
              <span className="txt">
                <span>
                  {latest ? "Latest addition" : "Start your board"} <span className="plus">+</span>
                </span>
                <small>{latest ? [latest.brand, latest.name].filter(Boolean).join(" — ") || "View" : "Add a piece"}</small>
              </span>
              {bg && <img src={bg} alt="" />}
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
