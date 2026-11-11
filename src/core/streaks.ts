import type { Stats } from './stats';

/** A badge for keeping up the daily challenge, drawn like a tour badge. */
export interface StreakBadge {
  days: number;
  name: string;
  emoji: string;
}

/** The daily streaks that earn a badge. */
export const STREAK_BADGES: readonly StreakBadge[] = [
  { days: 7, name: 'Week Wanderer', emoji: '🔥' },
  { days: 30, name: 'Monthly Nomad', emoji: '🧭' },
  { days: 100, name: 'Century Explorer', emoji: '🏆' },
];

/**
 * When a streak badge was earned: its date, "earned" for a player who reached
 * the streak before badges existed (their longest streak says so, but not
 * when), or undefined if it is still to win.
 */
export function streakBadgeEarned(stats: Stats, days: number): string | undefined {
  return stats.streakBadges?.[days] ?? (stats.longestDailyStreak >= days ? 'earned' : undefined);
}

/** Records every streak badge the current daily streak has reached, with today's date. */
export function awardStreakBadges(stats: Stats, today: string): Stats {
  let badges = stats.streakBadges;
  for (const { days } of STREAK_BADGES) {
    if (stats.dailyStreak >= days && !badges?.[days]) badges = { ...badges, [days]: today };
  }
  return badges === stats.streakBadges ? stats : { ...stats, streakBadges: badges };
}

/** Streak badges that `after` has and `before` did not: what a game just earned. */
export function newStreakBadges(before: Stats, after: Stats): StreakBadge[] {
  return STREAK_BADGES.filter(({ days }) => !before.streakBadges?.[days] && after.streakBadges?.[days]);
}
