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

/**
 * Flight mode's own bands. Hub flights shorten long journeys, so the bands
 * sit a little below the land ones at the top; most hub routes are three to
 * five moves -- walk to a hub, fly, walk on.
 */
export const FLIGHT_DIFFICULTY_MOVES: Record<Difficulty, [number, number]> = {
  easy: [2, 3],
  medium: [4, 5],
  hard: [6, 8],
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

/**
 * Flight mode opens up every island that a sea crossing can reach, so its
 * pool is wider than the land one.
 */
export const FLIGHT_ENDPOINT_CANDIDATES: readonly Country[] = COUNTRIES.filter(
  (c) => (c.neighbours.length > 0 || c.crossings.length > 0) && c.area >= MIN_ENDPOINT_AREA
);

/** Larger countries come up more often, so objectives stay recognisable. */
const weightsFor = (pool: readonly Country[]) => pool.map((c) => Math.sqrt(c.area));
const ENDPOINT_WEIGHTS = weightsFor(ENDPOINT_CANDIDATES);
const FLIGHT_WEIGHTS = weightsFor(FLIGHT_ENDPOINT_CANDIDATES);
const WEIGHT_BY_CODE = new Map(ENDPOINT_CANDIDATES.map((c, i) => [c.iso2, ENDPOINT_WEIGHTS[i]]));
const FLIGHT_WEIGHT_BY_CODE = new Map(
  FLIGHT_ENDPOINT_CANDIDATES.map((c, i) => [c.iso2, FLIGHT_WEIGHTS[i]])
);

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
 * from countries actually reachable from the start (over land, or by land and
 * air in flight mode), at a distance inside the requested difficulty band.
 */
export function generateGame(options: GenerateOptions = {}): GameConfig {
  const seed = options.seed ?? `${Date.now()}:${Math.random()}`;
  const rand = seededRandom(seed);
  const difficulty = options.difficulty ?? pickDifficulty(rand);
  const mode = options.mode ?? 'classic';
  const flights = mode === 'flight';
  const [minMoves, maxMoves] = (flights ? FLIGHT_DIFFICULTY_MOVES : DIFFICULTY_MOVES)[difficulty];
  const pool = flights ? FLIGHT_ENDPOINT_CANDIDATES : ENDPOINT_CANDIDATES;
  const poolWeights = flights ? FLIGHT_WEIGHTS : ENDPOINT_WEIGHTS;
  const weightByCode = flights ? FLIGHT_WEIGHT_BY_CODE : WEIGHT_BY_CODE;

  for (let attempt = 0; attempt < 200; attempt++) {
    const start = weightedPick(pool, poolWeights, rand);
    const distances = distancesFrom(start.iso2, flights);
    // Flight mode only hands out journeys where every best route takes a
    // flight -- otherwise it is a land game with a departures board nobody
    // needs.
    const onFoot = flights ? distancesFrom(start.iso2, false) : null;
    const reachable: string[] = [];
    const weights: number[] = [];
    for (const [iso, distance] of distances) {
      if (distance < minMoves || distance > maxMoves) continue;
      if (onFoot && (onFoot.get(iso) ?? Infinity) <= distance) continue;
      const weight = weightByCode.get(iso);
      if (weight === undefined) continue;
      reachable.push(iso);
      weights.push(weight);
    }
    if (reachable.length === 0) continue;
    const destination = weightedPick(reachable, weights, rand);
    return {
      mode,
      start: start.iso2,
      destination,
      optimalMoves: distances.get(destination)!,
      difficulty,
      dailyKey: options.dailyKey,
    };
  }

  // Every candidate start failed the band, which only happens if the graph is
  // broken. Fall back to the furthest solvable pairing rather than returning
  // nothing -- furthest, so a broken band never hands out a one-move game.
  const start = pool[0];
  const fallback = [...distancesFrom(start.iso2, flights)]
    .filter(([iso, d]) => d > 0 && weightByCode.has(iso))
    .sort((a, b) => b[1] - a[1])[0];
  if (!fallback) throw new Error('No solvable game could be generated');
  return {
    mode,
    start: start.iso2,
    destination: fallback[0],
    optimalMoves: fallback[1],
    difficulty: difficultyFor(fallback[1]),
    dailyKey: options.dailyKey,
  };
}

/** Rebuilds a config's optimal move count from the graph. Used by tests. */
export function verifyConfig(config: GameConfig): boolean {
  return (
    shortestMoveCount(config.start, config.destination, config.mode === 'flight') === config.optimalMoves
  );
}
