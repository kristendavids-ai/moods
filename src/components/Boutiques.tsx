import { useEffect, useMemo, useState } from "react";
import type { Boutique, Brand, EuTax } from "../types";
import { EU_TAX } from "../types";
import { REGIONS, regionOf } from "../data/regions";
import { countryName, domainOf } from "../lib/places";
import { pad3 } from "./Header";
import { Globe, type Dot } from "./Globe";
import { TaxMark } from "./Tax";

interface Props {
  boutiques: Boutique[];
  brands: Brand[];
  /** Open with this boutique selected (from a brand's "Stocked at" list). */
  initial?: string;
  onAdd: () => void;
  onEdit: (b: Boutique) => void;
  onOpenBrand: (b: Brand) => void;
}

interface Filters {
  places: Set<string>;
  taxes: Set<EuTax>;
  brand?: string;
}

const ONLINE = "Online";
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const leafKey = (b: Boutique) => (b.city ? `${b.city.country}:${b.city.name}` : "online");
const regionKey = (b: Boutique) => (b.city ? regionOf(b.city.country) : ONLINE);

interface Tree {
  region: string;
  leaves: string[];
  count: number;
  countries: { code: string; name: string; leaves: string[]; count: number; cities: { key: string; name: string; count: number }[] }[];
}

