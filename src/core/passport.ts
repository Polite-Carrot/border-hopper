import { campaignLevel, type CampaignProgress } from './campaign';
import { COUNTRIES, getCountry } from './world';
import type { Continent, GameResult } from './types';

/**
 * The passport: a stamp for every country the explorer has stood in, and the
 * flag he is wearing.
 *
 * "Stood in" means any country on any route -- the start, every country passed
 * through and the destination -- in any mode, finished or not. Walking out of a
 * game half way does not take back the countries already crossed.
 */
export interface Passport {
  /** ISO code -> the date (YYYY-MM-DD) it was first stamped. */
  stamps: Record<string, string>;
  /** The flag on the explorer's jumper, or null for his own red jumper. */
  skin: string | null;
}

export const EMPTY_PASSPORT: Passport = { stamps: {}, skin: null };

/** Pages of the passport, in the order they are shown. */
export const CONTINENTS: readonly Continent[] = [
  'Europe',
  'Asia',
  'Africa',
  'North America',
  'South America',
  'Oceania',
];

export function hasStamp(passport: Passport, iso: string): boolean {
  return passport.stamps[iso] !== undefined;
}

export function stampCount(passport: Passport): number {
  return Object.keys(passport.stamps).length;
}

/**
 * Stamps every country in `isos` that is not stamped yet. Returns the same
 * passport object when nothing is new, so callers can skip saving.
 */
export function stamp(passport: Passport, isos: readonly string[], date: string): Passport {
  let stamps: Record<string, string> | null = null;
  for (const iso of isos) {
    if (!getCountry(iso) || passport.stamps[iso] !== undefined || stamps?.[iso] !== undefined) continue;
    stamps ??= { ...passport.stamps };
    stamps[iso] = date;
  }
  return stamps ? { ...passport, stamps } : passport;
}

/** Countries in `route` that `before` had no stamp for, in the order visited. */
export function newStamps(before: Passport, route: readonly string[]): string[] {
  const seen = new Set<string>();
  const fresh: string[] = [];
  for (const iso of route) {
    if (seen.has(iso) || hasStamp(before, iso) || !getCountry(iso)) continue;
    seen.add(iso);
    fresh.push(iso);
  }
  return fresh;
}

/** Puts a flag on the jumper. Only a stamped country's flag can be worn. */
export function chooseSkin(passport: Passport, skin: string | null): Passport {
  if (skin !== null && !hasStamp(passport, skin)) return passport;
  if (skin === passport.skin) return passport;
  return { ...passport, skin };
}

/** Stamps collected and available on one page of the passport. */
export function continentProgress(passport: Passport, continent: Continent): { stamped: number; total: number } {
  const page = COUNTRIES.filter((country) => country.continent === continent);
  return { stamped: page.filter((country) => hasStamp(passport, country.iso2)).length, total: page.length };
}

/**
 * A passport for a player who was playing before passports existed, built from
 * what the game already kept: every daily challenge's full route, and the two
 * ends of every campaign level finished. Dated `date`, because when the
 * stamps were really earned was never recorded.
 */
export function backfillPassport(
  daily: Record<string, GameResult>,
  campaign: CampaignProgress,
  date: string
): Passport {
  const isos: string[] = [];
  for (const result of Object.values(daily)) isos.push(...result.route);
  for (const key of Object.keys(campaign)) {
    const level = campaignLevel(Number(key));
    if (level) isos.push(level.start, level.destination);
  }
  return stamp(EMPTY_PASSPORT, isos, date);
}
