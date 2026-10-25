import { useEffect, useRef } from "react";

interface Props {
  categories: string[];
  active: string;
  onSelect: (c: string) => void;
}

export function CategoryTabs({ categories, active, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  return (
    <div className="tabs" role="tablist" ref={ref}>
      {["Index", "All", ...categories].map((c) => (
        <button key={c} role="tab" className="tab" aria-selected={c === active} onClick={() => onSelect(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}
