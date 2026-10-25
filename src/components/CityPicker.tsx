import { useEffect, useState } from "react";
import type { City } from "../types";
import { countryName, searchCities } from "../lib/places";

interface Props {
  value?: City;
  onChange: (c: City | undefined) => void;
}

/** Type a city, pick from the built-in world list. Clearing it makes the shop online-only. */
export function CityPicker({ value, onChange }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<City[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    if (!q.trim()) return setResults([]);
    searchCities(q)
      .then((r) => live && (setResults(r), setError(false)))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [q]);

  if (value && !open) {
    return (
      <div className="city-chosen">
        <span>
          {value.name}, <span className="mute">{countryName(value.country)}</span>
        </span>
        <button className="micro" onClick={() => (setOpen(true), setQ(""))}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="city-picker">
      <input
        value={q}
        placeholder="Search a city, e.g. Copenhagen"
        aria-label="City"
        autoComplete="off"
        autoCorrect="off"
        onChange={(e) => setQ(e.target.value)}
      />
      {(results.length > 0 || error || q) && (
        <ul className="city-results" role="listbox">
          {results.map((c) => (
            <li key={`${c.name}:${c.country}:${c.lat}`}>
              <button role="option" aria-selected={false} onClick={() => (onChange(c), setOpen(false), setQ(""))}>
                <span>{c.name}</span>
                <span className="mute">{countryName(c.country)}</span>
              </button>
            </li>
          ))}
          {error && <li className="micro mute city-empty">City list unavailable offline until first loaded.</li>}
          {!error && q && results.length === 0 && <li className="micro mute city-empty">No match.</li>}
        </ul>
      )}
      <button className="micro city-online" onClick={() => (onChange(undefined), setOpen(false), setQ(""))}>
        Online only — no shop location
      </button>
    </div>
  );
}
