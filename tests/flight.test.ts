import { describe, expect, it } from 'vitest';
import {
  areNeighbours, canTravel, connectedComponents, crossingsOf, flightsOf, isFlightRoute,
  shortestMoveCount, shortestRoute, travelOptions,
} from '../src/core/graph';
import { COUNTRIES, getCountry } from '../src/core/world';
import {
  FLIGHT_DIFFICULTY_MOVES, FLIGHT_ENDPOINT_CANDIDATES, generateGame, verifyConfig,
} from '../src/core/generate';
import { allowsFlights, applyMove, createGame, wasFlown } from '../src/core/game';
import type { GameConfig } from '../src/core/types';

const flightGame = (start: string, destination: string): GameConfig => ({
  mode: 'flight',
  start,
  destination,
  optimalMoves: shortestMoveCount(start, destination, true)!,
  difficulty: 'medium',
});

const isCrossing = (a: string, b: string) => crossingsOf(a).some((c) => c.iso2 === b);

describe('sea crossings', () => {
  it('is symmetric', () => {
    for (const country of COUNTRIES) {
      for (const crossing of country.crossings) {
        expect(getCountry(crossing.iso2), `${country.iso2} -> ${crossing.iso2}`).toBeDefined();
        expect(isCrossing(crossing.iso2, country.iso2), `${crossing.iso2} -> ${country.iso2}`).toBe(true);
      }
    }
  });

  it('never duplicates a land border', () => {
    for (const country of COUNTRIES) {
      for (const crossing of country.crossings) {
        expect(areNeighbours(country.iso2, crossing.iso2), `${country.iso2}-${crossing.iso2}`).toBe(false);
      }
    }
  });

  it('connects the famous short straits', () => {
    expect(isCrossing('GB', 'FR')).toBe(true);
    expect(isCrossing('US', 'RU')).toBe(true);
    expect(isCrossing('JP', 'KR')).toBe(true);
    expect(isCrossing('LK', 'IN')).toBe(true);
    expect(isCrossing('AU', 'PG')).toBe(true);
  });

  it('gives landlocked countries no crossings at all', () => {
    for (const iso of ['CH', 'AT', 'MN', 'BO', 'ZM', 'NP', 'ML', 'LU']) {
      expect(crossingsOf(iso), iso).toHaveLength(0);
    }
  });

  it('does not invent crossings over land', () => {
    // France to Austria is 143km with Switzerland in between, not a sea route.
    expect(isCrossing('FR', 'AT')).toBe(false);
    expect(isCrossing('FR', 'PT')).toBe(false);
    // Nor does an excluded land border come back as a crossing.
    expect(isCrossing('FR', 'BR')).toBe(false);
    expect(isCrossing('FR', 'SR')).toBe(false);
  });

  it('keeps every crossing within a plausible range', () => {
    for (const country of COUNTRIES) {
      for (const crossing of country.crossings) {
        expect(crossing.km, `${country.iso2}-${crossing.iso2}`).toBeGreaterThanOrEqual(5);
        expect(crossing.km, `${country.iso2}-${crossing.iso2}`).toBeLessThanOrEqual(2000);
      }
    }
  });
});

describe('the flight network', () => {
  it('is symmetric and never repeats a land border', () => {
    for (const country of COUNTRIES) {
      for (const flight of country.flights) {
        expect(getCountry(flight.iso2), `${country.iso2} -> ${flight.iso2}`).toBeDefined();
        expect(isFlightRoute(flight.iso2, country.iso2), `${flight.iso2} -> ${country.iso2}`).toBe(true);
        expect(areNeighbours(country.iso2, flight.iso2), `${country.iso2}-${flight.iso2}`).toBe(false);
      }
    }
  });

  it('gives every country somewhere to fly, landlocked ones included', () => {
    for (const country of COUNTRIES) {
      expect(flightsOf(country.iso2).length, country.iso2).toBeGreaterThan(0);
    }
    for (const iso of ['CH', 'AT', 'MN', 'BO', 'ZM', 'NP', 'ML']) {
      expect(flightsOf(iso).length, iso).toBeGreaterThan(0);
    }
  });

  it('keeps the short crossings as well as the long hauls', () => {
    // The nearest sea crossing is always flyable, so Dover to Calais survives.
    for (const iso of ['GB', 'JP', 'LK', 'AU']) {
      const nearest = crossingsOf(iso)[0];
      expect(isFlightRoute(iso, nearest.iso2), `${iso}-${nearest.iso2}`).toBe(true);
    }
    // And every country reaches somewhere genuinely far away.
    const longest = COUNTRIES.map((c) => Math.max(...c.flights.map((f) => f.km)));
    expect(Math.max(...longest)).toBeGreaterThan(10000);
  });

  it('goes further than whatever happens to be nearest', () => {
    // Half the network at least should be long haul rather than a short hop.
    const all = COUNTRIES.flatMap((c) => c.flights.map((f) => f.km));
    const longHaul = all.filter((km) => km >= 1200);
    expect(longHaul.length / all.length).toBeGreaterThan(0.5);
  });
});

