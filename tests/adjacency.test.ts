import { describe, expect, it } from 'vitest';
import { COUNTRIES, getCountry } from '../src/core/world';
import { areNeighbours, connectedComponents, neighboursOf } from '../src/core/graph';

describe('land-border adjacency', () => {
  it('accepts real land borders', () => {
    expect(areNeighbours('FR', 'ES')).toBe(true);
    expect(areNeighbours('ES', 'PT')).toBe(true);
    expect(areNeighbours('FR', 'DE')).toBe(true);
    expect(areNeighbours('US', 'CA')).toBe(true);
    expect(areNeighbours('US', 'MX')).toBe(true);
    expect(areNeighbours('CN', 'IN')).toBe(true);
    expect(areNeighbours('PA', 'CO')).toBe(true);
    expect(areNeighbours('EG', 'SD')).toBe(true);
    expect(areNeighbours('ZA', 'LS')).toBe(true);
    expect(areNeighbours('IT', 'VA')).toBe(true);
  });

  it('rejects countries that do not touch', () => {
    expect(areNeighbours('FR', 'PT')).toBe(false);
    expect(areNeighbours('ES', 'IT')).toBe(false);
    expect(areNeighbours('US', 'BR')).toBe(false);
  });

  it('does not count sea crossings as borders', () => {
    expect(areNeighbours('GB', 'FR')).toBe(false);
    expect(areNeighbours('ES', 'MA')).toBe(false);
    expect(areNeighbours('IT', 'TN')).toBe(false);
    expect(areNeighbours('JP', 'KR')).toBe(false);
    expect(areNeighbours('AU', 'NZ')).toBe(false);
    expect(areNeighbours('SE', 'DK')).toBe(false);
  });

  it('is symmetric for every pair', () => {
    for (const country of COUNTRIES) {
      for (const other of country.neighbours) {
        expect(getCountry(other), `${country.iso2} -> ${other}`).toBeDefined();
        expect(areNeighbours(other, country.iso2), `${other} -> ${country.iso2}`).toBe(true);
      }
    }
  });

  it('never makes a country its own neighbour', () => {
    for (const country of COUNTRIES) expect(country.neighbours).not.toContain(country.iso2);
  });

  it('treats island nations as having no land neighbours', () => {
    for (const iso of ['JP', 'NZ', 'IS', 'MG', 'CU', 'PH', 'LK', 'MT', 'CY']) {
      expect(neighboursOf(iso), iso).toHaveLength(0);
    }
  });

  it('keeps borders that run through unrecognised territories', () => {
    // Somaliland is merged into Somalia, so the Djibouti border survives.
    expect(areNeighbours('SO', 'DJ')).toBe(true);
    // Kosovo is merged into Serbia under ISO 3166-1.
    expect(areNeighbours('RS', 'ME')).toBe(true);
    expect(areNeighbours('RS', 'MK')).toBe(true);
  });

  it('follows the recognised-boundary reading for Western Sahara', () => {
    expect(areNeighbours('MA', 'MR')).toBe(false);
    expect(areNeighbours('MA', 'DZ')).toBe(true);
  });

  it('excludes borders that exist only via overseas territory', () => {
    // French Guiana makes France a real neighbour of Brazil, but it is left out
    // of the playable graph -- see EXCLUDED_BORDERS in scripts/sovereign.ts.
    expect(areNeighbours('FR', 'BR')).toBe(false);
    expect(areNeighbours('FR', 'SR')).toBe(false);
  });

  it('keeps borders formed by nearby exclaves', () => {
    // Russia borders Poland and Lithuania only through Kaliningrad.
    expect(areNeighbours('RU', 'PL')).toBe(true);
    expect(areNeighbours('RU', 'LT')).toBe(true);
    // Azerbaijan borders Türkiye only through Nakhchivan.
    expect(areNeighbours('AZ', 'TR')).toBe(true);
  });

  it('splits the world into Afro-Eurasia and the Americas, plus islands', () => {
    const components = connectedComponents();
    const mainland = components.filter((c) => c.length > 5);
    expect(mainland).toHaveLength(2);
    expect(mainland[0]).toContain('DE');
    expect(mainland[0]).toContain('CN');
    expect(mainland[0]).toContain('ZA');
    expect(mainland[1]).toContain('US');
    expect(mainland[1]).toContain('BR');
    expect(mainland[0]).not.toContain('US');
  });
});
