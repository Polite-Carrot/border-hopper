import { describe, expect, it, vi } from 'vitest';
import {
  EMPTY_TOURS, TOURS, badgeCount, isTourLevelUnlocked, recordTourLevel, tourById, tourGame, tourNextLevel,
} from '../src/core/tours';
import { shortestMoveCount } from '../src/core/graph';
import { getCountry } from '../src/core/world';
import { shareText } from '../src/core/share';
import type { GameResult } from '../src/core/types';

const result = (tour: string, level: number, over: Partial<GameResult> = {}): GameResult => {
  const config = tourGame(tour, level);
  return {
    mode: 'tour',
    tour,
    level,
    difficulty: config.difficulty,
    route: [config.start, config.destination],
    moves: config.optimalMoves,
    wrongGuesses: 0,
    seconds: 40,
    optimalMoves: config.optimalMoves,
    optimal: true,
    ...over,
  };
};

describe('continent tours', () => {
  it('are the five tours, each with a name, a blurb and an emblem', () => {
    expect(TOURS.map((t) => [t.id, t.levels.length])).toEqual([
      ['europe', 30], ['africa', 30], ['asia', 30], ['americas', 25], ['silk-road', 20],
    ]);
    for (const tour of TOURS) {
      expect(tour.name).toBeTruthy();
      expect(tour.blurb).toBeTruthy();
      expect(tour.emoji).toBeTruthy();
    }
  });

  it('stay in their part of the world, with every level solvable and scored right', () => {
    const regions: Record<string, [string[], string[]]> = {
      europe: [['Europe'], ['Europe']],
      africa: [['Africa'], ['Africa']],
      asia: [['Asia'], ['Asia']],
      americas: [['North America', 'South America'], ['North America', 'South America']],
      'silk-road': [['Europe'], ['Asia']],
    };
    for (const tour of TOURS) {
      const [starts, ends] = regions[tour.id];
      const pairs = new Set<string>();
      tour.levels.forEach((level, i) => {
        expect(level.level).toBe(i + 1);
        const start = getCountry(level.start)!;
        const end = getCountry(level.destination)!;
        expect(starts, `${tour.id} ${level.level} start`).toContain(start.continent);
        expect(ends, `${tour.id} ${level.level} end`).toContain(end.continent);
        expect(start.territory || end.territory).toBeFalsy();
        expect(shortestMoveCount(level.start, level.destination), `${tour.id} ${level.level}`).toBe(level.moves);
        pairs.add([level.start, level.destination].sort().join('-'));
      });
      expect(pairs.size, `${tour.id} repeats a pair`).toBe(tour.levels.length);
    }
  });

  it('open somewhere everyone knows and climb from there', () => {
    expect(TOURS.map((t) => [t.levels[0].start, t.levels[0].destination])).toEqual([
      ['ES', 'IT'], ['ZA', 'ZM'], ['IN', 'TH'], ['US', 'GT'], ['GR', 'IR'],
    ]);
    for (const tour of TOURS) {
      const moves = tour.levels.map((l) => l.moves);
      expect(moves[0]).toBe(2);
      for (let i = 1; i < moves.length; i++) expect(moves[i], `${tour.id} ${i + 1}`).toBeGreaterThanOrEqual(moves[i - 1] - 1);
      expect(moves[moves.length - 1]).toBeGreaterThanOrEqual(7);
    }
  });

  it('open their levels one at a time', () => {
    expect(isTourLevelUnlocked(EMPTY_TOURS, 'africa', 1)).toBe(true);
    expect(isTourLevelUnlocked(EMPTY_TOURS, 'africa', 2)).toBe(false);
    const after = recordTourLevel(EMPTY_TOURS, result('africa', 1));
    expect(isTourLevelUnlocked(after, 'africa', 2)).toBe(true);
    expect(tourNextLevel(after, 'africa')).toBe(2);
    expect(tourNextLevel(after, 'europe')).toBe(1);
  });

  it('award the badge once, on the day the last level is done', () => {
    let progress = EMPTY_TOURS;
    const tour = tourById('silk-road')!;
    for (let level = 1; level < tour.levels.length; level++) {
      progress = recordTourLevel(progress, result('silk-road', level), '2026-11-01');
    }
    expect(progress.badges['silk-road']).toBeUndefined();
    progress = recordTourLevel(progress, result('silk-road', tour.levels.length), '2026-11-08');
    expect(progress.badges['silk-road']).toBe('2026-11-08');
    expect(badgeCount(progress)).toBe(1);
    expect(tourNextLevel(progress, 'silk-road')).toBeNull();
    // Replaying keeps the day it was first won.
    progress = recordTourLevel(progress, result('silk-road', 3, { seconds: 5 }), '2026-12-25');
    expect(progress.badges['silk-road']).toBe('2026-11-08');
    expect(progress.levels['silk-road'][3].seconds).toBe(5);
  });

  it('keep the better attempt, and a star once earned', () => {
    let progress = recordTourLevel(EMPTY_TOURS, result('asia', 1));
    progress = recordTourLevel(progress, result('asia', 1, { seconds: 10, hints: 1, optimal: false }));
    expect(progress.levels.asia[1]).toEqual({ moves: 2, seconds: 10, optimal: true });
    const worse = recordTourLevel(progress, result('asia', 1, { moves: 5, seconds: 2, optimal: false }));
    expect(worse).toBe(progress);
  });

  it('ignore other modes', () => {
    expect(recordTourLevel(EMPTY_TOURS, { ...result('asia', 1), mode: 'campaign', tour: undefined })).toBe(EMPTY_TOURS);
  });

  it('share without the route, like the campaign', () => {
    const text = shareText(result('europe', 4, { route: ['ES', 'FR', 'DE', 'PL'], moves: 3, optimalMoves: 3 }));
    expect(text).toContain('BORDER HOPPER — Europe, level 4');
    expect(text).toContain('🇪🇸 ➜ 🇵🇱');
    expect(text).not.toContain('🇫🇷');
  });

  it('are wiped by Reset all progress', async () => {
    const removed: string[] = [];
    vi.doMock('../src/storage/backend', () => ({
      store: () => ({
        getItem: async () => null,
        setItem: async () => {},
        multiRemove: async (keys: readonly string[]) => void removed.push(...keys),
      }),
    }));
    const { resetEverything } = await import('../src/storage/storage');
    await resetEverything();
    expect(removed).toContain('borderbound:tours:v1');
    vi.doUnmock('../src/storage/backend');
  });
});