describe('the flight graph', () => {
  it('leaves land routes untouched', () => {
    expect(travelOptions('FR')).toEqual(getCountry('FR')!.neighbours);
    expect(shortestMoveCount('US', 'FR')).toBeNull();
    expect(canTravel('GB', 'FR')).toBe(false);
  });

  it('opens the oceans when flights are allowed', () => {
    expect(canTravel('GB', 'FR', true)).toBe(true);
    expect(travelOptions('GB', true)).toContain('FR');
    expect(shortestMoveCount('US', 'FR', true)).not.toBeNull();
  });

  it('pulls the whole world into one piece', () => {
    const land = connectedComponents(false);
    const air = connectedComponents(true);
    expect(land.length).toBeGreaterThan(20);
    expect(air[0].length).toBeGreaterThan(190);
    expect(air.length).toBeLessThan(land.length);
  });

  it('routes the United States to France in very few moves', () => {
    const route = shortestRoute('US', 'FR', true);
    expect(route).not.toBeNull();
    expect(route![0]).toBe('US');
    expect(route![route!.length - 1]).toBe('FR');
    expect(route!.length - 1).toBeLessThanOrEqual(5);
    for (let i = 0; i < route!.length - 1; i++) {
      expect(canTravel(route![i], route![i + 1], true), `${route![i]} -> ${route![i + 1]}`).toBe(true);
    }
  });

  it('reaches islands that land routes never could', () => {
    for (const iso of ['JP', 'IS', 'NZ', 'CU', 'MG', 'LK']) {
      expect(shortestMoveCount('DE', iso, false), iso).toBeNull();
      expect(shortestMoveCount('DE', iso, true), iso).not.toBeNull();
    }
  });
});

describe('flight mode games', () => {
  it('offers a wider pool of endpoints than land mode', () => {
    const codes = new Set(FLIGHT_ENDPOINT_CANDIDATES.map((c) => c.iso2));
    for (const iso of ['JP', 'CU', 'MG', 'LK', 'NZ', 'IS']) expect(codes.has(iso), iso).toBe(true);
  });

  it('always generates a solvable game', () => {
    for (let i = 0; i < 150; i++) {
      const config = generateGame({ mode: 'flight', seed: `flight-${i}` });
      expect(config.mode).toBe('flight');
      expect(verifyConfig(config)).toBe(true);
      expect(shortestMoveCount(config.start, config.destination, true)).toBe(config.optimalMoves);
      expect(config.optimalMoves).toBeGreaterThan(1);
      const [min, max] = FLIGHT_DIFFICULTY_MOVES[config.difficulty];
      expect(config.optimalMoves, config.difficulty).toBeGreaterThanOrEqual(min);
      expect(config.optimalMoves, config.difficulty).toBeLessThanOrEqual(max);
    }
  });

  it('accepts a flight as a move only in flight mode', () => {
    const flying = applyMove(createGame(flightGame('GB', 'ES')), 'FR');
    expect(flying.ok).toBe(true);

    const walking = applyMove(
      createGame({ mode: 'classic', start: 'GB', destination: 'ES', optimalMoves: 1, difficulty: 'easy' }),
      'FR'
    );
    expect(walking.ok).toBe(false);
    if (!walking.ok) expect(walking.message).toBe("France doesn't border United Kingdom.");
  });

  it('still refuses somewhere with neither a border nor a flight', () => {
    const unreachable = COUNTRIES.find(
      (c) => !canTravel('GB', c.iso2, true) && c.iso2 !== 'GB'
    )!;
    const result = applyMove(createGame(flightGame('GB', 'ES')), unreachable.iso2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not-adjacent');
      expect(result.message).toBe(`You can't reach ${unreachable.name} from United Kingdom.`);
    }
  });

  it('knows which steps were flown', () => {
    const config = flightGame('GB', 'ES');
    expect(allowsFlights(config)).toBe(true);
    expect(wasFlown(config, 'GB', 'FR')).toBe(true);
    expect(wasFlown(config, 'FR', 'ES')).toBe(false);
    expect(wasFlown({ ...config, mode: 'classic' }, 'GB', 'FR')).toBe(false);
  });
});
