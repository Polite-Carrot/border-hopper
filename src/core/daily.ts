import { generateGame } from './generate';
import { seededRandom, weightedPick } from './random';
import type { Difficulty, GameConfig } from './types';

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
 * The challenge for a given day. Purely a function of the date, so every
 * player on every device gets the same start and destination with no backend.
 */
export function dailyGame(key: string = dateKey()): GameConfig {
  const seed = `${SEED_NAMESPACE}:${key}`;
  const difficulty = weightedPick(
    DAILY_DIFFICULTIES.map(([d]) => d),
    DAILY_DIFFICULTIES.map(([, w]) => w),
    seededRandom(`${seed}:difficulty`)
  );
  return generateGame({ mode: 'daily', difficulty, seed, dailyKey: key });
}
