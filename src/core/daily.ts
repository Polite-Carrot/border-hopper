import { generateGame } from './generate';
import { seededRandom, weightedPick } from './random';
import type { Difficulty, GameConfig } from './types';

/**
 * The daily challenge is seeded from this string, so changing it would
 * re-roll every date's start and destination -- including days people have
 * already played. It keeps the game's original name deliberately.
 */
const SEED_NAMESPACE = 'borderbound-daily';

/** Local calendar date as "YYYY-MM-DD". The daily challenge rolls over at local midnight. */
export function dateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The previous calendar day's key, used for daily streak continuity. */
export function previousDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d - 1);
  return dateKey(date);
}

const DAILY_DIFFICULTIES: [Difficulty, number][] = [
  ['easy', 0.2],
  ['medium', 0.5],
  ['hard', 0.3],
];

/**
 * The first Visa Denied daily. From this day on, every other daily closes
 * some borders on the way; the days between are ordinary land journeys.
 * Days before it keep exactly the puzzles they always had -- people have
 * played them, and their results and streaks point at them.
 */
export const VISA_DAILY_FROM = '2026-11-12';

const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** Whether a day's challenge is a Visa Denied one. */
export function isVisaDaily(key: string): boolean {
  // "YYYY-MM-DD" keys sort as dates do.
  if (key < VISA_DAILY_FROM) return false;
  return (dayNumber(key) - dayNumber(VISA_DAILY_FROM)) % 2 === 0;
}

/**
 * The challenge for a given day. Purely a function of the date, so every
 * player on every device gets the same start and destination with no backend.
 * Every other day from VISA_DAILY_FROM it is a Visa Denied journey: still the
 * daily in every other way -- one a day, the streak, the share -- with some
 * borders closed.
 */
export function dailyGame(key: string = dateKey()): GameConfig {
  const seed = `${SEED_NAMESPACE}:${key}`;
  const difficulty = weightedPick(
    DAILY_DIFFICULTIES.map(([d]) => d),
    DAILY_DIFFICULTIES.map(([, w]) => w),
    seededRandom(`${seed}:difficulty`)
  );
  if (isVisaDaily(key)) {
    return { ...generateGame({ mode: 'visa', difficulty, seed }), mode: 'daily', dailyKey: key };
  }
  return generateGame({ mode: 'daily', difficulty, seed, dailyKey: key });
}
