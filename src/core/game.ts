import { areNeighbours, canTravel, distancesFrom, isFlightRoute, isHub, shortestMoveCount, shortestRoute, travelOptions } from './graph';
import { getCountry, countryName } from './world';
import type { GameConfig, GameResult, GameState, MoveResult } from './types';

/** Flight mode is the only mode where a sea crossing counts as a move. */
export function allowsFlights(config: GameConfig): boolean {
  return config.mode === 'flight';
}

/** Visa Denied's closed countries, or none in every other mode. */
export function closedSet(config: Pick<GameConfig, 'closed'>): ReadonlySet<string> {
  return new Set(config.closed ?? []);
}

/** True when this step of a route was flown rather than walked over a border. */
export function wasFlown(config: GameConfig, from: string, to: string): boolean {
  return allowsFlights(config) && !areNeighbours(from, to) && isFlightRoute(from, to);
}

export function createGame(config: GameConfig, now: number = Date.now()): GameState {
  return {
    config,
    route: [config.start],
    wrongGuesses: [],
    hints: 0,
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
  const flights = allowsFlights(state.config);
  if (!canTravel(from, iso2, flights)) {
    return {
      ok: false,
      reason: 'not-adjacent',
      message: !flights
        ? `${target.name} doesn't border ${countryName(from)}.`
        : // The one mistake the hub rule invites: trying to fly from a country
          // without an airport. Say what the rule is rather than just "no".
          target.hub && !isHub(from)
          ? `${countryName(from)} has no hub airport. Walk to a ✈ hub to fly to ${target.name}.`
          : `You can't reach ${target.name} from ${countryName(from)}.`,
    };
  }
  // A real border, but closed for this game. Counted as a wrong turn, like any
  // other refused move.
  if (closedSet(state.config).has(iso2)) {
    return { ok: false, reason: 'closed', message: `Visa denied! ${target.name} won't let you in.` };
  }

  const won = iso2 === state.config.destination;
  return {
    ok: true,
    won,
    state: {
      ...state,
      route: [...state.route, iso2],
      // A hint is about where the player stood; moving on leaves it behind.
      hint: undefined,
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
    hints: state.hints,
    ...(state.config.closed ? { closed: state.config.closed } : {}),
    seconds: elapsedSeconds(state, now),
    optimalMoves: state.config.optimalMoves,
    optimal: moves <= state.config.optimalMoves && state.hints === 0,
  };
}

/**
 * A next step on one of the shortest routes from where the player stands.
 * Deterministic -- the same position always gives the same answer -- and
 * alphabetical among equals, so a hint never flickers between two countries.
 */
export function nextStep(state: GameState): string | null {
  const flights = allowsFlights(state.config);
  const here = currentCountry(state);
  // Distances are symmetric, so one search from the destination answers
  // "how far is each neighbour from the end" for all of them at once.
  const closed = closedSet(state.config);
  const toGo = distancesFrom(state.config.destination, flights, closed);
  const remaining = toGo.get(here);
  if (remaining === undefined || remaining === 0) return null;
  const steps = travelOptions(here, flights)
    .filter((iso) => !closed.has(iso) && toGo.get(iso) === remaining - 1)
    .sort((a, b) => countryName(a).localeCompare(countryName(b)));
  return steps[0] ?? null;
}

/**
 * Takes the next hint for where the player stands. The first shows where to
 * head (an outline on the map); the second gives its name. Each counts once,
 * and asking again after both changes nothing.
 */
export function takeHint(state: GameState): GameState {
  if (state.status !== 'playing') return state;
  if (state.hint?.named) return state;
  if (state.hint) return { ...state, hints: state.hints + 1, hint: { ...state.hint, named: true } };
  const step = nextStep(state);
  if (!step) return state;
  return { ...state, hints: state.hints + 1, hint: { iso2: step, named: false } };
}

/** One shortest route from a result's start to its destination, both included. */
export function bestRoute(result: Pick<GameResult, 'mode' | 'route' | 'closed'>): string[] | null {
  const start = result.route[0];
  const end = result.route[result.route.length - 1];
  return shortestRoute(start, end, result.mode === 'flight', closedSet(result));
}

/** Fewest further moves from where the player stands. Never shown during play. */
export function movesRemaining(state: GameState): number | null {
  return shortestMoveCount(
    currentCountry(state),
    state.config.destination,
    allowsFlights(state.config),
    closedSet(state.config)
  );
}
