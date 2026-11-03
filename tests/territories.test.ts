import { describe, expect, it } from 'vitest';
import { COUNTRIES, getCountry } from '../src/core/world';
import { distancesFrom, neighboursOf, shortestMoveCount } from '../src/core/graph';
import { ENDPOINT_CANDIDATES, FLIGHT_ENDPOINT_CANDIDATES, generateGame } from '../src/core/generate';
import { CAMPAIGN_LEVELS } from '../src/core/campaign';
import { dailyGame, dateKey } from '../src/core/daily';
import { bestMatch } from '../src/core/search';

const isTerritory = (iso: string) => Boolean(getCountry(iso)?.territory);

/** Breadth-first search that never steps onto a territory: the graph as it was before they existed. */
function withoutTerritories(start: string): Map<string, number> {
  const distances = new Map([[start, 0]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const next of neighboursOf(queue[i])) {
      if (isTerritory(next) || distances.has(next)) continue;
      distances.set(next, distances.get(queue[i])! + 1);
      queue.push(next);
    }
  }
  return distances;
}

describe('territories', () => {
  it('border what they really border', () => {
    expect(neighboursOf('GI')).toEqual(['ES']);
    expect(neighboursOf('ES')).toContain('GI');
    expect(neighboursOf('HK')).toEqual(['CN']);
    expect(neighboursOf('MO')).toEqual(['CN']);
    expect([...neighboursOf('EH')].sort()).toEqual(['DZ', 'MA', 'MR']);
    expect(neighboursOf('SX')).toEqual(['MF']);
  });

  it('say whose they are', () => {
    expect(getCountry('GI')).toMatchObject({ territory: true, sovereign: 'GB' });
    expect(getCountry('GL')).toMatchObject({ territory: true, sovereign: 'DK' });
    expect(getCountry('EH')?.sovereign).toBeUndefined();
    expect(getCountry('TV')?.territory).toBeUndefined();
  });

  it('can be typed', () => {
    expect(bestMatch('gibraltar')?.iso2).toBe('GI');
    expect(bestMatch('falklands')?.iso2).toBe('FK');
    expect(bestMatch('macao')?.iso2).toBe('MO');
    expect(bestMatch('faroes')?.iso2).toBe('FO');
    expect(bestMatch('tuvalu')?.iso2).toBe('TV');
  });

  it('are never a start or a destination', () => {
    expect(ENDPOINT_CANDIDATES.some((c) => c.territory)).toBe(false);
    expect(FLIGHT_ENDPOINT_CANDIDATES.some((c) => c.territory)).toBe(false);
    for (const level of CAMPAIGN_LEVELS) {
      expect(isTerritory(level.start) || isTerritory(level.destination), `level ${level.level}`).toBe(false);
    }
    for (let i = 0; i < 200; i++) {
      for (const mode of ['classic', 'flight'] as const) {
        const game = generateGame({ mode, seed: `territory-${i}` });
        expect(isTerritory(game.start) || isTerritory(game.destination)).toBe(false);
      }
      const day = dailyGame(dateKey(new Date(2026, 0, 1 + i)));
      expect(isTerritory(day.start) || isTerritory(day.destination)).toBe(false);
    }
  });

  it('change no route between two countries, nor the order games are dealt in', () => {
    // Every daily, random land game and campaign level is chosen by walking
    // the graph outward from the start. If territories shortened a route, or
    // changed the order countries are met, the same seed would deal a
    // different game -- and an app that has not updated yet would disagree
    // with one that has about what today's daily is.
    for (const start of ENDPOINT_CANDIDATES) {
      const before = withoutTerritories(start.iso2);
      const after = [...distancesFrom(start.iso2)].filter(([iso]) => !isTerritory(iso));
      expect(after.map(([iso]) => iso), start.iso2).toEqual([...before.keys()]);
      for (const [iso, d] of after) expect(d, `${start.iso2}-${iso}`).toBe(before.get(iso));
    }
  });

  it('include Tuvalu, which the coarser map left out', () => {
    const tuvalu = getCountry('TV')!;
    expect(tuvalu.name).toBe('Tuvalu');
    expect(tuvalu.continent).toBe('Oceania');
    expect(shortestMoveCount('FR', 'TV', true)).not.toBeNull();
  });

  it('give every territory a page in the passport', () => {
    for (const country of COUNTRIES.filter((c) => c.territory)) expect(country.continent, country.name).toBeTruthy();
  });
});
