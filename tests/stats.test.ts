import { describe, expect, it } from 'vitest';
import {
  EMPTY_STATS, deriveStats, recordGameAbandoned, recordGameCompleted, recordGameStarted,
} from '../src/core/stats';
import { shareText } from '../src/core/share';
import { formatDuration } from '../src/core/format';
import type { GameResult } from '../src/core/types';
import type { Stats as StatsType } from '../src/core/stats';

const result = (over: Partial<GameResult> = {}): GameResult => ({
  mode: 'classic',
  difficulty: 'easy',
  route: ['FR', 'ES', 'PT'],
  moves: 2,
  wrongGuesses: 1,
  seconds: 42,
  optimalMoves: 2,
  optimal: true,
  ...over,
});

const play = (stats: StatsType, over?: Partial<GameResult>) =>
  recordGameCompleted(recordGameStarted(stats), result(over));

describe('statistics', () => {
  it('starts empty', () => {
    expect(EMPTY_STATS.gamesPlayed).toBe(0);
    expect(deriveStats(EMPTY_STATS)).toEqual({
      completionPercent: 0,
      averageMoves: null,
      averageSeconds: null,
      optimalPercent: 0,
    });
  });

  it('counts a played and completed game', () => {
    const stats = play(EMPTY_STATS);
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.gamesCompleted).toBe(1);
    expect(stats.totalMoves).toBe(2);
    expect(stats.totalWrongGuesses).toBe(1);
    expect(stats.bestSeconds).toBe(42);
    expect(stats.optimalCompletions).toBe(1);
    expect(deriveStats(stats).completionPercent).toBe(100);
  });

  it('tracks abandoned games as played but not completed', () => {
    const stats = recordGameAbandoned(recordGameStarted(play(EMPTY_STATS)));
    expect(stats.gamesPlayed).toBe(2);
    expect(stats.gamesCompleted).toBe(1);
    expect(stats.currentStreak).toBe(0);
    expect(deriveStats(stats).completionPercent).toBe(50);
  });

  it('builds and breaks streaks', () => {
    let stats = play(play(play(EMPTY_STATS)));
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
    stats = recordGameAbandoned(recordGameStarted(stats));
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(3);
    stats = play(stats);
    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(3);
  });

  it('keeps the best and average times', () => {
    let stats = play(EMPTY_STATS, { seconds: 60 });
    stats = play(stats, { seconds: 20 });
    stats = play(stats, { seconds: 40 });
    expect(stats.bestSeconds).toBe(20);
    expect(deriveStats(stats).averageSeconds).toBe(40);
    expect(deriveStats(stats).averageMoves).toBe(2);
  });

  it('counts optimal completions', () => {
    let stats = play(EMPTY_STATS, { optimal: true });
    stats = play(stats, { optimal: false, moves: 5 });
    expect(stats.optimalCompletions).toBe(1);
    expect(deriveStats(stats).optimalPercent).toBe(50);
  });

  it('extends the daily streak on consecutive days only', () => {
    let stats = play(EMPTY_STATS, { mode: 'daily', dailyKey: '2026-09-20' });
    expect(stats.dailyStreak).toBe(1);
    stats = play(stats, { mode: 'daily', dailyKey: '2026-09-21' });
    expect(stats.dailyStreak).toBe(2);
    stats = play(stats, { mode: 'daily', dailyKey: '2026-09-25' });
    expect(stats.dailyStreak).toBe(1);
    expect(stats.longestDailyStreak).toBe(2);
  });

  it('does not double-count the same daily', () => {
    let stats = play(EMPTY_STATS, { mode: 'daily', dailyKey: '2026-09-21' });
    stats = play(stats, { mode: 'daily', dailyKey: '2026-09-21' });
    expect(stats.dailyStreak).toBe(1);
  });
});

describe('formatting and sharing', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(42)).toBe('00:42');
    expect(formatDuration(75)).toBe('01:15');
    expect(formatDuration(3675)).toBe('1:01:15');
  });

  it('builds a share card without naming the countries', () => {
    const text = shareText(result());
    expect(text).toContain('BORDER HOPPER');
    expect(text).toContain('🇫🇷 → 🇪🇸 → 🇵🇹');
    expect(text).toContain('2 moves');
    expect(text).toContain('00:42');
    expect(text).toContain('⭐ Perfect route');
    expect(text).not.toMatch(/France|Spain|Portugal/);
  });

  it('names the day for a daily result', () => {
    expect(shareText(result({ mode: 'daily', dailyKey: '2026-09-21' }))).toContain('2026-09-21');
  });

  it('shows the target when the route was not optimal', () => {
    const text = shareText(result({ optimal: false, moves: 4 }));
    expect(text).toContain('Best possible: 2 moves');
    expect(text).not.toContain('Perfect route');
  });
});
