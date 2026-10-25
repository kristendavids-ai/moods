// Generates public/data/cities.json for the boutique city picker.
// Source: all-the-cities (GeoNames, CC BY 4.0). Run: node scripts/build-cities.mjs
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const cities = createRequire(import.meta.url)("all-the-cities");
const MIN_POPULATION = 15000;

const ascii = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const rows = cities
  .filter((c) => c.population >= MIN_POPULATION)
  .sort((a, b) => b.population - a.population)
  .map((c) => {
    const [lon, lat] = c.loc.coordinates;
    const a = ascii(c.name);
    // [name, ascii name (only when different), country, lat, lon, population]
    return [c.name, a === c.name ? 0 : a, c.country, +lat.toFixed(3), +lon.toFixed(3), c.population];
  });

writeFileSync(new URL("../public/data/cities.json", import.meta.url), JSON.stringify(rows));
console.log(`${rows.length} cities`);
