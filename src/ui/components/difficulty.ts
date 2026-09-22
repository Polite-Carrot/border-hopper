import { DIFFICULTY_MOVES } from '../../core/generate';
import type { Settings } from '../../storage/storage';

const band = ([min, max]: readonly [number, number]) =>
  min === max ? `${min} moves` : `${min}–${max} moves`;

/**
 * The difficulty choices, everywhere they are offered.
 *
 * The move counts are read off the generator's own bands rather than typed out
 * again, so a hint cannot quietly start lying about what the game will hand
 * you -- which is exactly what happened when flight mode got bands of its own.
 */
export const DIFFICULTY_OPTIONS: {
  value: Settings['difficulty'];
  label: string;
  hint: string;
}[] = [
  { value: 'mixed', label: 'Mixed', hint: 'A bit of everything' },
  { value: 'easy', label: 'Easy', hint: band(DIFFICULTY_MOVES.easy) },
  { value: 'medium', label: 'Medium', hint: band(DIFFICULTY_MOVES.medium) },
  { value: 'hard', label: 'Hard', hint: band(DIFFICULTY_MOVES.hard) },
];
