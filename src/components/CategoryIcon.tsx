/**
 * Category symbols in Hard Sun's drawing style: one thin ink line, round ends, open
 * shapes, no fill. Each is a flat-sketch pictogram on a 48×48 grid.
 */
const ICONS: Record<string, string[]> = {
  // Long coat: shoulders, lapels into a deep V, belt, long hem.
  Outerwear: [
    "M17 6 L11 9 L7 24 L9 25 L12 16 L12 43 L36 43 L36 16 L39 25 L41 24 L37 9 L31 6",
    "M17 6 L24 22 L31 6",
    "M24 22 L24 43",
    "M12 28 L36 28",
  ],
  // Bomber: zip, ribbed collar, cuffs and hem.
  Jackets: [
    "M18 8 L11 11 L6 27 L10 28 L13 19 L13 35 L35 35 L35 19 L38 28 L42 27 L37 11 L30 8",
    "M18 8 Q24 12 30 8",
    "M24 10 L24 35",
    "M13 35 L13 39 L35 39 L35 35",
    "M6 27 L5.5 30 L9.5 31 L10 28",
    "M42 27 L42.5 30 L38.5 31 L38 28",
  ],
  // Jumper: crew neck and rib lines at cuffs and hem.
  Knitwear: [
    "M19 8 Q24 12 29 8 L37 11 L42 30 L37 31.5 L34 21 L34 40 L14 40 L14 21 L11 31.5 L6 30 L11 11 Z",
    "M14 36 L34 36",
    "M18 36 L18 40 M22 36 L22 40 M26 36 L26 40 M30 36 L30 40",
    "M7 27 L41 27",
  ],
  // Shirt: pointed collar, placket with buttons.
  Shirting: [
    "M19 8 L12 11 L7 29 L11 30 L15 19 L15 41 L33 41 L33 19 L37 30 L41 29 L36 11 L29 8",
    "M19 8 L24 14 L29 8 M19 8 L21 15 L24 14 L27 15 L29 8",
    "M24 14 L24 41",
    "M26 20 h0.01 M26 26 h0.01 M26 32 h0.01",
  ],
  // Camisole: thin straps, straight neckline.
  Tops: ["M17 8 L17 18 M31 8 L31 18", "M16 18 L32 18 L35 40 L13 40 Z", "M16 18 Q24 24 32 18"],
  // Tee: short sleeves, crew neck.
  "T-Shirts": ["M19 9 Q24 13 29 9 L39 13 L43 21 L36 24 L34 20 L34 40 L14 40 L14 20 L12 24 L5 21 L9 13 Z"],
  // Hoodie: hood and kangaroo pocket.
  Sweatshirts: [
    "M18 10 L11 13 L6 30 L10 31 L14 21 L14 40 L34 40 L34 21 L38 31 L42 30 L37 13 L30 10",
    "M18 10 Q17 3 24 3 Q31 3 30 10 Q24 15 18 10",
    "M18 30 L30 30 L32 36 L16 36 Z",
    "M22 12 L21 18 M26 12 L27 18",
  ],
  // Wide trousers with a pressed crease.
  Trousers: ["M14 6 L34 6 L37 43 L27 43 L24 15 L21 43 L11 43 Z", "M14 10 L34 10", "M17.5 14 L16 43 M30.5 14 L32 43"],
  // Jeans: pocket arcs and rivet dots.
  Denim: [
    "M14 6 L34 6 L36 43 L27 43 L24 17 L21 43 L12 43 Z",
    "M14 10 L34 10",
    "M15 12 Q19 13 20 17 M33 12 Q29 13 28 17",
    "M24 10 L24 17",
    "M16.5 15 h0.01 M31.5 15 h0.01",
  ],
  Shorts: ["M12 12 L36 12 L39 34 L27 35 L24 22 L21 35 L9 34 Z", "M12 16 L36 16", "M24 16 L24 22"],
  // A-line skirt with pleats.
  Skirts: ["M16 8 L32 8 L39 40 L9 40 Z", "M16 12 L32 12", "M20 12 L16 40 M24 12 L24 40 M28 12 L32 40"],
  // Slip dress: straps, fitted bodice, flared hem.
  Dresses: ["M18 4 L18 14 M30 4 L30 14", "M17 14 L31 14 L29 23 L37 44 L11 44 L19 23 Z", "M19 23 L29 23"],
  // Blazer: notch lapels, one button, welt pocket.
  Tailoring: [
    "M18 6 L11 9 L7 30 L11 31 L13 20 L13 41 L35 41 L35 20 L37 31 L41 30 L37 9 L30 6",
    "M18 6 L24 25 L30 6",
    "M18 6 L16 14 L19 15 L21 17 M30 6 L32 14 L29 15 L27 17",
    "M24 25 L24 41",
    "M25.5 29 h0.01",
    "M28 33 L33 33",
  ],
  // Loafer in profile.
  Footwear: ["M5 31 Q5 22 13 22 L25 23 Q33 25 39 28 Q44 30 43 34 L43 36 L5 36 Z", "M5 32 L43 32", "M18 22 Q19 27 27 25"],
  // Tote: rectangle with two handles.
  Bags: ["M9 18 L39 18 L36 42 L12 42 Z", "M17 18 Q17 6 24 6 Q31 6 31 18", "M21 18 Q21 11 24 11 Q27 11 27 18"],
  // Sunglasses.
  Accessories: [
    "M6 20 L18 20 Q20 20 19.5 23 L18.5 29 Q18 32 15 32 L10 32 Q7 32 6.5 29 L5.5 23 Q5 20 6 20 Z",
    "M42 20 L30 20 Q28 20 28.5 23 L29.5 29 Q30 32 33 32 L38 32 Q41 32 41.5 29 L42.5 23 Q43 20 42 20 Z",
    "M19 22 Q24 19 29 22",
  ],
  // Ring with a cut stone.
  Jewellery: [
    "M24 18 m-13 13 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0",
    "M24 18 m-9.5 13 a9.5 9.5 0 1 0 19 0 a9.5 9.5 0 1 0 -19 0",
    "M18 13 L21 8 L27 8 L30 13 L24 18 Z",
    "M18 13 L30 13 M21 8 L24 13 L27 8",
  ],
};

// Any category of your own falls back to the hanger.
const FALLBACK = ["M24 15 c0-4 3-6.5 6-6.5 s5.5 2.4 5.5 5.5 c0 3.5-3 5-5 6.2 c-1.8 1.1-6.5 3-6.5 6.8", "M24 27 L6 38.5 c-2.5 1.6-1.6 4.5 1.2 4.5 h33.6 c2.8 0 3.7-2.9 1.2-4.5 L24 27"];

export const hasIcon = (category: string) => category in ICONS;

export function CategoryIcon({ category, size = 48, className }: { category: string; size?: number; className?: string }) {
  const paths = ICONS[category] ?? FALLBACK;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((d, i) => (
        <path key={i} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export const ICON_CATEGORIES = Object.keys(ICONS);
