import { previousDateKey } from './daily';
import type { GameResult } from './types';

/** Everything persisted about a player's history. Plain data, stored as JSON. */
export interface Stats {
  gamesPlayed: number;
  gamesCompleted: number;
  currentStreak: number;
  longestStreak: number;
  totalMoves: number;
  totalWrongGuesses: number;
  totalSeconds: number;
  bestSeconds: number | null;
  optimalCompletions: number;
  dailyStreak: number;
  longestDailyStreak: number;
  lastDailyKey: string | null;
}

export const EMPTY_STATS: Stats = {
  gamesPlayed: 0,
  gamesCompleted: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalMoves: 0,
  totalWrongGuesses: 0,
  totalSeconds: 0,
  bestSeconds: null,
  optimalCompletions: 0,
  dailyStreak: 0,
  longestDailyStreak: 0,
  lastDailyKey: null,
};

export function recordGameStarted(stats: Stats): Stats {
  return { ...stats, gamesPlayed: stats.gamesPlayed + 1 };
}

/** Quitting before arriving breaks the streak but is already counted as played. */
export function recordGameAbandoned(stats: Stats): Stats {
  return { ...stats, currentStreak: 0 };
}

export function recordGameCompleted(stats: Stats, result: GameResult): Stats {
  const currentStreak = stats.currentStreak + 1;
  const next: Stats = {
    ...stats,
    gamesCompleted: stats.gamesCompleted + 1,
    currentStreak,
    longestStreak: Math.max(stats.longestStreak, currentStreak),
    totalMoves: stats.totalMoves + result.moves,
    totalWrongGuesses: stats.totalWrongGuesses + result.wrongGuesses,
    totalSeconds: stats.totalSeconds + result.seconds,
    bestSeconds: stats.bestSeconds === null ? result.seconds : Math.min(stats.bestSeconds, result.seconds),
    optimalCompletions: stats.optimalCompletions + (result.optimal ? 1 : 0),
  };

  if (result.mode === 'daily' && result.dailyKey && result.dailyKey !== stats.lastDailyKey) {
    const continuing = stats.lastDailyKey === previousDateKey(result.dailyKey);
    next.dailyStreak = continuing ? stats.dailyStreak + 1 : 1;
    next.longestDailyStreak = Math.max(stats.longestDailyStreak, next.dailyStreak);
    next.lastDailyKey = result.dailyKey;
  }

  return next;
}

export interface DerivedStats {
  completionPercent: number;
  averageMoves: number | null;
  averageSeconds: number | null;
  optimalPercent: number;
}

export function deriveStats(stats: Stats): DerivedStats {
  const completed = stats.gamesCompleted;
  return {
    completionPercent: stats.gamesPlayed === 0 ? 0 : Math.round((completed / stats.gamesPlayed) * 100),
    averageMoves: completed === 0 ? null : stats.totalMoves / completed,
    averageSeconds: completed === 0 ? null : Math.round(stats.totalSeconds / completed),
    optimalPercent: completed === 0 ? 0 : Math.round((stats.optimalCompletions / completed) * 100),
  };
}