function buildTree(list: Boutique[]): Tree[] {
  const regions = new Map<string, Map<string, Map<string, { name: string; count: number }>>>();
  for (const b of list) {
    const r = regionKey(b);
    const c = b.city?.country ?? "—";
    const countries = regions.get(r) ?? new Map();
    const cities = countries.get(c) ?? new Map();
    const k = leafKey(b);
    cities.set(k, { name: b.city?.name ?? "Online only", count: (cities.get(k)?.count ?? 0) + 1 });
    countries.set(c, cities);
    regions.set(r, countries);
  }
  const order = [...REGIONS, "Elsewhere", ONLINE];
  return [...regions.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([region, countries]) => {
      const cs = [...countries.entries()]
        .map(([code, cities]) => {
          const cityList = [...cities.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => a.name.localeCompare(b.name));
          return {
            code,
            name: code === "—" ? "Online" : countryName(code),
            cities: cityList,
            leaves: cityList.map((c) => c.key),
            count: cityList.reduce((n, c) => n + c.count, 0),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      return { region, countries: cs, leaves: cs.flatMap((c) => c.leaves), count: cs.reduce((n, c) => n + c.count, 0) };
    });
}

function Check({ state }: { state: "on" | "off" | "mixed" }) {
  return <span className={`check check-${state}`} aria-hidden />;
}

interface PanelProps {
  tree: Tree[];
  brands: Brand[];
  filters: Filters;
  onFilters: (f: Filters) => void;
}

/** Region › Country › City tree with tri-state checks and counts, plus duties and stockist filters. */
function FilterPanel({ tree, brands, filters, onFilters }: PanelProps) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(tree.map((t) => t.region)));
  const [q, setQ] = useState("");
  const toggleOpen = (k: string) => setOpen((s) => (s.has(k) ? (s.delete(k), new Set(s)) : new Set(s.add(k))));
  const stateOf = (leaves: string[]): "on" | "off" | "mixed" => {
    const n = leaves.filter((l) => filters.places.has(l)).length;
    return n === 0 ? "off" : n === leaves.length ? "on" : "mixed";
  };
  const toggle = (leaves: string[]) => {
    const places = new Set(filters.places);
    const on = stateOf(leaves) === "on";
    leaves.forEach((l) => (on ? places.delete(l) : places.add(l)));
    onFilters({ ...filters, places });
  };
  const toggleTax = (t: EuTax) => {
    const taxes = new Set(filters.taxes);
    if (!taxes.delete(t)) taxes.add(t);
    onFilters({ ...filters, taxes });
  };
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const brand = brands.find((b) => b.id === filters.brand);
  const brandMatches = q.trim() ? brands.filter((b) => fold(b.name).includes(fold(q.trim()))).slice(0, 6) : [];
  const total = tree.reduce((n, t) => n + t.count, 0);

  return (
    <div className="fpanel">
      <div className="fpanel-head">
        <span>Places</span>
        <span className="mute">{pad3(total)}</span>
        {filters.places.size > 0 && (
          <button className="micro" onClick={() => onFilters({ ...filters, places: new Set() })}>
            Clear
          </button>
        )}
      </div>
      <ul className="tree">
        {tree.map((r) => (
          <li key={r.region}>
            <div className="tree-row lvl0">
              {r.region === ONLINE ? (
                <span className="tree-caret" />
              ) : (
                <button className="tree-caret" aria-expanded={open.has(r.region)} onClick={() => toggleOpen(r.region)} aria-label={`Expand ${r.region}`}>
                  ›
                </button>
              )}
              <button className="tree-label" onClick={() => toggle(r.leaves)} aria-pressed={stateOf(r.leaves) === "on"}>
                <Check state={stateOf(r.leaves)} />
                <span>{r.region === ONLINE ? "Online only" : r.region}</span>
              </button>
              <span className="tree-count">{r.count}</span>
            </div>
            {open.has(r.region) && r.region !== ONLINE && (
              <ul>
                {r.countries.map((c) => (
                  <li key={c.code}>
                    <div className="tree-row lvl1">
                      {c.cities.length > 1 ? (
                        <button className="tree-caret" aria-expanded={open.has(c.code)} onClick={() => toggleOpen(c.code)} aria-label={`Expand ${c.name}`}>
                          ›
                        </button>
                      ) : (
                        <span className="tree-caret" />
                      )}
                      <button className="tree-label" onClick={() => toggle(c.leaves)} aria-pressed={stateOf(c.leaves) === "on"}>
                        <Check state={stateOf(c.leaves)} />
                        <span>{c.name}</span>
                        {c.cities.length === 1 && c.code !== "—" && <span className="mute"> · {c.cities[0].name}</span>}
                      </button>
                      <span className="tree-count">{c.count}</span>
                    </div>
                    {c.cities.length > 1 && open.has(c.code) && (
                      <ul>
                        {c.cities.map((city) => (
                          <li key={city.key} className="tree-row lvl2">
                            <span className="tree-caret" />
                            <button className="tree-label" onClick={() => toggle([city.key])} aria-pressed={filters.places.has(city.key)}>
                              <Check state={filters.places.has(city.key) ? "on" : "off"} />
                              <span>{city.name}</span>
                            </button>
                            <span className="tree-count">{city.count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <div className="fpanel-head">
        <span>EU duties</span>
      </div>
      <ul className="tree">
        {EU_TAX.map((t) => (
          <li key={t.id} className="tree-row lvl0">
            <span className="tree-caret" />
            <button className="tree-label" onClick={() => toggleTax(t.id)} aria-pressed={filters.taxes.has(t.id)}>
              <Check state={filters.taxes.has(t.id) ? "on" : "off"} />
              <TaxMark tax={t.id} />
              <span>{t.short}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="fpanel-head">
        <span>Stocks brand</span>
      </div>
      {brand ? (
        <div className="chips flush">
          <button className="chip" onClick={() => onFilters({ ...filters, brand: undefined })}>
            {brand.name} <span aria-label="clear">×</span>
          </button>
        </div>
      ) : (
        <div className="stocks">
          <input className="fpanel-search" value={q} placeholder="Search your brands" aria-label="Filter by brand" onChange={(e) => setQ(e.target.value)} />
          {brandMatches.length > 0 && (
            <ul className="city-results">
              {brandMatches.map((b) => (
                <li key={b.id}>
                  <button onClick={() => (onFilters({ ...filters, brand: b.id }), setQ(""))}>
                    <span>{b.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function Boutiques({ boutiques, brands, initial, onAdd, onEdit, onOpenBrand }: Props) {
  const [filters, setFilters] = useState<Filters>({ places: new Set(), taxes: new Set() });
  const [selected, setSelected] = useState<string | undefined>(initial);
  const [focus, setFocus] = useState<{ lat: number; lon: number; token: number }>();
  const [sheet, setSheet] = useState(false);

  // Place counts reflect the other filters, so the tree shows what a tick would add.
  const others = boutiques.filter(
    (b) => (!filters.taxes.size || filters.taxes.has(b.euTax)) && (!filters.brand || b.brandIds.includes(filters.brand)),
  );
  const shown = others.filter((b) => !filters.places.size || filters.places.has(leafKey(b)));
  const tree = useMemo(() => buildTree(others), [others]);
  const brandById = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);
  const dots: Dot[] = shown.flatMap((b) => (b.city ? [{ id: b.id, name: b.name, lat: b.city.lat, lon: b.city.lon, tax: b.euTax }] : []));
  const current = boutiques.find((b) => b.id === selected);

  const select = (id: string | undefined) => {
    setSelected(id);
    const b = boutiques.find((x) => x.id === id);
    if (b?.city) setFocus({ lat: b.city.lat, lon: b.city.lon, token: Date.now() });
  };

  // On a phone the list sits under the globe; bring the globe back into view to watch it turn.
  const pickFromList = (id: string) => {
    select(id);
    if (window.matchMedia("(max-width: 959px)").matches) window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  useEffect(() => {
    if (initial) select(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const count = (t: EuTax) => shown.filter((b) => b.euTax === t).length;
  const countries = new Set(shown.flatMap((b) => (b.city ? [b.city.country] : []))).size;
  const stocked = new Set(shown.flatMap((b) => b.brandIds)).size;
  const activeFilters = filters.places.size + filters.taxes.size + (filters.brand ? 1 : 0);

  const groups = new Map<string, Boutique[]>();
  for (const b of shown) {
    const k = b.city ? countryName(b.city.country) : "Online";
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }

  return (
    <div className="bq">
      <aside className="bq-filters">
        <FilterPanel tree={tree} brands={brands} filters={filters} onFilters={setFilters} />
      </aside>

      <section className="bq-centre">
        <Globe dots={dots} selected={selected} focus={focus} onSelect={select} />
        <div className="bq-legend micro">
          {EU_TAX.map((t) => (
            <span key={t.id}>
              <TaxMark tax={t.id} /> {t.short}
            </span>
          ))}
        </div>
        {current && (
          <div className="bq-card" role="dialog" aria-label={current.name}>
            <div className="bq-card-head">
              <span className="bq-card-name">{current.name}</span>
              <button onClick={() => setSelected(undefined)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="kv">
              <span className="mute">Location</span>
              <span>
                {current.city ? `${current.city.name}, ${countryName(current.city.country)}` : "Online only"}
                {current.address ? ` · ${current.address}` : ""}
              </span>
              <span className="mute">EU duties</span>
              <span>
                <TaxMark tax={current.euTax} label />
              </span>
              <span className="mute">Stocks</span>
              <span className="bq-brands">
                {current.brandIds.filter((id) => brandById.has(id)).length
                  ? current.brandIds
                      .filter((id) => brandById.has(id))
                      .map((id) => (
                        <button key={id} onClick={() => onOpenBrand(brandById.get(id)!)}>
                          {brandById.get(id)!.name}
                        </button>
                      ))
                  : "—"}
              </span>
            </div>
            <div className="bq-card-actions">
              {current.website && (
                <a className="box" href={current.website} target="_blank" rel="noopener noreferrer">
                  <span>{domainOf(current.website)}</span>
                  <span>↗</span>
                </a>
              )}
              <button className="box light" onClick={() => onEdit(current)}>
                <span>Edit</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}
      </section>

      <aside className="bq-side">
        <div className="bq-stats">
          <div className="stat">
            <span className="mute">Boutiques</span>
            <b>{pad3(shown.length)}</b>
          </div>
          <div className="stat">
            <span className="mute">Duties paid</span>
            <b>{pad3(count("paid"))}</b>
            <small className="mute">
              {count("due")} due · {count("unknown")} unknown
            </small>
          </div>
          <div className="stat">
            <span className="mute">Countries</span>
            <b>{pad3(countries)}</b>
            <small className="mute">{stocked} brands stocked</small>
          </div>
        </div>

        <div className="bq-list">
          {shown.length === 0 && (
            <p className="micro mute bq-empty">{boutiques.length ? "No boutiques match these filters." : "No boutiques yet — add the shops you buy from."}</p>
          )}
          {[...groups.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([country, list]) => (
              <section key={country}>
                <h2 className="index-letter">{country}</h2>
                {list.map((b) => (
                  <button key={b.id} className="index-row bq-row" aria-current={b.id === selected} onClick={() => pickFromList(b.id)}>
                    <span className="index-name">{b.name}</span>
                    <span className="index-link mute">{b.city?.name ?? domainOf(b.website) ?? "Online"}</span>
                    <TaxMark tax={b.euTax} />
                    <span className="index-count mute">{pad3(b.brandIds.length)}</span>
                  </button>
                ))}
              </section>
            ))}
        </div>
      </aside>

      <div className="bars">
        <button className="bar light small bq-filter-btn" onClick={() => setSheet(true)}>
          <span>Filter</span>
          <span>{activeFilters ? pad3(activeFilters).slice(1) : "+"}</span>
        </button>
        <button className="bar" onClick={onAdd}>
          <span>Add boutique</span>
          <span>{pad3(shown.length)}</span>
        </button>
      </div>

      {sheet && (
        <>
          <div className="menu-scrim" onClick={() => setSheet(false)} />
          <div className="sheet tall" role="dialog" aria-label="Filter boutiques">
            <div className="sheet-head">
              <span>Filter</span>
              <button onClick={() => setSheet(false)} aria-label="Close filter">
                ×
              </button>
            </div>
            <FilterPanel tree={tree} brands={brands} filters={filters} onFilters={setFilters} />
            <div className="bars static">
              <button className="bar" onClick={() => setSheet(false)}>
                <span>Show {pad3(shown.length)}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
