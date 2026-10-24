import { useRef, useState, type ReactNode } from "react";
import type { Item, PhotoKind, Status } from "../types";
import { STATUSES, heroPhotos } from "../types";
import { PhotoView } from "./PhotoView";

interface Props {
  item: Item;
  onBack: () => void;
  onEdit: () => void;
  onAddPhoto: (kind: PhotoKind) => void;
  onStatus: (s: Status) => void;
  onDelete: () => void;
}

function Accordion({ title, children, open: initial = false }: { title: string; children: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <div className="acc" data-open={open}>
      <button onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title}</span>
        <span className="plus" aria-hidden>
          +
        </span>
      </button>
      <div className="acc-body">
        <div>{children}</div>
      </div>
    </div>
  );
}

export function ItemDetail({ item, onBack, onEdit, onAddPhoto, onStatus, onDelete }: Props) {
  const photos = heroPhotos(item);
  const missing: PhotoKind | undefined =
    photos.length === 1 ? (photos[0].kind === "worn" ? "item" : "worn") : undefined;
  const reel = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const alt = [item.brand, item.name].filter(Boolean).join(" ");
  const show = (i: number) => reel.current?.scrollTo({ left: i * reel.current.clientWidth, behavior: "smooth" });
  const [confirming, setConfirming] = useState(false);
  const added = new Date(item.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="page">
      <div className="topbar">
        <button className="back" onClick={onBack}>
          ← <span className="wordmark">Moods</span>
        </button>
        <button className="box" onClick={onEdit}>
          <span>Edit</span>
          <span>→</span>
        </button>
      </div>

      <div className="hero-wrap">
        <div
          className="reel"
          ref={reel}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          {photos.map((p) => (
            <div key={p.id} className="hero">
              <PhotoView photo={p} alt={alt} />
            </div>
          ))}
        </div>
        <span className="tag">
          {item.category}
          {item.season ? ` · ${item.season}` : ""}
        </span>
        {photos.length > 1 && (
          <span className="tag right">
            {index + 1}/{photos.length}
          </span>
        )}
      </div>

      <div className="thumbs">
        {photos.map((p, i) => (
          <button key={p.id} className="thumb" aria-current={i === index} onClick={() => show(i)}>
            <span className="plate">
              <PhotoView photo={p} />
            </span>
            <span className="micro">{p.kind === "worn" ? "Worn" : "Item"}</span>
          </button>
        ))}
        {missing && (
          <button className="thumb" onClick={() => onAddPhoto(missing)}>
            <span className="plate add-slot">
              <span>+</span>
            </span>
            <span className="micro mute">Add {missing === "worn" ? "worn" : "item"} shot</span>
          </button>
        )}
      </div>

      <div className="spec">
        <div className="title">{item.brand || "Unknown brand"}</div>
        <div className="sub micro">{item.name || " "}</div>

        <div className="swatches micro">
          {item.colour && <span className="dot" style={{ background: item.colour.hex }} aria-hidden />}
          {item.colour && <span>{item.colour.name}</span>}
          <div className="statusline" role="group" aria-label="Status">
            {STATUSES.map((s) => (
              <button key={s.id} aria-pressed={item.status === s.id} onClick={() => onStatus(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <Accordion title="Details" open>
          <div className="kv">
            <span className="mute">Brand</span>
            <span>{item.brand || "—"}</span>
            <span className="mute">Category</span>
            <span>{item.category}</span>
            <span className="mute">Season</span>
            <span>{item.season || "—"}</span>
            <span className="mute">Size</span>
            <span>{item.size || "—"}</span>
            <span className="mute">Colour</span>
            <span>{item.colour?.name || "—"}</span>
            <span className="mute">Added</span>
            <span>{added}</span>
          </div>
        </Accordion>
        <Accordion title="Notes" open={!!item.notes}>
          <div className="notes">{item.notes || <span className="mute">No notes yet.</span>}</div>
        </Accordion>
        <Accordion title="Remove">
          <div style={{ padding: "2px 0 14px" }}>
            {confirming ? (
              <div className="row" style={{ display: "flex", gap: 6 }}>
                <button className="btn" onClick={onDelete}>
                  Delete piece
                </button>
                <button className="btn ghost" onClick={() => setConfirming(false)}>
                  Keep
                </button>
              </div>
            ) : (
              <button className="micro" style={{ textDecoration: "underline" }} onClick={() => setConfirming(true)}>
                Delete from board
              </button>
            )}
          </div>
        </Accordion>
      </div>

      <button className="bar" onClick={onEdit}>
        <span>Edit piece</span>
        <span>{STATUSES.find((s) => s.id === item.status)!.label}</span>
      </button>
    </div>
  );
}
