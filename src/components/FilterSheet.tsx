import type { Filters } from "../types";
import { STATUSES } from "../types";

interface Props {
  seasons: string[];
  filters: Filters;
  onFilters: (f: Filters) => void;
  onClose: () => void;
}

export function FilterSheet({ seasons, filters, onFilters, onClose }: Props) {
  const set = (f: Partial<Filters>) => onFilters({ ...filters, ...f });
  return (
    <>
      <div className="menu-scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Filter">
        <h3 className="cond">Filter</h3>
        <span className="micro mute">Status</span>
        <div className="seg">
          <button aria-pressed={!filters.status} onClick={() => set({ status: null })}>
            Any
          </button>
          {STATUSES.map((s) => (
            <button key={s.id} aria-pressed={filters.status === s.id} onClick={() => set({ status: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
        <span className="micro mute">Season</span>
        <div className="seg">
          <button aria-pressed={!filters.season} onClick={() => set({ season: null })}>
            Any
          </button>
          {seasons.map((s) => (
            <button key={s} aria-pressed={filters.season === s} onClick={() => set({ season: s })}>
              {s}
            </button>
          ))}
        </div>
        <div className="bars" style={{ position: "static", marginTop: 4 }}>
          <button
            className="bar light small"
            onClick={() => onFilters({ category: filters.category, season: null, status: null })}
          >
            Clear
          </button>
          <button className="bar" onClick={onClose}>
            <span>Show results</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </>
  );
}
