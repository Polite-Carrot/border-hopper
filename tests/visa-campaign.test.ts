import { describe, expect, it } from 'vitest';
import {
  VISA_LENGTH, VISA_LEVELS, isVisaLevelUnlocked, recordVisaLevel, visaGame, visaLevel, visaNextLevel,
} from '../src/core/visaCampaign';
import { recordLevel } from '../src/core/campaign';
import { shortestMoveCount } from '../src/core/graph';
import { verifyConfig } from '../src/core/generate';
import { getCountry } from '../src/core/world';
import { shareText } from '../src/core/share';
import type { GameResult } from '../src/core/types';
import partOne from '../scripts/data/visa-campaign-part-one.json';

const result = (level: number, over: Partial<GameResult> = {}): GameResult => {
  const config = visaGame(level);
  return {
    mode: 'visa',
    level,
    difficulty: config.difficulty,
    route: [config.start, config.destination],
    moves: config.optimalMoves,
    wrongGuesses: 0,
    closed: config.closed,
    seconds: 40,
    optimalMoves: config.optimalMoves,
    optimal: true,
    ...over,
  };
};

describe('Visa Denied campaign', () => {
  it('is 1000 levels, numbered in order', () => {
    expect(VISA_LENGTH).toBe(1000);
    expect(VISA_LEVELS.map((l) => l.level)).toEqual(Array.from({ length: 1000 }, (_, i) => i + 1));
  });

  it('keeps the first 100 levels exactly as they shipped', () => {
    expect(VISA_LEVELS.slice(0, 100)).toEqual(partOne.levels);
  });

  it('opens with France to Ukraine, Germany closed', () => {
    expect(visaLevel(1)).toMatchObject({ start: 'FR', destination: 'UA', closed: ['DE'], moves: 4 });
  });

  it('closes one border at first and four by level 100, never fewer than the level before', () => {
    const counts = VISA_LEVELS.slice(0, 100).map((l) => l.closed.length);
    expect(counts[0]).toBe(1);
    expect(counts[99]).toBe(4);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
  });

  it('closes more borders after the first waves, never more than five', () => {
    const mean = (levels: typeof VISA_LEVELS) => levels.reduce((sum, l) => sum + l.closed.length, 0) / levels.length;
    const firstWaves = VISA_LEVELS.slice(100, 400);
    const laterWaves = VISA_LEVELS.slice(400);
    expect(mean(laterWaves)).toBeGreaterThan(mean(firstWaves) + 0.5);
    for (const level of VISA_LEVELS) expect(level.closed.length).toBeLessThanOrEqual(5);
  });

  it('closes no country in more than about a sixth of levels', () => {
    const counts = new Map<string, number>();
    for (const level of VISA_LEVELS) for (const iso of level.closed) counts.set(iso, (counts.get(iso) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(VISA_LENGTH / 6);
  });

  it('never sets the same closures twice after level 100', () => {
    const key = (l: (typeof VISA_LEVELS)[number]) => l.closed.slice().sort().join('-');
    const before = new Set(VISA_LEVELS.slice(0, 100).map(key));
    const after = VISA_LEVELS.slice(100).map(key);
    expect(new Set(after).size).toBe(after.length);
    for (const k of after) expect(before.has(k)).toBe(false);
  });

  it('moves around the world rather than living on one corridor', () => {
    const continents = new Set(VISA_LEVELS.slice(100).map((l) => getCountry(l.start)!.continent));
    expect([...continents]).toEqual(expect.arrayContaining(['Europe', 'Asia', 'Africa']));
    const europe = VISA_LEVELS.slice(100).filter(
      (l) => getCountry(l.start)!.continent === 'Europe' && getCountry(l.destination)!.continent === 'Europe'
    );
    expect(europe.length).toBeGreaterThan(80);
  });

  it('has every level solvable, scored right, and made longer by its closures', () => {
    for (const level of VISA_LEVELS) {
      const closed = new Set(level.closed);
      expect(shortestMoveCount(level.start, level.destination, false, closed), `level ${level.level}`).toBe(level.moves);
      expect(level.moves).toBeGreaterThan(shortestMoveCount(level.start, level.destination)!);
      expect(level.moves).toBeLessThanOrEqual(14);
      expect(verifyConfig(visaGame(level.level))).toBe(true);
    }
  });

  it('never closes the start, the destination or a territory, and ends in sovereign countries', () => {
    for (const level of VISA_LEVELS) {
      expect(level.closed).not.toContain(level.start);
      expect(level.closed).not.toContain(level.destination);
      expect(new Set(level.closed).size).toBe(level.closed.length);
      for (const iso of [level.start, level.destination, ...level.closed]) {
        expect(getCountry(iso)?.territory, `${iso} on level ${level.level}`).toBeFalsy();
      }
    }
  });

  it('never repeats a journey', () => {
    const pairs = VISA_LEVELS.map((l) => [l.start, l.destination].sort().join('-'));
    expect(new Set(pairs).size).toBe(VISA_LENGTH);
  });

  it('gets harder: longer journeys later on', () => {
    const mean = (levels: typeof VISA_LEVELS) => levels.reduce((sum, l) => sum + l.moves, 0) / levels.length;
    expect(mean(VISA_LEVELS.slice(50, 100))).toBeGreaterThan(mean(VISA_LEVELS.slice(0, 50)) + 3);
    expect(mean(VISA_LEVELS.slice(900))).toBeGreaterThan(mean(VISA_LEVELS.slice(100, 200)) + 2);
  });

  it('starts a level as a Visa Denied game with its closures', () => {
    const config = visaGame(30);
    expect(config).toMatchObject({ mode: 'visa', level: 30, start: visaLevel(30)!.start, closed: visaLevel(30)!.closed });
    expect(config.difficulty).toBe('medium');
    expect(visaGame(1).difficulty).toBe('easy');
    expect(visaGame(100).difficulty).toBe('hard');
    expect(visaGame(1000).level).toBe(1000);
    expect(() => visaGame(1001)).toThrow();
  });

  it('opens one level at a time', () => {
    expect(isVisaLevelUnlocked({}, 1)).toBe(true);
    expect(isVisaLevelUnlocked({}, 2)).toBe(false);
    const progress = recordVisaLevel({}, result(1));
    expect(isVisaLevelUnlocked(progress, 2)).toBe(true);
    expect(isVisaLevelUnlocked(progress, 1001)).toBe(false);
    expect(visaNextLevel({})).toBe(1);
    expect(visaNextLevel(progress)).toBe(2);
    const all = Object.fromEntries(VISA_LEVELS.map((l) => [l.level, { moves: l.moves, seconds: 1, optimal: true }]));
    expect(visaNextLevel(all)).toBeNull();
  });

  it('keeps the better attempt, and a star once earned', () => {
    let progress = recordVisaLevel({}, result(1));
    progress = recordVisaLevel(progress, result(1, { moves: 9, optimal: false }));
    expect(progress[1]).toEqual({ moves: visaLevel(1)!.moves, seconds: 40, optimal: true });
    progress = recordVisaLevel(progress, result(1, { seconds: 20, hints: 1, optimal: false }));
    expect(progress[1]).toEqual({ moves: visaLevel(1)!.moves, seconds: 20, optimal: true });
  });

  it('is kept apart from random Visa Denied games and from the campaign', () => {
    const random = result(1, { level: undefined });
    expect(recordVisaLevel({}, random)).toEqual({});
    expect(recordLevel({}, result(1))).toEqual({});
    expect(recordVisaLevel({}, { ...result(1), mode: 'campaign' })).toEqual({});
  });

  it('shares a level without giving away the route', () => {
    const level = visaLevel(12)!;
    const text = shareText(result(12, { route: [level.start, 'XX', level.destination] }));
    expect(text).toContain('Visa Denied, level 12');
    expect(text).toContain('closed');
    expect(text).not.toContain(' → ');
    // A random Visa Denied game is nobody else's puzzle: its route is shown.
    expect(shareText(result(12, { level: undefined }))).toContain(' → ');
  });
});
