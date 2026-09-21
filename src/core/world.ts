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
