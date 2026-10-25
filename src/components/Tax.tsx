import type { EuTax } from "../types";
import { EU_TAX } from "../types";

/** ● paid · ○ customs due · grey dot unknown — the same marks as the globe. */
export function TaxMark({ tax, label = false }: { tax: EuTax; label?: boolean }) {
  const t = EU_TAX.find((x) => x.id === tax)!;
  return (
    <span className={`tax tax-${tax}`} title={t.label}>
      <span className="tax-dot" aria-hidden />
      {label ? <span>{t.short}</span> : <span className="sr-only">{t.label}</span>}
    </span>
  );
}

/** Three-way choice with radio dots, as in the filter sheet. */
export function TaxChoice({ value, onChange }: { value: EuTax; onChange: (t: EuTax) => void }) {
  return (
    <div className="opts" role="radiogroup" aria-label="Duties & VAT to the EU">
      {EU_TAX.map((t) => (
        <button key={t.id} role="radio" aria-checked={value === t.id} aria-pressed={value === t.id} onClick={() => onChange(t.id)}>
          <span className="radio" aria-hidden />
          {t.short}
        </button>
      ))}
    </div>
  );
}
