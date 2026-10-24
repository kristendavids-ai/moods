import { useState } from "react";
import type { Item } from "../types";
import { useImage } from "../lib/useImage";

const STATUS_LINE: Record<Item["status"], string> = {
  wishlist: "",
  owned: "Owned",
  soldout: "Sold out",
};

export function Card({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const url = useImage(item.imageId);
  const [ready, setReady] = useState(false);
  const second = [STATUS_LINE[item.status], item.season].filter(Boolean).join(" · ");

  return (
    <button className={`card${item.status === "soldout" ? " soldout" : ""}`} onClick={onOpen}>
      <div className="plate">
        {url && <img src={url} alt="" className={ready ? "ready" : ""} onLoad={() => setReady(true)} />}
      </div>
      <div className="card-caption cond">
        <div>
          {item.brand || "Unknown"}
          {item.name ? ` ${item.name}` : ""}
          {item.colour ? ` ${item.colour.name}` : ""}
        </div>
        {second && <div className="line2">{second}</div>}
      </div>
    </button>
  );
}
