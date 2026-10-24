import Anthropic from "@anthropic-ai/sdk";
import { blobToBase64 } from "./image";
import type { Colour } from "../types";

export interface ScanResult {
  brand: string;
  name: string;
  category: string;
  colour?: Colour;
  season: string;
}

const PROMPT = `This is a photo or screenshot of a fashion item someone wants to save to their wishlist.

Identify:
- brand: the fashion house or label. Read logos, wordmarks, labels, the site name in a browser URL bar or app header, and captions. Use the brand's usual capitalisation (e.g. "Maison Margiela", "Our Legacy", "Palace"). Empty string if you genuinely cannot tell.
- name: the product name if it is printed on screen (e.g. "Dascar Jacket"), otherwise a short plain description (e.g. "Shearling flying jacket"). No brand, no colour.
- category: the single best fit from the allowed list.
- colour: the dominant colour of the garment itself, as a short name ("Chocolate", "Navy") and a hex value sampled from the garment.
- season: a season code such as "AW26" or "SS25" only if one is visible on screen, otherwise empty string.`;

export class ScanError extends Error {}

export async function scanImage(apiKey: string, image: Blob, categories: string[]): Promise<ScanResult> {
  if (!apiKey) throw new ScanError("Add your Anthropic API key in Settings to scan brands.");

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const data = await blobToBase64(image);
  const media = (image.type === "image/jpeg" || image.type === "image/png" || image.type === "image/gif"
    ? image.type
    : "image/webp") as "image/webp";

  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["brand", "name", "category", "colour_name", "colour_hex", "season"],
          properties: {
            brand: { type: "string" },
            name: { type: "string" },
            category: { type: "string", enum: categories },
            colour_name: { type: "string" },
            colour_hex: { type: "string" },
            season: { type: "string" },
          },
        },
      },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: media, data } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
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
  };
  const hex = /^#?[0-9a-f]{6}$/i.test(raw.colour_hex) ? `#${raw.colour_hex.replace("#", "")}` : "";
  return {
    brand: raw.brand.trim(),
    name: raw.name.trim(),
    category: raw.category,
    colour: raw.colour_name && hex ? { name: raw.colour_name.trim(), hex } : undefined,
    season: raw.season.trim().toUpperCase(),
  };
}
