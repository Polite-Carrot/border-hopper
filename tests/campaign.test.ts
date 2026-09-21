import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_LENGTH, CAMPAIGN_LEVELS, campaignGame, campaignLevel, completedCount,
  isLevelComplete, isLevelUnlocked, nextLevel, recordLevel, type CampaignProgress,
} from '../src/core/campaign';
import { shortestMoveCount } from '../src/core/graph';
import { getCountry } from '../src/core/world';
import type { GameResult } from '../src/core/types';

const result = (over: Partial<GameResult> = {}): GameResult => ({
  mode: 'campaign',
  level: 1,
  difficulty: 'easy',
  route: ['CA', 'US', 'MX'],
  moves: 2,
  wrongGuesses: 0,
  seconds: 30,
  optimalMoves: 2,
  optimal: true,
  ...over,
});

describe('campaign ladder', () => {
  it('has 250 levels, numbered in order', () => {
    expect(CAMPAIGN_LENGTH).toBe(250);
    CAMPAIGN_LEVELS.forEach((entry, index) => expect(entry.level).toBe(index + 1));
  });

  it('opens on somewhere everyone knows', () => {
    expect(campaignLevel(1)).toMatchObject({ start: 'CA', destination: 'MX', moves: 2 });
  });

  it('is solvable at every level, with the stored move count correct', () => {
    for (const entry of CAMPAIGN_LEVELS) {
      expect(getCountry(entry.start), `level ${entry.level} start`).toBeDefined();
      expect(getCountry(entry.destination), `level ${entry.level} destination`).toBeDefined();
      expect(entry.start).not.toBe(entry.destination);
      expect(shortestMoveCount(entry.start, entry.destination), `level ${entry.level}`).toBe(entry.moves);
    }
  });

  it('never repeats a pairing', () => {
    const pairs = CAMPAIGN_LEVELS.map((e) => [e.start, e.destination].sort().join('-'));
    expect(new Set(pairs).size).toBe(CAMPAIGN_LENGTH);
  });

  it('gets longer as it climbs', () => {
    const average = (from: number, to: number) => {
      const slice = CAMPAIGN_LEVELS.slice(from - 1, to);
      return slice.reduce((sum, e) => sum + e.moves, 0) / slice.length;
    };
    const early = average(1, 25);
    const middle = average(100, 125);
    const late = average(226, 250);
    expect(early).toBeLessThan(middle);
    expect(middle).toBeLessThan(late);
    expect(early).toBeLessThan(3);
    expect(late).toBeGreaterThan(7);
  });

  it('starts easy and never asks for more than eight moves', () => {
    for (const entry of CAMPAIGN_LEVELS.slice(0, 10)) expect(entry.moves).toBe(2);
    for (const entry of CAMPAIGN_LEVELS) {
      expect(entry.moves).toBeGreaterThanOrEqual(2);
      expect(entry.moves).toBeLessThanOrEqual(8);
    }
  });

  it('draws on better-known countries early than late', () => {
    // Land area stands in for recognisability here: the early pool is the
    // handful of countries almost everyone can place.
    const areaOf = (iso: string) => getCountry(iso)!.area;
    const spread = (from: number, to: number) =>
      CAMPAIGN_LEVELS.slice(from - 1, to).flatMap((e) => [areaOf(e.start), areaOf(e.destination)]);
    const median = (values: number[]) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
    expect(median(spread(1, 30))).toBeGreaterThan(median(spread(221, 250)));
  });

  it('builds a playable config from a level', () => {
    const config = campaignGame(12);
    expect(config.mode).toBe('campaign');
    expect(config.level).toBe(12);
    expect(config.optimalMoves).toBe(campaignLevel(12)!.moves);
    expect(shortestMoveCount(config.start, config.destination)).toBe(config.optimalMoves);
  });

  it('refuses a level that does not exist', () => {
    expect(() => campaignGame(0)).toThrow();
    expect(() => campaignGame(CAMPAIGN_LENGTH + 1)).toThrow();
  });
});

describe('campaign progress', () => {
  it('unlocks only the first level to begin with', () => {
    expect(isLevelUnlocked({}, 1)).toBe(true);
    expect(isLevelUnlocked({}, 2)).toBe(false);
    expect(nextLevel({})).toBe(1);
    expect(completedCount({})).toBe(0);
  });

  it('unlocks the next level once one is finished', () => {
    const progress = recordLevel({}, result({ level: 1 }));
    expect(isLevelComplete(progress, 1)).toBe(true);
    expect(isLevelUnlocked(progress, 2)).toBe(true);
    expect(isLevelUnlocked(progress, 3)).toBe(false);
    expect(nextLevel(progress)).toBe(2);
  });

  it('rejects levels outside the ladder', () => {
    expect(isLevelUnlocked({}, 0)).toBe(false);
    expect(isLevelUnlocked({}, CAMPAIGN_LENGTH + 1)).toBe(false);
  });

  it('reports the campaign finished once every level is done', () => {
    const progress: CampaignProgress = {};
    for (let level = 1; level <= CAMPAIGN_LENGTH; level++) {
      progress[level] = { moves: 2, seconds: 10, optimal: true };
    }
    expect(nextLevel(progress)).toBeNull();
    expect(completedCount(progress)).toBe(CAMPAIGN_LENGTH);
  });

  it('keeps the better attempt when a level is replayed', () => {
    let progress = recordLevel({}, result({ level: 5, moves: 6, seconds: 90, optimal: false }));
    progress = recordLevel(progress, result({ level: 5, moves: 4, seconds: 120, optimal: true }));
    expect(progress[5]).toEqual({ moves: 4, seconds: 120, optimal: true });

    // A worse attempt leaves the record alone.
    progress = recordLevel(progress, result({ level: 5, moves: 9, seconds: 10, optimal: false }));
    expect(progress[5]).toEqual({ moves: 4, seconds: 120, optimal: true });

    // Same moves but quicker does count.
    progress = recordLevel(progress, result({ level: 5, moves: 4, seconds: 40, optimal: true }));
    expect(progress[5].seconds).toBe(40);
  });

  it('ignores results from other modes', () => {
    expect(recordLevel({}, result({ mode: 'classic', level: undefined }))).toEqual({});
    expect(recordLevel({}, result({ mode: 'daily', level: undefined, dailyKey: '2026-09-21' }))).toEqual({});
  });
});
