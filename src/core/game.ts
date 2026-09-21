import { areNeighbours, shortestMoveCount } from './graph';
import { getCountry, countryName } from './world';
import type { GameConfig, GameResult, GameState, MoveResult } from './types';

export function createGame(config: GameConfig, now: number = Date.now()): GameState {
  return {
    config,
    route: [config.start],
    wrongGuesses: [],
    status: 'playing',
    startedAt: now,
  };
}

export function currentCountry(state: GameState): string {
  return state.route[state.route.length - 1];
}

export function moveCount(state: GameState): number {
  return state.route.length - 1;
}

/**
 * Attempts to travel to `iso2`. Returns a new state on success and leaves the
 * old state untouched; a rejection carries a short message for the UI.
 *
 * Wrong guesses are recorded on the state so they can be counted separately
 * from moves, but never change where the player is.
 */
export function applyMove(state: GameState, iso2: string, now: number = Date.now()): MoveResult {
  if (state.status === 'won') {
    return { ok: false, reason: 'finished', message: 'You have already arrived.' };
  }
  const target = getCountry(iso2);
  if (!target) {
    return { ok: false, reason: 'unknown-country', message: 'Unknown country.' };
  }
  const from = currentCountry(state);
  if (iso2 === from) {
    return { ok: false, reason: 'already-here', message: `You are already in ${target.name}.` };
  }
  if (!areNeighbours(from, iso2)) {
    return {
      ok: false,
      reason: 'not-adjacent',
      message: `${target.name} doesn't border ${countryName(from)}.`,
    };
  }

  const won = iso2 === state.config.destination;
  return {
    ok: true,
    won,
    state: {
      ...state,
      route: [...state.route, iso2],
      status: won ? 'won' : 'playing',
      finishedAt: won ? now : undefined,
    },
  };
}

/** Records a rejected guess without moving the player. */
export function recordWrongGuess(state: GameState, iso2: string): GameState {
  return { ...state, wrongGuesses: [...state.wrongGuesses, iso2] };
}

export function elapsedSeconds(state: GameState, now: number = Date.now()): number {
  return Math.max(0, Math.round(((state.finishedAt ?? now) - state.startedAt) / 1000));
}

export function toResult(state: GameState, now: number = Date.now()): GameResult {
  const moves = moveCount(state);
  return {
    mode: state.config.mode,
    dailyKey: state.config.dailyKey,
    level: state.config.level,
    difficulty: state.config.difficulty,
    route: state.route,
    moves,
    wrongGuesses: state.wrongGuesses.length,
    seconds: elapsedSeconds(state, now),
    optimalMoves: state.config.optimalMoves,
    optimal: moves <= state.config.optimalMoves,
  };
}

/**
 * Fewest further moves from where the player stands. Reserved for the hint
 * system; never surfaced during normal play.
 */
export function movesRemaining(state: GameState): number | null {
  return shortestMoveCount(currentCountry(state), state.config.destination);
}
