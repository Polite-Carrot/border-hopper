import { COUNTRIES, requireCountry } from './world';

/**
 * Land-border adjacency.
 *
 * The graph is derived from Natural Earth polygons at build time (see
 * `scripts/build-country-data.ts`): two countries are neighbours only when
 * their polygons share a border segment. Sea crossings are never borders,
 * so the United Kingdom borders only Ireland, and Indonesia only borders
 * Papua New Guinea, Timor-Leste and Malaysia.
 */
export function areNeighbours(a: string, b: string): boolean {
  return requireCountry(a).neighbours.includes(b);
}

export function neighboursOf(iso2: string): readonly string[] {
  return requireCountry(iso2).neighbours;
}

/**
 * Countries reachable across open water from here, nearest first.
 *
 * These are short sea crossings measured between real coastlines, not flights
 * to anywhere: the United States reaches Russia because the Bering Strait is
 * 113km wide, and a landlocked country has none at all.
 */
export function crossingsOf(iso2: string): readonly { iso2: string; km: number }[] {
  return requireCountry(iso2).crossings;
}

export function isCrossing(a: string, b: string): boolean {
  return requireCountry(a).crossings.some((crossing) => crossing.iso2 === b);
}

/**
 * Everywhere a player can travel from here. Land borders only by default;
 * flight mode adds the sea crossings.
 */
export function travelOptions(iso2: string, flights = false): string[] {
  const country = requireCountry(iso2);
  if (!flights) return [...country.neighbours];
  return [...country.neighbours, ...country.crossings.map((crossing) => crossing.iso2)];
}

export function canTravel(from: string, to: string, flights = false): boolean {
  return areNeighbours(from, to) || (flights && isCrossing(from, to));
}

/**
 * Breadth-first distances from `start`, in moves. The start country is 0.
 * Unreachable countries are absent from the map.
 */
export function distancesFrom(start: string, flights = false): Map<string, number> {
  const distances = new Map<string, number>([[start, 0]]);
  const queue: string[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    const distance = distances.get(current)! + 1;
    for (const next of travelOptions(current, flights)) {
      if (distances.has(next)) continue;
      distances.set(next, distance);
      queue.push(next);
    }
  }
  return distances;
}

/**
 * One shortest land route from `start` to `destination`, inclusive of both.
 * Returns null when no land route exists. Where several shortest routes exist
 * this returns one of them; only its length is used for scoring.
 */
export function shortestRoute(start: string, destination: string, flights = false): string[] | null {
  if (start === destination) return [start];
  const cameFrom = new Map<string, string | null>([[start, null]]);
  const queue: string[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const next of travelOptions(current, flights)) {
      if (cameFrom.has(next)) continue;
      cameFrom.set(next, current);
      if (next === destination) {
        const route: string[] = [];
        for (let at: string | null = destination; at !== null; at = cameFrom.get(at) ?? null) route.unshift(at);
        return route;
      }
      queue.push(next);
    }
  }
  return null;
}

/** Fewest moves between two countries, or null when there is no land route. */
export function shortestMoveCount(start: string, destination: string, flights = false): number | null {
  const route = shortestRoute(start, destination, flights);
  return route ? route.length - 1 : null;
}

/**
 * Connected components of the land graph, largest first. Island nations form
 * their own single-country components; the two large ones are the Americas and
 * Afro-Eurasia, which is why no land route runs between them.
 */
export function connectedComponents(flights = false): string[][] {
  const seen = new Set<string>();
  const components: string[][] = [];
  for (const country of COUNTRIES) {
    if (seen.has(country.iso2)) continue;
    const component = [...distancesFrom(country.iso2, flights).keys()];
    for (const iso of component) seen.add(iso);
    components.push(component);
  }
  return components.sort((a, b) => b.length - a.length);
}
