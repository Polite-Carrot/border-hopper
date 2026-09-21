import { countryFlag } from './world';
import { formatDuration, pluralise } from './format';
import type { GameResult } from './types';

/**
 * Result text for sharing. Flags alone give away nothing about the route to a
 * player who has not started the same challenge, but a finished daily is
 * shared with its route since everyone plays the same one.
 */
export function shareText(result: GameResult): string {
  const header = result.dailyKey ? `🌍 BORDERBOUND — ${result.dailyKey}` : '🌍 BORDERBOUND';
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
  return lines.join('\n');
}
