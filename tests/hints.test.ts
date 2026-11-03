import { describe, expect, it } from 'vitest';
import { applyMove, bestRoute, createGame, nextStep, takeHint, toResult } from '../src/core/game';
import { canTravel, shortestMoveCount } from '../src/core/graph';
import { generateGame } from '../src/core/generate';
import type { GameConfig, GameState } from '../src/core/types';

const game = (start: string, destination: string, mode: GameConfig['mode'] = 'classic'): GameState =>
  createGame({
    mode,
    start,
    destination,
    optimalMoves: shortestMoveCount(start, destination, mode === 'flight')!,
    difficulty: 'medium',
  });

function move(state: GameState, iso: string): GameState {
  const result = applyMove(state, iso);
  if (!result.ok) throw new Error(result.message);
  return result.state;
}

describe('hints', () => {
  it('point one step along a shortest route, every time', () => {
    for (let i = 0; i < 60; i++) {
      for (const mode of ['classic', 'flight'] as const) {
        const config = generateGame({ mode, seed: `hint-${i}` });
        let state = createGame(config);
        // Following the hints all the way is itself a best route.
        while (state.status === 'playing') {
          const step = nextStep(state)!;
          expect(canTravel(state.route[state.route.length - 1], step, mode === 'flight')).toBe(true);
          state = move(state, step);
        }
        expect(state.route.length - 1, `${config.start}-${config.destination}`).toBe(config.optimalMoves);
      }
    }
  });

  it('outline first, then name, each counted once', () => {
    let state = game('FR', 'PT');
    state = takeHint(state);
    expect(state.hint).toEqual({ iso2: 'ES', named: false });
    expect(state.hints).toBe(1);
    state = takeHint(state);
    expect(state.hint).toEqual({ iso2: 'ES', named: true });
    expect(state.hints).toBe(2);
    // Nothing more to give for this position.
    expect(takeHint(state)).toBe(state);
  });

  it('are left behind on moving, and cost the perfect route', () => {
    let state = takeHint(game('FR', 'PT'));
    state = move(state, 'ES');
    expect(state.hint).toBeUndefined();
    state = move(state, 'PT');
    const result = toResult(state);
    expect(result.moves).toBe(result.optimalMoves);
    expect(result.hints).toBe(1);
    expect(result.optimal).toBe(false);
  });

  it('say when the next step is a flight', () => {
    const state = takeHint(game('GB', 'JP', 'flight'));
    expect(state.hint?.iso2).toBe('JP');
  });
});

describe('the best route on the result card', () => {
  it('runs from the start to the destination in the fewest moves', () => {
    const route = bestRoute({ mode: 'classic', route: ['FR', 'DE', 'FR', 'ES', 'PT'] })!;
    expect(route[0]).toBe('FR');
    expect(route[route.length - 1]).toBe('PT');
    expect(route.length - 1).toBe(2);
  });

  it('takes flights in flight mode', () => {
    expect(bestRoute({ mode: 'flight', route: ['GB', 'IS', 'GB', 'JP'] })).toEqual(['GB', 'JP']);
  });
});
