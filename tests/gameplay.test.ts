import { describe, expect, it } from 'vitest';
import {
  applyMove, createGame, currentCountry, elapsedSeconds, moveCount, movesRemaining,
  recordWrongGuess, toResult,
} from '../src/core/game';
import type { GameConfig, GameState } from '../src/core/types';

const CONFIG: GameConfig = {
  mode: 'classic',
  start: 'FR',
  destination: 'PT',
  optimalMoves: 2,
  difficulty: 'easy',
};

const newGame = (at = 0): GameState => createGame(CONFIG, at);

/** Applies a move that is expected to succeed. */
function move(state: GameState, iso: string, at = 0): GameState {
  const result = applyMove(state, iso, at);
  if (!result.ok) throw new Error(`expected ${iso} to be a valid move: ${result.message}`);
  return result.state;
}

describe('gameplay', () => {
  it('starts in the start country with no moves made', () => {
    const state = newGame();
    expect(currentCountry(state)).toBe('FR');
    expect(state.route).toEqual(['FR']);
    expect(moveCount(state)).toBe(0);
    expect(state.wrongGuesses).toEqual([]);
    expect(state.status).toBe('playing');
  });

  it('moves the player to a bordering country', () => {
    const state = move(newGame(), 'ES');
    expect(currentCountry(state)).toBe('ES');
    expect(state.route).toEqual(['FR', 'ES']);
    expect(moveCount(state)).toBe(1);
    expect(state.status).toBe('playing');
  });

  it('refuses a country that does not border the current one', () => {
    const result = applyMove(newGame(), 'PT');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('not-adjacent');
    expect(result.message).toBe("Portugal doesn't border France.");
  });

  it('leaves the player where they were after an invalid move', () => {
    const state = newGame();
    const result = applyMove(state, 'PT');
    expect(result.ok).toBe(false);
    expect(currentCountry(state)).toBe('FR');
    expect(moveCount(state)).toBe(0);
    expect(state.route).toEqual(['FR']);
  });

  it('counts wrong guesses separately from moves', () => {
    let state = newGame();
    state = recordWrongGuess(state, 'PT');
    state = recordWrongGuess(state, 'MA');
    state = move(state, 'ES');
    expect(moveCount(state)).toBe(1);
    expect(state.wrongGuesses).toEqual(['PT', 'MA']);
    expect(toResult(state, 0).wrongGuesses).toBe(2);
  });

  it('rejects moving to the country you are already in', () => {
    const result = applyMove(newGame(), 'FR');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already-here');
  });

  it('rejects unknown country codes', () => {
    const result = applyMove(newGame(), 'XX');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown-country');
  });

  it('wins when the destination is reached', () => {
    const result = applyMove(move(newGame(), 'ES'), 'PT');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.won).toBe(true);
    expect(result.state.status).toBe('won');
    expect(result.state.route).toEqual(['FR', 'ES', 'PT']);
  });

  it('does not win on a country that is merely a neighbour', () => {
    const result = applyMove(newGame(), 'ES');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.won).toBe(false);
  });

  it('refuses further moves once won', () => {
    const won = move(move(newGame(), 'ES'), 'PT');
    const result = applyMove(won, 'ES');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('finished');
  });

  it('never mutates the state it was given', () => {
    const state = newGame();
    const snapshot = JSON.stringify(state);
    applyMove(state, 'ES');
    applyMove(state, 'PT');
    recordWrongGuess(state, 'PT');
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('stops the clock when the game is won', () => {
    let state = move(newGame(0), 'ES', 10_000);
    const result = applyMove(state, 'PT', 42_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(elapsedSeconds(result.state, 99_000)).toBe(42);
    expect(toResult(result.state).seconds).toBe(42);
  });

  it('summarises the finished game', () => {
    let state = newGame(0);
    state = recordWrongGuess(state, 'PT');
    state = move(state, 'ES', 5_000);
    const result = applyMove(state, 'PT', 30_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(toResult(result.state)).toEqual({
      mode: 'classic',
      dailyKey: undefined,
      difficulty: 'easy',
      route: ['FR', 'ES', 'PT'],
      moves: 2,
      wrongGuesses: 1,
      seconds: 30,
      optimalMoves: 2,
      optimal: true,
    });
  });

  it('marks a longer-than-optimal route as not optimal', () => {
    let state = move(newGame(), 'DE');
    state = move(state, 'FR');
    state = move(state, 'ES');
    const result = applyMove(state, 'PT');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const summary = toResult(result.state, 0);
    expect(summary.moves).toBe(4);
    expect(summary.optimal).toBe(false);
  });

  it('tracks how far the destination still is', () => {
    expect(movesRemaining(newGame())).toBe(2);
    expect(movesRemaining(move(newGame(), 'ES'))).toBe(1);
    expect(movesRemaining(move(newGame(), 'DE'))).toBe(3);
  });
});
