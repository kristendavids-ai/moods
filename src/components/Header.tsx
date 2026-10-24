interface Props {
  open: boolean;
  count: number;
  onToggle: () => void;
  onHome?: () => void;
}

export const pad3 = (n: number) => String(n).padStart(3, "0");

// Hard Sun's "Hard Sun ··· [Bag 000]" header; the box opens the glass menu.
export function Header({ open, count, onToggle, onHome }: Props) {
  return (
    <div className="masthead">
      <button className="wordmark" onClick={onHome} aria-label="MOODS, home">
        Moods
      </button>
      <button className="box" onClick={onToggle} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>
        <span>{open ? "Close" : "Menu"}</span>
        <span>{open ? "×" : pad3(count)}</span>
      </button>
    </div>
  );
}
