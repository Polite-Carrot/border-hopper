import { describe, expect, it } from 'vitest';
import { areNeighbours, distancesFrom, shortestMoveCount, shortestRoute } from '../src/core/graph';

describe('pathfinding', () => {
  it('returns the start alone for a zero-move route', () => {
    expect(shortestRoute('FR', 'FR')).toEqual(['FR']);
    expect(shortestMoveCount('FR', 'FR')).toBe(0);
  });

  it('finds direct neighbours in one move', () => {
    expect(shortestRoute('FR', 'ES')).toEqual(['FR', 'ES']);
    expect(shortestMoveCount('FR', 'ES')).toBe(1);
  });

  it('finds the known shortest route across Iberia', () => {
    expect(shortestRoute('FR', 'PT')).toEqual(['FR', 'ES', 'PT']);
    expect(shortestMoveCount('FR', 'PT')).toBe(2);
  });

  it('returns a valid chain of borders for longer routes', () => {
    const route = shortestRoute('PT', 'FI');
    expect(route).not.toBeNull();
    expect(route![0]).toBe('PT');
    expect(route![route!.length - 1]).toBe('FI');
    for (let i = 0; i < route!.length - 1; i++) {
      expect(areNeighbours(route![i], route![i + 1]), `${route![i]} -> ${route![i + 1]}`).toBe(true);
    }
  });

  it('picks the shorter of several possible routes', () => {
    // Germany is reachable from Spain via France directly; no longer detour wins.
    expect(shortestMoveCount('ES', 'DE')).toBe(2);
    expect(shortestMoveCount('PT', 'DE')).toBe(3);
    expect(shortestMoveCount('PT', 'IT')).toBe(3);
  });

  it('reports no route across water', () => {
    expect(shortestRoute('FR', 'US')).toBeNull();
    expect(shortestMoveCount('DE', 'BR')).toBeNull();
    expect(shortestRoute('JP', 'KR')).toBeNull();
    expect(shortestRoute('AU', 'ID')).toBeNull();
  });

  it('never claims a route to an island nation', () => {
    expect(shortestRoute('DE', 'IS')).toBeNull();
    expect(shortestRoute('ES', 'MT')).toBeNull();
  });

  it('agrees with BFS distances', () => {
    const distances = distancesFrom('DE');
    expect(distances.get('DE')).toBe(0);
    expect(distances.get('FR')).toBe(1);
    expect(distances.get('ES')).toBe(2);
    expect(distances.get('PT')).toBe(3);
    expect(distances.has('US')).toBe(false);
    for (const [iso, distance] of distances) {
      expect(shortestMoveCount('DE', iso), iso).toBe(distance);
    }
  });
});
