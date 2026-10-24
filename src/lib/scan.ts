import Anthropic from "@anthropic-ai/sdk";
import { blobToBase64 } from "./image";
import type { Colour, PhotoKind, Rect } from "../types";

export interface ScannedPhoto {
  kind: PhotoKind;
  box: Rect;
}

export interface ScanResult {
  brand: string;
  name: string;
  category: string;
  colour?: Colour;
  season: string;
  /** One entry per image sent, in order. */
  photos: (ScannedPhoto | undefined)[];
}

const PROMPT = (n: number) => `${n === 1 ? "This is a photo or screenshot" : `These ${n} images are photos or screenshots`} of one fashion item someone wants to save to their wishlist. Images are numbered from 0 in the order given.

Identify:
- brand: the fashion house or label. Read logos, wordmarks, labels, the site name in a browser URL bar or app header, and captions. Use the brand's usual capitalisation (e.g. "Maison Margiela", "Our Legacy", "Palace"). Empty string if you genuinely cannot tell.
- name: the product name if it is printed on screen (e.g. "Dascar Jacket"), otherwise a short plain description (e.g. "Shearling flying jacket"). No brand, no colour.
- category: the single best fit from the allowed list.
- colour: the dominant colour of the garment itself, as a short name ("Chocolate", "Navy") and a hex value sampled from the garment.
- season: a season code such as "AW26" or "SS25" only if one is visible on screen, otherwise empty string.

For each image, also give:
- kind: "worn" if a person is wearing the item, "item" if it is a product shot of the item on its own (flat lay, ghost mannequin, hanger, studio packshot).
- a bounding box as fractions of that image's width and height (left/top/right/bottom, 0 = left or top edge, 1 = right or bottom edge):
  - for "item": tight around the garment itself, excluding any text, prices, buttons, other products and phone or browser interface.
  - for "worn": the photograph only, excluding the phone status bar, browser bars, app headers, buttons, captions and any other interface or text around it.`;

export class ScanError extends Error {}

type Media = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const mediaType = (b: Blob): Media =>
  b.type === "image/jpeg" || b.type === "image/png" || b.type === "image/gif" ? b.type : "image/webp";

export async function scanImages(apiKey: string, images: Blob[], categories: string[]): Promise<ScanResult> {
  if (!apiKey) throw new ScanError("Add your Anthropic API key in Settings to scan brands.");

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const blocks = await Promise.all(
    images.map(async (b) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: mediaType(b), data: await blobToBase64(b) },
    })),
  );

  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 1500,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["brand", "name", "category", "colour_name", "colour_hex", "season", "photos"],
          properties: {
            brand: { type: "string" },
            name: { type: "string" },
            category: { type: "string", enum: categories },
            colour_name: { type: "string" },
            colour_hex: { type: "string" },
            season: { type: "string" },
            photos: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["image", "kind", "left", "top", "right", "bottom"],
                properties: {
                  image: { type: "integer" },
                  kind: { type: "string", enum: ["worn", "item"] },
                  left: { type: "number" },
                  top: { type: "number" },
                  right: { type: "number" },
                  bottom: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    messages: [{ role: "user", content: [...blocks, { type: "text", text: PROMPT(images.length) }] }],
  });

  if (response.stop_reason === "refusal") throw new ScanError("Couldn't read this image.");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const raw = JSON.parse(text) as {
    brand: string;
    name: string;
    category: string;
    colour_name: string;
    colour_hex: string;
    season: string;
    photos: { image: number; kind: PhotoKind; left: number; top: number; right: number; bottom: number }[];
  };

  const photos: (ScannedPhoto | undefined)[] = images.map(() => undefined);
  for (const p of raw.photos ?? []) {
    if (!(p.image in photos)) continue;
    // Accept 0–100 percentages too, in case the model answers in those.
    const s = Math.max(p.left, p.top, p.right, p.bottom) > 1.5 ? 100 : 1;
    const [l, t, r, b] = [p.left / s, p.top / s, p.right / s, p.bottom / s].map((n) => Math.min(1, Math.max(0, n)));
    if (r - l < 0.05 || b - t < 0.05) continue;
    photos[p.image] = { kind: p.kind, box: { x: l, y: t, w: r - l, h: b - t } };
  }

  const hex = /^#?[0-9a-f]{6}$/i.test(raw.colour_hex) ? `#${raw.colour_hex.replace("#", "")}` : "";
  return {
    brand: raw.brand.trim(),
    name: raw.name.trim(),
    category: raw.category,
    colour: raw.colour_name && hex ? { name: raw.colour_name.trim(), hex } : undefined,
    season: raw.season.trim().toUpperCase(),
    photos,
  };
}
