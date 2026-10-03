import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONTINENTS, EMPTY_PASSPORT, backfillPassport, chooseSkin, continentProgress, newStamps, stamp, stampCount,
} from '../src/core/passport';
import { campaignLevel } from '../src/core/campaign';
import { COUNTRIES } from '../src/core/world';
import type { GameResult } from '../src/core/types';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => void store.set(key, value),
    multiRemove: async (keys: string[]) => keys.forEach((key) => store.delete(key)),
  },
}));
const { loadPassport, savePassport, resetEverything } = await import('../src/storage/storage');

describe('passport stamps', () => {
  it('stamps each country once, keeping the first date', () => {
    const one = stamp(EMPTY_PASSPORT, ['FR', 'DE', 'FR'], '2026-10-01');
    expect(one.stamps).toEqual({ FR: '2026-10-01', DE: '2026-10-01' });
    const two = stamp(one, ['DE', 'PL'], '2026-10-03');
    expect(two.stamps).toEqual({ FR: '2026-10-01', DE: '2026-10-01', PL: '2026-10-03' });
    expect(stampCount(two)).toBe(3);
  });

  it('hands back the same passport when nothing is new, so nothing is saved', () => {
    const one = stamp(EMPTY_PASSPORT, ['FR'], '2026-10-01');
    expect(stamp(one, ['FR'], '2026-10-02')).toBe(one);
  });

  it('ignores codes that are not playable countries', () => {
    expect(stamp(EMPTY_PASSPORT, ['GL', 'XX'], '2026-10-01')).toBe(EMPTY_PASSPORT);
  });

  it('lists what a route added, in the order it was walked', () => {
    const before = stamp(EMPTY_PASSPORT, ['FR'], '2026-10-01');
    expect(newStamps(before, ['FR', 'DE', 'PL', 'DE', 'CZ'])).toEqual(['DE', 'PL', 'CZ']);
  });
});

describe('skins', () => {
  it('only lets the explorer wear a flag he has a stamp for', () => {
    const passport = stamp(EMPTY_PASSPORT, ['JP'], '2026-10-01');
    expect(chooseSkin(passport, 'JP').skin).toBe('JP');
    expect(chooseSkin(passport, 'FR')).toBe(passport);
    expect(chooseSkin(chooseSkin(passport, 'JP'), null).skin).toBeNull();
  });
});

describe('passport pages', () => {
  it('puts every playable country on exactly one page', () => {
    const total = CONTINENTS.reduce((sum, continent) => sum + continentProgress(EMPTY_PASSPORT, continent).total, 0);
    expect(total).toBe(COUNTRIES.length);
    for (const country of COUNTRIES) expect(CONTINENTS, country.name).toContain(country.continent);
  });

  it('counts stamps per page', () => {
    const passport = stamp(EMPTY_PASSPORT, ['FR', 'DE', 'JP'], '2026-10-01');
    expect(continentProgress(passport, 'Europe').stamped).toBe(2);
    expect(continentProgress(passport, 'Asia').stamped).toBe(1);
    expect(continentProgress(passport, 'Africa').stamped).toBe(0);
  });
});

describe('passport storage', () => {
  beforeEach(() => store.clear());

  const daily = (route: string[]): GameResult => ({
    mode: 'daily', difficulty: 'medium', route, moves: route.length - 1, wrongGuesses: 0, seconds: 30,
    optimalMoves: route.length - 1, optimal: true,
  });

  it('fills in an existing player from the history already saved', async () => {
    store.set('borderbound:daily:v1', JSON.stringify({ '2026-09-30': daily(['ES', 'FR', 'DE']) }));
    store.set('borderbound:campaign:v1', JSON.stringify({ 1: { moves: 2, seconds: 20, optimal: true } }));
    const passport = await loadPassport('2026-10-03');
    const level = campaignLevel(1)!;
    expect(Object.keys(passport.stamps).sort()).toEqual(['DE', 'ES', 'FR', level.start, level.destination].sort());
    expect(passport.skin).toBeNull();
    // Saved, so the backfill only ever happens once.
    expect(store.has('borderbound:passport:v1')).toBe(true);
  });

  it('starts a brand new player with an empty passport', async () => {
    expect(await loadPassport('2026-10-03')).toEqual(EMPTY_PASSPORT);
  });

  it('keeps what was saved, skin included', async () => {
    const passport = chooseSkin(stamp(EMPTY_PASSPORT, ['BR'], '2026-10-01'), 'BR');
    await savePassport(passport);
    // History added later must not be merged in again over a real passport.
    store.set('borderbound:daily:v1', JSON.stringify({ '2026-09-30': daily(['ES', 'FR']) }));
    expect(await loadPassport('2026-10-03')).toEqual(passport);
  });

  it('is cleared along with everything else', async () => {
    await savePassport(stamp(EMPTY_PASSPORT, ['BR'], '2026-10-01'));
    await resetEverything();
    expect(await loadPassport('2026-10-03')).toEqual(EMPTY_PASSPORT);
  });

  it('recovers from a corrupt passport by rebuilding it', async () => {
    store.set('borderbound:passport:v1', '{ nope');
    store.set('borderbound:daily:v1', JSON.stringify({ '2026-09-30': daily(['ES', 'FR']) }));
    expect(Object.keys((await loadPassport('2026-10-03')).stamps).sort()).toEqual(['ES', 'FR']);
  });
});
