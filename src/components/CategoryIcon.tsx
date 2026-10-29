import { useId } from "react";

/**
 * Category symbols: a thin circle crossed by one horizon line, which rises (or drops)
 * into a single, simple outline of the garment. Sharp corners, no detail. 48×48 grid,
 * circle r=22 about the centre, horizon at y=28; lines are clipped to the circle.
 */
const ICONS: Record<string, string[]> = {
  // Hat: brim on the line, trapezoid crown.
  Accessories: ["M0 28 H17 L19 17 H29 L31 28 H48"],
  // Funnel collar on wide shoulders.
  Outerwear: ["M0 28 H8 L19 22 V14 H29 V22 L40 28 H48"],
  // Short stand collar.
  Jackets: ["M0 28 H8 L19 22 V19 H29 V22 L40 28 H48"],
  // Lapel V.
  Tailoring: ["M0 28 H8 L18 21 L24 27 L30 21 L40 28 H48"],
  // Pointed collar.
  Shirting: ["M0 28 H8 L18 22 L20 18 L24 22 L28 18 L30 22 L40 28 H48"],
  // Crew neck.
  Knitwear: ["M0 28 H8 L18 21 Q24 26 30 21 L40 28 H48"],
  // Hood.
  Sweatshirts: ["M0 28 H8 L18 22 A6 8 0 0 1 30 22 L40 28 H48"],
  // Short sleeves.
  "T-Shirts": ["M0 28 H9 V23 L15 20 H33 L39 23 V28 H48"],
  // Camisole: straight bodice, two strap peaks.
  Tops: ["M0 28 H16 V20 L18 14 L20 20 H28 L30 14 L32 20 V28 H48"],
  // A-line, hanging from the line.
  Dresses: ["M0 28 H20 L13 42 H35 L28 28 H48"],
  Skirts: ["M0 28 H19 L16 37 H32 L29 28 H48"],
  Trousers: ["M0 28 H17 L16 43 H22 L24 33 L26 43 H32 L31 28 H48"],
  // Tapered leg and a rivet.
  Denim: ["M0 28 H17 L18 43 H22 L24 33 L26 43 H30 L31 28 H48", "M19.3 31 a0.7 0.7 0 1 0 1.4 0 a0.7 0.7 0 1 0 -1.4 0"],
  Shorts: ["M0 28 H16 L15 36 H22 L24 32 L26 36 H33 L32 28 H48"],
  // Shoe in profile: heel, then one slope to the toe.
  Footwear: ["M0 28 H12 V21 H21 L37 28 H48"],
  // Square with a handle.
  Bags: ["M0 28 H17 V20 H31 V28 H48", "M19.5 20 A4.5 6 0 0 1 28.5 20"],
  // A ring resting on the line.
  Jewellery: ["M0 28 H48", "M19.5 23.5 a4.5 4.5 0 1 0 9 0 a4.5 4.5 0 1 0 -9 0"],
};

// A category of your own: just the horizon.
const FALLBACK = ["M0 28 H48"];

export const hasIcon = (category: string) => category in ICONS;

export function CategoryIcon({ category, size = 48, className }: { category: string; size?: number; className?: string }) {
  const clip = useId();
  const paths = ICONS[category] ?? FALLBACK;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden
    >
      <clipPath id={clip}>
        <circle cx="24" cy="24" r="22" />
      </clipPath>
      <circle className="cat-ring" cx="24" cy="24" r="22" vectorEffect="non-scaling-stroke" />
      <g clipPath={`url(#${clip})`}>
        {paths.map((d, i) => (
          <path key={i} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
}

export const ICON_CATEGORIES = Object.keys(ICONS);
