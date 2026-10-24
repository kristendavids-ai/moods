import type { Filters } from "../types";
import { STATUSES } from "../types";

interface Props {
  seasons: string[];
  filters: Filters;
  onFilters: (f: Filters) => void;
  onClose: () => void;
}

function Choice({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button aria-pressed={on} onClick={onClick}>
      <span className="radio" aria-hidden />
      {label}
    </button>
  );
}

export function FilterSheet({ seasons, filters, onFilters, onClose }: Props) {
  const set = (f: Partial<Filters>) => onFilters({ ...filters, ...f });
  return (
    <>
      <div className="menu-scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Filter">
        <div className="sheet-head">
          <span>Filter</span>
          <button onClick={onClose} aria-label="Close filter">
            ×
          </button>
        </div>
        <div className="opt-row">
          <span className="mute">Status</span>
          <div className="opts">
            <Choice label="Any" on={!filters.status} onClick={() => set({ status: null })} />
            {STATUSES.map((s) => (
              <Choice key={s.id} label={s.label} on={filters.status === s.id} onClick={() => set({ status: s.id })} />
            ))}
          </div>
        </div>
        <div className="opt-row">
          <span className="mute">Season</span>
          <div className="opts">
            <Choice label="Any" on={!filters.season} onClick={() => set({ season: null })} />
            {seasons.map((s) => (
              <Choice key={s} label={s} on={filters.season === s} onClick={() => set({ season: s })} />
            ))}
          </div>
        </div>
        <div className="bars static">
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
