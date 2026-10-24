import type { Item } from "../types";
import { boardPhoto } from "../types";
import { PhotoView } from "./PhotoView";

export function Card({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const photo = boardPhoto(item);
  const meta = [item.name, item.season].filter(Boolean).join(" · ");

  return (
    <button className={`card${item.status === "soldout" ? " soldout" : ""}`} onClick={onOpen}>
      <div className="plate">
        {photo && <PhotoView photo={photo} />}
        {item.status !== "wishlist" && <span className="flag">{item.status === "owned" ? "Owned" : "Sold out"}</span>}
      </div>
      <div className="card-caption">
        <span className="brand">
          {item.colour && <span className="dot sm" style={{ background: item.colour.hex }} aria-hidden />}
          {item.brand || "Unknown"} <span className="plus">+</span>
        </span>
        {meta && <span className="mute">{meta}</span>}
      </div>
    </button>
  );
}
