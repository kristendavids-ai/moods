import { useEffect, useState } from "react";
import { getImage } from "../db/store";
import { objectUrl } from "./image";

export function useImage(imageId: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let live = true;
    if (!imageId) return;
    getImage(imageId).then((blob) => {
      if (live && blob) setUrl(objectUrl(imageId, blob));
    });
    return () => {
      live = false;
    };
  }, [imageId]);
  return url;
}
