import { useState, type KeyboardEvent } from "react";
import type { Brand } from "../types";
import { findBrand, suggestBrands } from "../lib/places";

interface Props {
  value: string;
  brands: Brand[];
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}

/** Free-text brand field with suggestions from the Brands list, styled like the city picker. */
export function BrandInput({ value, brands, onChange, className, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const known = findBrand(brands, value);
  const suggestions = suggestBrands(brands, value).filter((b) => b.name !== value);
  const showList = open && suggestions.length > 0;

  const pick = (b: Brand) => {
    onChange(b.name);
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return;
    if (e.key === "ArrowDown") setActive((i) => (i + 1) % suggestions.length);
    else if (e.key === "ArrowUp") setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    else if (e.key === "Enter") pick(suggestions[active]);
    else if (e.key === "Escape") setOpen(false);
    else return;
    e.preventDefault();
  };

  return (
    <div className="brand-input">
      <input
        className={className}
        value={value}
        placeholder={placeholder}
        aria-label="Brand"
        aria-autocomplete="list"
        aria-expanded={showList}
        autoCapitalize="words"
        autoComplete="off"
        onChange={(e) => (onChange(e.target.value), setOpen(true), setActive(0))}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKey}
      />
      {showList && (
        <ul className="city-results" role="listbox" aria-label="Your brands">
          {suggestions.map((b, i) => (
            <li key={b.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={i === active ? "active" : undefined}
                // Keep focus in the field so the tap lands before blur closes the list.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(b)}
              >
                <span>{b.name}</span>
                <span className="mute">In your brands</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.trim() && !known && !showList && <p className="brand-new micro mute">New brand — it’ll be added to Brands.</p>}
    </div>
  );
}
