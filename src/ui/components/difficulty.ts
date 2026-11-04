import { DIFFICULTY_MOVES, FLIGHT_DIFFICULTY_MOVES, VISA_RULES } from '../../core/generate';
import type { GameMode } from '../../core/types';
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
 * Those bands are also why this takes the mode: hub flights reshape the
 * distances, so a hard flight is six to eight moves where a hard walk is five
 * to seven.
 */
export function difficultyOptions(mode: GameMode = 'classic'): DifficultyOption[] {
  // Visa Denied is measured in closed borders: the detours set the moves.
  if (mode === 'visa') {
    const closed = (n: number) => (n === 1 ? '1 closed border' : `${n} closed borders`);
    return [
      { value: 'mixed', label: 'Mixed', hint: 'A bit of everything' },
      { value: 'easy', label: 'Easy', hint: closed(VISA_RULES.easy.closed) },
      { value: 'medium', label: 'Medium', hint: closed(VISA_RULES.medium.closed) },
      { value: 'hard', label: 'Hard', hint: closed(VISA_RULES.hard.closed) },
    ];
  }
  const moves = mode === 'flight' ? FLIGHT_DIFFICULTY_MOVES : DIFFICULTY_MOVES;
  return [
    { value: 'mixed', label: 'Mixed', hint: 'A bit of everything' },
    { value: 'easy', label: 'Easy', hint: band(moves.easy) },
    { value: 'medium', label: 'Medium', hint: band(moves.medium) },
    { value: 'hard', label: 'Hard', hint: band(moves.hard) },
  ];
}
