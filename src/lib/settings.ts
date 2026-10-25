import { DEFAULT_CATEGORIES } from "../data/categories";

const KEY_API = "moods.apiKey";
const KEY_CATS = "moods.categories";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export const getApiKey = () => read(KEY_API) ?? "";
export const setApiKey = (k: string) => write(KEY_API, k.trim() || null);

export function getCategories(): string[] {
  const raw = read(KEY_CATS);
  if (!raw) return DEFAULT_CATEGORIES;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}
export const setCategories = (c: string[]) => write(KEY_CATS, JSON.stringify(c));

export type Section = "board" | "brands" | "boutiques";
const KEY_SECTION = "moods.section";
export const getSection = (): Section => {
  const s = read(KEY_SECTION);
  return s === "brands" || s === "boutiques" ? s : "board";
};
export const setSection = (s: Section) => write(KEY_SECTION, s);
