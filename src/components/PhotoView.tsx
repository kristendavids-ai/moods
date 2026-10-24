import { useState } from "react";
import type { Photo } from "../types";
import { useImage } from "../lib/useImage";

interface Props {
  photo: Pick<Photo, "id" | "kind">;
  /** Overrides the stored image, e.g. an unsaved crop in the form. */
  src?: string;
  alt?: string;
}

// Item shots sit centred on the plate; worn shots fill it.
export function PhotoView({ photo, src, alt = "" }: Props) {
  const stored = useImage(src ? undefined : photo.id);
  const url = src ?? stored;
  const [loaded, setLoaded] = useState<string>();
  return url ? (
    <img
      src={url}
      alt={alt}
      draggable={false}
      className={`ph ph-${photo.kind}${loaded === url ? " ready" : ""}`}
      onLoad={() => setLoaded(url)}
    />
  ) : null;
}
