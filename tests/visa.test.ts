import { describe, expect, it } from 'vitest';
import { VISA_RULES, generateGame, verifyConfig } from '../src/core/generate';
import { applyMove, bestRoute, closedSet, createGame, nextStep, toResult } from '../src/core/game';
import { areNeighbours, shortestMoveCount } from '../src/core/graph';
import { getCountry } from '../src/core/world';
import { shareText } from '../src/core/share';
import type { GameConfig, GameState } from '../src/core/types';

const visa = (start: string, destination: string, closed: string[]): GameConfig => ({
  mode: 'visa',
  start,
  destination,
  closed,
  optimalMoves: shortestMoveCount(start, destination, false, new Set(closed))!,
  difficulty: 'medium',
});

function move(state: GameState, iso: string): GameState {
  const result = applyMove(state, iso);
  if (!result.ok) throw new Error(result.message);
  return result.state;
}

describe('Visa Denied', () => {
  it('closes one, two or three borders by difficulty, always with a way through', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (let i = 0; i < 80; i++) {
        const game = generateGame({ mode: 'visa', difficulty, seed: `visa-${difficulty}-${i}` });
        const closed = game.closed!;
        expect(game.mode).toBe('visa');
        expect(closed).toHaveLength(VISA_RULES[difficulty].closed);
        expect(new Set(closed).size).toBe(closed.length);
        expect(closed).not.toContain(game.start);
        expect(closed).not.toContain(game.destination);
        for (const iso of closed) expect(getCountry(iso)?.territory, iso).toBeUndefined();
        expect(verifyConfig(game), `${game.start}-${game.destination}`).toBe(true);
        // The closures are obstacles: the open route was shorter.
        expect(game.optimalMoves).toBeGreaterThan(shortestMoveCount(game.start, game.destination)!);
        expect(game.optimalMoves).toBeLessThanOrEqual(14);
      }
    }
  });

  it('closes the big shortcuts most often', () => {
    const count = new Map<string, number>();
    for (let i = 0; i < 400; i++) {
      for (const iso of generateGame({ mode: 'visa', seed: `often-${i}` }).closed!) {
        count.set(iso, (count.get(iso) ?? 0) + 1);
      }
    }
    const top = [...count].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([iso]) => iso);
    expect(top).toContain('RU');
    expect(top).toContain('CN');
  });

  it('turns you back at a closed border, as a wrong turn', () => {
    const state = createGame(visa('PL', 'FR', ['DE']));
    const result = applyMove(state, 'DE');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('closed');
      expect(result.message).toBe("Visa denied! Germany won't let you in.");
    }
    // Not a border at all still says so: closing a country does not make it a neighbour.
    const far = applyMove(createGame(visa('PL', 'FR', ['ES'])), 'ES');
    expect(!far.ok && far.reason).toBe('not-adjacent');
  });

  it('gives hints, and a best route, that go round', () => {
    const config = visa('PL', 'FR', ['DE']);
    let state = createGame(config);
    while (state.status === 'playing') {
      const step = nextStep(state)!;
      expect(closedSet(config).has(step)).toBe(false);
      state = move(state, step);
    }
    expect(state.route.length - 1).toBe(config.optimalMoves);
    const best = bestRoute(toResult(state))!;
    expect(best).not.toContain('DE');
    expect(best.length - 1).toBe(config.optimalMoves);
    for (let i = 0; i < best.length - 1; i++) expect(areNeighbours(best[i], best[i + 1])).toBe(true);
  });

  it('shares which borders were closed', () => {
    let state = createGame(visa('PL', 'FR', ['DE']));
    for (const iso of bestRoute({ mode: 'visa', route: ['PL', 'FR'], closed: ['DE'] })!.slice(1)) state = move(state, iso);
    const text = shareText(toResult(state));
    expect(text).toContain('BORDER HOPPER — Visa Denied');
    expect(text).toContain('⛔ 🇩🇪 closed');
  });
});
