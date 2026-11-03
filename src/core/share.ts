import { distancesFrom } from './graph';
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
 * One square per move: 🟩 where it brought the destination a move closer,
 * 🟨 where it did not. Says how a route went without saying where it went.
 */
export function moveSquares(result: Pick<GameResult, 'mode' | 'route'>): string {
  const end = result.route[result.route.length - 1];
  // Distances are symmetric, so one search from the end measures every step.
  const toGo = distancesFrom(end, result.mode === 'flight');
  let squares = '';
  for (let i = 1; i < result.route.length; i++) {
    const before = toGo.get(result.route[i - 1]);
    const after = toGo.get(result.route[i]);
    squares += before !== undefined && after === before - 1 ? '🟩' : '🟨';
  }
  return squares;
}

/**
 * Result text for sharing.
 *
 * The daily and the campaign levels are the same puzzle for everyone, so
 * their results never show the route: a friend who has not played yet would
 * be reading the answer. They get the start, the destination and a square per
 * move instead. A random game is nobody else's puzzle, so it shows the route
 * as flags -- which name no countries either.
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
  const shared = result.mode === 'daily' || result.mode === 'campaign';
  const start = result.route[0];
  const end = result.route[result.route.length - 1];
  const lines = shared
    ? [header, `${countryFlag(start)} ➜ ${countryFlag(end)}`, moveSquares(result)]
    : [header, result.route.map(countryFlag).join(' → ')];
  lines.push('', `${pluralise(result.moves, 'move')} · ${formatDuration(result.seconds)}`);
  const extras: string[] = [];
  if (result.wrongGuesses > 0) extras.push(pluralise(result.wrongGuesses, 'wrong turn'));
  if (result.hints) extras.push(`💡 ${pluralise(result.hints, 'hint')}`);
  if (extras.length) lines.push(extras.join(' · '));
  if (result.optimal) lines.push('⭐ Perfect route');
  else lines.push(`Best possible: ${pluralise(result.optimalMoves, 'move')}`);
  lines.push('', GAME_URL);
  return lines.join('\n');
}
