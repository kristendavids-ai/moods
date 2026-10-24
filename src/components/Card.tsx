import { useState } from "react";
import type { Item } from "../types";
import { useImage } from "../lib/useImage";

export function Card({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const url = useImage(item.imageId);
  const [ready, setReady] = useState(false);
  const meta = [item.name, item.season].filter(Boolean).join(" · ");

  return (
    <button className={`card${item.status === "soldout" ? " soldout" : ""}`} onClick={onOpen}>
      <div className="plate">
        {url && <img src={url} alt="" className={ready ? "ready" : ""} onLoad={() => setReady(true)} />}
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
