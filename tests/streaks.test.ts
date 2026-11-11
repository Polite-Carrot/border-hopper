import { describe, expect, it } from 'vitest';
import { EMPTY_STATS, recordGameCompleted, type Stats } from '../src/core/stats';
import { STREAK_BADGES, newStreakBadges, streakBadgeEarned } from '../src/core/streaks';
import { dateKey } from '../src/core/daily';
import type { GameResult } from '../src/core/types';

const daily = (key: string): GameResult => ({
  mode: 'daily', dailyKey: key, difficulty: 'easy', route: ['FR', 'ES'], moves: 1, wrongGuesses: 0,
  seconds: 20, optimalMoves: 1, optimal: true,
});
/** Plays the daily on `days` days in a row from 1 March 2026. */
const playRun = (days: number, from: Stats = EMPTY_STATS) => {
  let stats = from;
  const earned: number[][] = [];
  for (let i = 0; i < days; i++) {
    const next = recordGameCompleted(stats, daily(dateKey(new Date(2026, 2, 1 + i))));
    earned.push(newStreakBadges(stats, next).map((b) => b.days));
    stats = next;
  }
  return { stats, earned };
};

describe('daily streak badges', () => {
  it('are for 7, 30 and 100 days in a row', () => {
    expect(STREAK_BADGES.map((b) => b.days)).toEqual([7, 30, 100]);
  });

  it('are earned the day the streak reaches them, once, with that date', () => {
    const { stats, earned } = playRun(100);
    expect(earned.flatMap((days, i) => days.map((d) => [d, i + 1]))).toEqual([[7, 7], [30, 30], [100, 100]]);
    expect(stats.streakBadges).toEqual({ 7: '2026-03-07', 30: '2026-03-30', 100: '2026-06-08' });
  });

  it('are kept when the streak breaks, and not earned twice', () => {
    let { stats } = playRun(8);
    // A missed day: the streak starts again.
    stats = recordGameCompleted(stats, daily('2026-03-20'));
    expect(stats.dailyStreak).toBe(1);
    expect(streakBadgeEarned(stats, 7)).toBe('2026-03-07');
    let again = stats;
    for (let i = 0; i < 7; i++) {
      const next = recordGameCompleted(again, daily(dateKey(new Date(2026, 2, 21 + i))));
      expect(newStreakBadges(again, next)).toEqual([]);
      again = next;
    }
  });

  it('count a streak reached before badges existed', () => {
    const veteran = { ...EMPTY_STATS, longestDailyStreak: 31 };
    expect(streakBadgeEarned(veteran, 7)).toBe('earned');
    expect(streakBadgeEarned(veteran, 30)).toBe('earned');
    expect(streakBadgeEarned(veteran, 100)).toBeUndefined();
  });

  it('come only from the daily', () => {
    const random = { ...daily('2026-03-01'), mode: 'classic' as const, dailyKey: undefined };
    let stats = EMPTY_STATS;
    for (let i = 0; i < 10; i++) stats = recordGameCompleted(stats, random);
    expect(stats.streakBadges).toBeUndefined();
  });
});
