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

/**
 * Countries eligible to be a start or destination: sovereign, on the land
 * graph and not tiny. Territories are places to pass through, never a goal.
 */
export const ENDPOINT_CANDIDATES: readonly Country[] = COUNTRIES.filter(
  (c) => !c.territory && c.neighbours.length > 0 && c.area >= MIN_ENDPOINT_AREA
);

/**
 * Flight mode opens up every island that a sea crossing can reach, so its
 * pool is wider than the land one.
 */
export const FLIGHT_ENDPOINT_CANDIDATES: readonly Country[] = COUNTRIES.filter(
  (c) => !c.territory && (c.neighbours.length > 0 || c.crossings.length > 0) && c.area >= MIN_ENDPOINT_AREA
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
  if (options.mode === 'visa') return generateVisaGame(options);
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

/**
 * Visa Denied: how many borders are closed, and how far apart start and
 * destination are before they close. The detours add the rest, so the moves
 * a player sees are a few more than the band.
 */
export const VISA_RULES: Record<Difficulty, { closed: number; moves: [number, number] }> = {
  easy: { closed: 1, moves: [3, 4] },
  medium: { closed: 2, moves: [4, 6] },
  hard: { closed: 3, moves: [5, 7] },
};
/** The longest a Visa Denied route may grow to once its borders are closed. */
const VISA_MAX_MOVES = 14;

/**
 * A Visa Denied game: a land journey with some borders on the way closed.
 *
 * Each closed country lies on a shortest route that is still open, and
 * closing it must make the journey longer -- a closure nobody would have
 * walked through is no obstacle. Countries with many borders are likelier to
 * be closed, because they are the shortcuts: from Europe to Asia nearly
 * everything runs through Russia or China. A closure that leaves no way
 * through at all (Mongolia and both Koreas, with those two closed) is never
 * chosen, and the start, the destination and territories are never closed.
 */
function generateVisaGame(options: GenerateOptions): GameConfig {
  const seed = options.seed ?? `${Date.now()}:${Math.random()}`;
  const rand = seededRandom(`visa:${seed}`);
  const difficulty = options.difficulty ?? pickDifficulty(rand);
  const { closed: wanted, moves: [minMoves, maxMoves] } = VISA_RULES[difficulty];

  for (let attempt = 0; attempt < 300; attempt++) {
    const start = weightedPick(ENDPOINT_CANDIDATES, ENDPOINT_WEIGHTS, rand);
    const reachable = [...distancesFrom(start.iso2)].filter(
      ([iso, d]) => d >= minMoves && d <= maxMoves && WEIGHT_BY_CODE.has(iso)
    );
    if (reachable.length === 0) continue;
    const destination = weightedPick(
      reachable.map(([iso]) => iso),
      reachable.map(([iso]) => WEIGHT_BY_CODE.get(iso)!),
      rand
    );

    const closed = closeBorders(start.iso2, destination, wanted, rand);
    if (!closed) continue;

    return {
      mode: 'visa',
      start: start.iso2,
      destination,
      optimalMoves: shortestMoveCount(start.iso2, destination, false, closed)!,
      difficulty,
      closed: [...closed],
    };
  }
  throw new Error('No Visa Denied game could be generated');
}

/**
 * Closes `wanted` borders between `start` and `destination`, one at a time,
 * each on a shortest route that is still open and each making the journey
 * longer, without ever cutting it off or stretching it past
 * VISA_MAX_MOVES. Which one is closed is a weighted draw: by default the
 * countries with the most borders, since they are the shortcuts. Null if
 * fewer than `wanted` could be closed.
 */
export function closeBorders(
  start: string,
  destination: string,
  wanted: number,
  rand: () => number,
  weight: (country: Country) => number = (country) => country.neighbours.length ** 1.5
): Set<string> | null {
  const closed = new Set<string>();
  while (closed.size < wanted) {
    const fromStart = distancesFrom(start, false, closed);
    const fromEnd = distancesFrom(destination, false, closed);
    const now = fromStart.get(destination)!;
    // Everywhere on some shortest route that is still open.
    const options: { iso: string; detour: number }[] = [];
    for (const [iso, d] of fromStart) {
      if (iso === start || iso === destination || d + (fromEnd.get(iso) ?? Infinity) !== now) continue;
      if (COUNTRIES_BY_CODE.get(iso)?.territory) continue;
      const after = shortestMoveCount(start, destination, false, new Set([...closed, iso]));
      if (after !== null && after > now && after <= VISA_MAX_MOVES) options.push({ iso, detour: after });
    }
    if (options.length === 0) return null;
    const pick = weightedPick(
      options,
      options.map(({ iso }) => weight(COUNTRIES_BY_CODE.get(iso)!)),
      rand
    );
    closed.add(pick.iso);
  }
  return closed;
}

const COUNTRIES_BY_CODE = new Map(COUNTRIES.map((c) => [c.iso2, c]));

/** Rebuilds a config's optimal move count from the graph. Used by tests. */
export function verifyConfig(config: GameConfig): boolean {
  return (
    shortestMoveCount(config.start, config.destination, config.mode === 'flight', new Set(config.closed ?? [])) ===
    config.optimalMoves
  );
}
