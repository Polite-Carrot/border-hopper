import raw from '../data/world.generated.json';
import type { Country, MapShape, WorldData } from './types';

const data = raw as unknown as WorldData;

export const MAP_WIDTH = data.width;
export const MAP_HEIGHT = data.height;

/** Every playable country, sorted by display name. */
export const COUNTRIES: readonly Country[] = data.countries;

/** Every drawable shape, including non-playable territories. */
export const SHAPES: readonly MapShape[] = data.shapes;

const byIso = new Map<string, Country>(COUNTRIES.map((c) => [c.iso2, c]));

export function getCountry(iso2: string): Country | undefined {
  return byIso.get(iso2);
}

/** Throws for unknown codes. Use where the code is known to be valid. */
export function requireCountry(iso2: string): Country {
  const c = byIso.get(iso2);
  if (!c) throw new Error(`Unknown country code: ${iso2}`);
  return c;
}

export function countryName(iso2: string): string {
  return byIso.get(iso2)?.name ?? iso2;
}

export function countryFlag(iso2: string): string {
  return byIso.get(iso2)?.flag ?? '';
}

/**
 * Bounding box of all playable land: [minX, minY, maxX, maxY]. The projected
 * canvas reaches further north and south than any country does, so framing the
 * whole world uses this instead of the full canvas.
 */
export const LAND_BOUNDS: [number, number, number, number] = COUNTRIES.reduce(
  (box, c) => [
    Math.min(box[0], c.bbox[0]),
    Math.min(box[1], c.bbox[1]),
    Math.max(box[2], c.bbox[2]),
    Math.max(box[3], c.bbox[3]),
  ],
  [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number]
);
