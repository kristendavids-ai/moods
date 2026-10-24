import type { Item, Photo } from "../types";
import { boardPhoto } from "../types";
import type { SlotVariant } from "../lib/collage";
import { PhotoView } from "./PhotoView";

interface Props {
  item: Item;
  /** Which of the piece's photos to show; defaults to the board photo. */
  photo?: Photo;
  /** Cut-outs float on the paper with no plate behind them. */
  variant?: SlotVariant;
  caption?: boolean;
  onOpen: () => void;
}

export function Card({ item, photo = boardPhoto(item), variant = "photo", caption = true, onOpen }: Props) {
  const meta = [item.name, item.season].filter(Boolean).join(" · ");
  const label = [item.brand, item.name].filter(Boolean).join(" ") || "Piece";

  return (
    <button
      className={`card ${variant}${item.status === "soldout" ? " soldout" : ""}`}
      onClick={onOpen}
      aria-label={caption ? undefined : label}
    >
      <div className="plate">
        {photo && <PhotoView photo={photo} />}
        {caption && item.status !== "wishlist" && (
          <span className="flag">{item.status === "owned" ? "Owned" : "Sold out"}</span>
        )}
      </div>
      {caption && (
        <div className="card-caption">
          <span className="brand">
            {item.colour && <span className="dot sm" style={{ background: item.colour.hex }} aria-hidden />}
            {item.brand || "Unknown"} <span className="plus">+</span>
          </span>
          {meta && <span className="mute">{meta}</span>}
        </div>
      )}
    </button>
  );
}
