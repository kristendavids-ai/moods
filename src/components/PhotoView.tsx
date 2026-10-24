import { useState } from "react";
import type { Photo } from "../types";
import { useImage } from "../lib/useImage";

interface Props {
  photo: Pick<Photo, "id" | "kind" | "mode">;
  /** Overrides the stored image, e.g. an unsaved crop in the form. */
  src?: string;
  alt?: string;
}

// Framed photos are true 4:5 and fill the plate; older item shots are letterboxed.
export function PhotoView({ photo, src, alt = "" }: Props) {
  const stored = useImage(src ? undefined : photo.id);
  const url = src ?? stored;
  const [loaded, setLoaded] = useState<string>();
  return url ? (
    <img
      src={url}
      alt={alt}
      draggable={false}
      className={`ph ${photo.mode ? "ph-framed" : `ph-legacy-${photo.kind}`}${loaded === url ? " ready" : ""}`}
      onLoad={() => setLoaded(url)}
    />
  ) : null;
}
