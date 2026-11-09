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
  it('is 100 levels, numbered in order', () => {
    expect(VISA_LENGTH).toBe(100);
    expect(VISA_LEVELS.map((l) => l.level)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });

  it('opens with France to Ukraine, Germany closed', () => {
    expect(visaLevel(1)).toMatchObject({ start: 'FR', destination: 'UA', closed: ['DE'], moves: 4 });
  });

  it('closes one border at first and four by the end, never fewer than the level before', () => {
    const counts = VISA_LEVELS.map((l) => l.closed.length);
    expect(counts[0]).toBe(1);
    expect(counts[99]).toBe(4);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
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

  it('gets harder: the back half is longer than the front', () => {
    const mean = (levels: typeof VISA_LEVELS) => levels.reduce((sum, l) => sum + l.moves, 0) / levels.length;
    expect(mean(VISA_LEVELS.slice(50))).toBeGreaterThan(mean(VISA_LEVELS.slice(0, 50)) + 3);
  });

  it('starts a level as a Visa Denied game with its closures', () => {
    const config = visaGame(30);
    expect(config).toMatchObject({ mode: 'visa', level: 30, start: visaLevel(30)!.start, closed: visaLevel(30)!.closed });
    expect(config.difficulty).toBe('medium');
    expect(visaGame(1).difficulty).toBe('easy');
    expect(visaGame(100).difficulty).toBe('hard');
    expect(() => visaGame(101)).toThrow();
  });

  it('opens one level at a time', () => {
    expect(isVisaLevelUnlocked({}, 1)).toBe(true);
    expect(isVisaLevelUnlocked({}, 2)).toBe(false);
    const progress = recordVisaLevel({}, result(1));
    expect(isVisaLevelUnlocked(progress, 2)).toBe(true);
    expect(isVisaLevelUnlocked(progress, 101)).toBe(false);
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
