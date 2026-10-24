interface Props {
  open: boolean;
  onToggle: () => void;
}

export function PillHeader({ open, onToggle }: Props) {
  return (
    <button className="pill" onClick={onToggle} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>
      <span className="wordmark">Moods</span>
      <span className="cond">{open ? "Close" : "Menu"}</span>
    </button>
  );
}
