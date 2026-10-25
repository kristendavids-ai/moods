import type { City } from "../types";

let names: Intl.DisplayNames | undefined;
export function countryName(code: string): string {
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "region" });
    return names.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** "lemaire.fr" → "https://lemaire.fr"; empty stays empty. */
export function normalizeUrl(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function domainOf(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// [name, ascii name or 0, country, lat, lon, population], most populous first.
type Row = [string, string | 0, string, number, number, number];
let cities: Promise<Row[]> | undefined;

export function loadCities(): Promise<Row[]> {
  cities ??= fetch(`${import.meta.env.BASE_URL}data/cities.json`).then((r) => {
    if (!r.ok) throw new Error("cities unavailable");
    return r.json();
  });
  cities.catch(() => (cities = undefined)); // allow a retry
  return cities;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Accent-insensitive; whole-name prefix matches first, then word-prefix matches, each by population. */
export async function searchCities(query: string, limit = 8): Promise<City[]> {
  const q = fold(query.trim());
  if (!q) return [];
  const rows = await loadCities();
  const starts: Row[] = [];
  const words: Row[] = [];
  for (const r of rows) {
    const n = fold(r[1] || r[0]);
    if (n.startsWith(q)) starts.push(r);
    else if (words.length < limit && n.includes(` ${q}`)) words.push(r);
    if (starts.length >= limit) break;
  }
  return [...starts, ...words].slice(0, limit).map(([name, , country, lat, lon]) => ({ name, country, lat, lon }));
}
