// Fashion seasons: SS runs Jan–Jun, AW runs Jul–Dec.
export function currentSeason(date = new Date()): string {
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  return date.getMonth() < 6 ? `SS${yy}` : `AW${yy}`;
}

export function suggestedSeasons(date = new Date()): string[] {
  const y = date.getFullYear() % 100;
  const pad = (n: number) => String(n).padStart(2, "0");
  return [`AW${pad(y)}`, `SS${pad(y + 1)}`, `SS${pad(y)}`, `AW${pad(y - 1)}`, "Pre-Fall", "Resort", "Archive"];
}

// Newest first: AW26 > SS26 > AW25; named seasons sort last.
export function seasonSortKey(s: string): number {
  const m = /^(SS|AW)(\d{2})$/i.exec(s.trim());
  if (!m) return -1;
  return Number(m[2]) * 2 + (m[1].toUpperCase() === "AW" ? 1 : 0);
}
