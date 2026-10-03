import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_LENGTH, CAMPAIGN_LEVELS, campaignGame, campaignLevel, completedCount,
  isLevelComplete, isLevelUnlocked, nextLevel, recordLevel, type CampaignProgress,
} from '../src/core/campaign';
import { distancesFrom, shortestMoveCount } from '../src/core/graph';
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
  it('has 1000 levels, numbered in order', () => {
    expect(CAMPAIGN_LENGTH).toBe(1000);
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
    const late = average(CAMPAIGN_LENGTH - 24, CAMPAIGN_LENGTH);
    expect(early).toBeLessThan(middle);
    expect(middle).toBeLessThan(late);
    expect(early).toBeLessThan(3.5);
    expect(late).toBeGreaterThan(11);
  });

  it('opens gently, then starts climbing straight away', () => {
    // A short warm-up of two-move routes, not a long one: twelve flat levels
    // in a row read as samey rather than easy, and that is where a new player
    // decides whether the game has anything else to offer.
    const moves = CAMPAIGN_LEVELS.map((entry) => entry.moves);
    expect(moves.slice(0, 3)).toEqual([2, 2, 2]);
    const firstLonger = moves.findIndex((m) => m > 2) + 1;
    expect(firstLonger).toBeGreaterThanOrEqual(3);
    expect(firstLonger).toBeLessThanOrEqual(6);
  });

  it('starts easy and never asks for more than twelve moves', () => {
    for (const entry of CAMPAIGN_LEVELS.slice(0, 3)) expect(entry.moves).toBe(2);
    for (const entry of CAMPAIGN_LEVELS) {
      expect(entry.moves).toBeGreaterThanOrEqual(2);
      expect(entry.moves).toBeLessThanOrEqual(12);
    }
  });

  it('draws on better-known countries early than late', () => {
    // Land area stands in for recognisability here: the early pool is the
    // handful of countries almost everyone can place.
    const areaOf = (iso: string) => getCountry(iso)!.area;
    const spread = (from: number, to: number) =>
      CAMPAIGN_LEVELS.slice(from - 1, to).flatMap((e) => [areaOf(e.start), areaOf(e.destination)]);
    const median = (values: number[]) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
    expect(median(spread(1, 30))).toBeGreaterThan(median(spread(CAMPAIGN_LENGTH - 29, CAMPAIGN_LENGTH)));
  });

  it('never drops back sharply in difficulty', () => {
    // A two-move level dropped into a run of four-move ones reads as a
    // mistake. When the generator has to bend, it bends variety, not this.
    for (let i = 1; i < CAMPAIGN_LEVELS.length; i++) {
      const [before, level] = [CAMPAIGN_LEVELS[i - 1], CAMPAIGN_LEVELS[i]];
      expect(level.moves, `level ${level.level}`).toBeGreaterThanOrEqual(before.moves - 1);
    }
  });

  it('does not keep coming back to the same countries', () => {
    // Over a long ladder the best-connected countries otherwise come round
    // every few levels; a third of levels once reused one from the last five.
    let reused = 0;
    CAMPAIGN_LEVELS.forEach((entry, i) => {
      const recent = CAMPAIGN_LEVELS.slice(Math.max(0, i - 5), i).flatMap((e) => [e.start, e.destination]);
      if (recent.includes(entry.start) || recent.includes(entry.destination)) reused++;
    });
    expect(reused / CAMPAIGN_LENGTH).toBeLessThan(0.1);
  });

  it('sends the player to the Americas, not only across Afro-Eurasia', () => {
    // Left to itself the generator put 2.8% of levels there. The region has
    // only 196 routes in all, so a full 15% is out of reach -- but it should
    // not fall back to a token handful either.
    const americas = new Set(distancesFrom('US').keys());
    const there = CAMPAIGN_LEVELS.filter((e) => americas.has(e.start)).length;
    expect(there / CAMPAIGN_LENGTH).toBeGreaterThan(0.05);
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
