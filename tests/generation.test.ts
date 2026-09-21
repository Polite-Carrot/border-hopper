import { describe, expect, it } from 'vitest';
import { DIFFICULTY_MOVES, ENDPOINT_CANDIDATES, difficultyFor, generateGame, verifyConfig } from '../src/core/generate';
import { shortestMoveCount } from '../src/core/graph';
import { getCountry } from '../src/core/world';
import type { Difficulty } from '../src/core/types';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

describe('game generation', () => {
  it('classifies route lengths into difficulty bands', () => {
    expect(difficultyFor(1)).toBe('easy');
    expect(difficultyFor(2)).toBe('easy');
    expect(difficultyFor(3)).toBe('medium');
    expect(difficultyFor(4)).toBe('medium');
    expect(difficultyFor(5)).toBe('hard');
    expect(difficultyFor(9)).toBe('hard');
  });

  it('only offers sensible endpoints', () => {
    expect(ENDPOINT_CANDIDATES.length).toBeGreaterThan(110);
    for (const country of ENDPOINT_CANDIDATES) {
      expect(country.neighbours.length, country.name).toBeGreaterThan(0);
    }
    const codes = new Set(ENDPOINT_CANDIDATES.map((c) => c.iso2));
    // Microstates stay playable as moves but are never the objective.
    for (const iso of ['VA', 'MC', 'SM', 'LI', 'AD']) expect(codes.has(iso), iso).toBe(false);
    // Island nations have no land route at all.
    for (const iso of ['JP', 'IS', 'NZ']) expect(codes.has(iso), iso).toBe(false);
    for (const iso of ['FR', 'DE', 'BR', 'ZA', 'IN', 'LU']) expect(codes.has(iso), iso).toBe(true);
  });

  it('always produces a solvable game', () => {
    for (let i = 0; i < 300; i++) {
      const config = generateGame({ seed: `solvable-${i}` });
      expect(getCountry(config.start), config.start).toBeDefined();
      expect(getCountry(config.destination), config.destination).toBeDefined();
      expect(config.start).not.toBe(config.destination);
      const moves = shortestMoveCount(config.start, config.destination);
      expect(moves, `${config.start} -> ${config.destination}`).not.toBeNull();
      expect(config.optimalMoves).toBe(moves);
      expect(verifyConfig(config)).toBe(true);
    }
  });

  it('matches route length to the requested difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      const [min, max] = DIFFICULTY_MOVES[difficulty];
      for (let i = 0; i < 100; i++) {
        const config = generateGame({ difficulty, seed: `${difficulty}-${i}` });
        expect(config.difficulty).toBe(difficulty);
        expect(config.optimalMoves, `${difficulty} #${i}`).toBeGreaterThanOrEqual(min);
        expect(config.optimalMoves, `${difficulty} #${i}`).toBeLessThanOrEqual(max);
      }
    }
  });

  it('never starts the player next door to the destination', () => {
    for (let i = 0; i < 200; i++) {
      const config = generateGame({ seed: `nontrivial-${i}` });
      expect(config.optimalMoves).toBeGreaterThan(1);
    }
  });

  it('is deterministic for a given seed and varies across seeds', () => {
    const a = generateGame({ seed: 'fixed' });
    const b = generateGame({ seed: 'fixed' });
    expect(a).toEqual(b);
    const configs = new Set(
      Array.from({ length: 40 }, (_, i) => {
        const c = generateGame({ seed: `varied-${i}` });
        return `${c.start}>${c.destination}`;
      })
    );
    expect(configs.size).toBeGreaterThan(20);
  });

  it('produces a spread of difficulties when none is requested', () => {
    const seen = new Set(
      Array.from({ length: 100 }, (_, i) => generateGame({ seed: `mix-${i}` }).difficulty)
    );
    expect(seen).toEqual(new Set(DIFFICULTIES));
  });
});
