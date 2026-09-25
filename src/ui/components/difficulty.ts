import { DIFFICULTY_MOVES, FLIGHT_DIFFICULTY_MOVES } from '../../core/generate';
import type { Settings } from '../../storage/storage';

const band = ([min, max]: readonly [number, number]) =>
  min === max ? `${min} moves` : `${min}–${max} moves`;

export interface DifficultyOption {
  value: Settings['difficulty'];
  label: string;
  hint: string;
}

/**
 * The difficulty choices, everywhere they are offered.
 *
 * The move counts are read off the generator's own bands rather than typed out
 * again, so a hint cannot quietly start lying about what the game will hand
 * you -- which is exactly what happened when flight mode got bands of its own.
 * Those bands are also why this takes the mode: long-haul routes shrink the
 * world, so a hard flight is four or five moves where a hard walk is seven.
 */
export function difficultyOptions(flights = false): DifficultyOption[] {
  const moves = flights ? FLIGHT_DIFFICULTY_MOVES : DIFFICULTY_MOVES;
  return [
    { value: 'mixed', label: 'Mixed', hint: 'A bit of everything' },
    { value: 'easy', label: 'Easy', hint: band(moves.easy) },
    { value: 'medium', label: 'Medium', hint: band(moves.medium) },
    { value: 'hard', label: 'Hard', hint: band(moves.hard) },
  ];
}

/** The land bands, for places that are not choosing a mode. */
export const DIFFICULTY_OPTIONS = difficultyOptions(false);
