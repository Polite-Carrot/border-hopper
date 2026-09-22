import { countryFlag } from './world';
import { formatDuration, pluralise } from './format';
import type { GameResult } from './types';

/**
 * Where a shared result points. Kept in step with the repository's `CNAME`,
 * which is what GitHub Pages serves the game from -- there is a test that
 * fails if the two drift apart.
 *
 * The scheme is spelled out rather than left as a bare domain because a share
 * that does not linkify is a share that goes nowhere.
 */
export const GAME_URL = 'https://borderhopper.politecarrot.com';

/**
 * Result text for sharing. Flags alone give away nothing about the route to a
 * player who has not started the same challenge, but a finished daily is
 * shared with its route since everyone plays the same one.
 *
 * It ends with the link. A result posted into a group chat is the main way
 * anyone new finds the game, and without somewhere to go it is a dead end.
 */
export function shareText(result: GameResult): string {
  const header = result.dailyKey
    ? `🌍 BORDER HOPPER — ${result.dailyKey}`
    : result.mode === 'campaign' && result.level !== undefined
      ? `🌍 BORDER HOPPER — Level ${result.level}`
      : '🌍 BORDER HOPPER';
  const route = result.route.map(countryFlag).join(' → ');
  const lines = [
    header,
    route,
    '',
    `${pluralise(result.moves, 'move')} · ${formatDuration(result.seconds)}`,
  ];
  if (result.wrongGuesses > 0) lines.push(pluralise(result.wrongGuesses, 'wrong turn'));
  if (result.optimal) lines.push('⭐ Perfect route');
  else lines.push(`Best possible: ${pluralise(result.optimalMoves, 'move')}`);
  lines.push('', GAME_URL);
  return lines.join('\n');
}
