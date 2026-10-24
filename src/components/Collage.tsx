import { useEffect, useMemo, useRef } from "react";
import type { Item } from "../types";
import { layout } from "../lib/collage";
import { Card } from "./Card";

interface Props {
  items: Item[];
  onOpen: (item: Item) => void;
}

// Fixed room under each image for its two caption lines.
const CAPTION_PX = 34;

export function Collage({ items, onOpen }: Props) {
  const spreads = useMemo(() => layout(items), [items]);
  const ref = useRef<HTMLElement>(null);

  // Spreads drift up into place as they scroll in.
  useEffect(() => {
    const els = ref.current?.querySelectorAll<HTMLElement>(".spread:not(.in)") ?? [];
    if (!("IntersectionObserver" in window)) return els.forEach((el) => el.classList.add("in"));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [spreads]);

  return (
    <main className="board" ref={ref}>
      {spreads.map((s) => (
        <section key={s.key} className="spread" data-key={s.key} style={{ paddingBottom: `calc(${s.height}% + ${CAPTION_PX}px)` }}>
          {s.slots.map((slot) => (
            <div
              key={`${slot.item.id}:${slot.photo?.id}`}
              className="tile"
              data-key={`${slot.item.id}:${slot.photo?.id}`}
              style={{ left: `${slot.x}%`, width: `${slot.w}%`, marginTop: `${slot.y}%` }}
            >
              <Card
                item={slot.item}
                photo={slot.photo}
                variant={slot.variant}
                caption={slot.caption}
                onOpen={() => onOpen(slot.item)}
              />
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
