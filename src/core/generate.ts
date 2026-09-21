import { COUNTRIES } from './world';
import { distancesFrom, shortestMoveCount } from './graph';
import { seededRandom, weightedPick } from './random';
import type { Country, Difficulty, GameConfig, GameMode } from './types';

/**
 * Moves between start and destination for each difficulty band.
 *
 * Easy is pinned to exactly 2 so a generated game never opens with the
 * destination already bordering the start, which would be over in one tap.
 */
export const DIFFICULTY_MOVES: Record<Difficulty, [number, number]> = {
  easy: [2, 2],
  medium: [3, 4],
  hard: [5, 7],
};

/** Classifies a route length into a difficulty band. */
export function difficultyFor(moves: number): Difficulty {
  if (moves <= 2) return 'easy';
  if (moves <= 4) return 'medium';
  return 'hard';
}

/**
 * Smallest area (x 10^4 steradians, roughly 1000 km²) a country needs to be
 * used as a start or destination. Microstates such as Monaco and San Marino
 * stay fully playable as moves, but make for frustrating objectives.
 */
const MIN_ENDPOINT_AREA = 0.25;

/** Countries eligible to be a start or destination: on the land graph and not tiny. */
export const ENDPOINT_CANDIDATES: readonly Country[] = COUNTRIES.filter(
  (c) => c.neighbours.length > 0 && c.area >= MIN_ENDPOINT_AREA
);

/** Larger countries come up more often, so objectives stay recognisable. */
const ENDPOINT_WEIGHTS = ENDPOINT_CANDIDATES.map((c) => Math.sqrt(c.area));
const WEIGHT_BY_CODE = new Map(ENDPOINT_CANDIDATES.map((c, i) => [c.iso2, ENDPOINT_WEIGHTS[i]]));

export interface GenerateOptions {
  mode?: GameMode;
  difficulty?: Difficulty;
  /** Deterministic seed. Omit for a random game. */
  seed?: string;
  dailyKey?: string;
}

const DIFFICULTY_WEIGHTS: [Difficulty, number][] = [
  ['easy', 0.25],
  ['medium', 0.5],
  ['hard', 0.25],
];

function pickDifficulty(rand: () => number): Difficulty {
  return weightedPick(
    DIFFICULTY_WEIGHTS.map(([d]) => d),
    DIFFICULTY_WEIGHTS.map(([, w]) => w),
    rand
  );
}

/**
 * Builds a game that is guaranteed to be solvable: the destination is chosen
 * from countries actually reachable from the start over land, at a distance
 * inside the requested difficulty band.
 */
export function generateGame(options: GenerateOptions = {}): GameConfig {
  const seed = options.seed ?? `${Date.now()}:${Math.random()}`;
  const rand = seededRandom(seed);
  const difficulty = options.difficulty ?? pickDifficulty(rand);
  const [minMoves, maxMoves] = DIFFICULTY_MOVES[difficulty];

  for (let attempt = 0; attempt < 200; attempt++) {
    const start = weightedPick(ENDPOINT_CANDIDATES, ENDPOINT_WEIGHTS, rand);
    const distances = distancesFrom(start.iso2);
    const reachable: string[] = [];
    const weights: number[] = [];
    for (const [iso, distance] of distances) {
      if (distance < minMoves || distance > maxMoves) continue;
      const weight = WEIGHT_BY_CODE.get(iso);
      if (weight === undefined) continue;
      reachable.push(iso);
      weights.push(weight);
    }
    if (reachable.length === 0) continue;
    const destination = weightedPick(reachable, weights, rand);
    return {
      mode: options.mode ?? 'classic',
      start: start.iso2,
      destination,
      optimalMoves: distances.get(destination)!,
      difficulty,
      dailyKey: options.dailyKey,
    };
  }

  // Every candidate start failed the band, which only happens if the graph is
  // broken. Fall back to any solvable pairing rather than returning nothing.
  const start = ENDPOINT_CANDIDATES[0];
  const fallback = [...distancesFrom(start.iso2)].find(([iso, d]) => d > 0 && WEIGHT_BY_CODE.has(iso));
  if (!fallback) throw new Error('No solvable game could be generated');
  return {
    mode: options.mode ?? 'classic',
    start: start.iso2,
    destination: fallback[0],
    optimalMoves: fallback[1],
    difficulty: difficultyFor(fallback[1]),
    dailyKey: options.dailyKey,
  };
}

/** Rebuilds a config's optimal move count from the graph. Used by tests. */
export function verifyConfig(config: GameConfig): boolean {
  return shortestMoveCount(config.start, config.destination) === config.optimalMoves;
}
