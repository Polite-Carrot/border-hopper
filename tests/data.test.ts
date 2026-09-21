import { describe, expect, it } from 'vitest';
import { COUNTRIES, SHAPES, MAP_WIDTH, MAP_HEIGHT, getCountry } from '../src/core/world';

describe('country data', () => {
  it('loads a full set of sovereign countries', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(190);
    expect(COUNTRIES.length).toBeLessThanOrEqual(200);
  });

  it('gives every country a valid ISO code, name and flag', () => {
    for (const country of COUNTRIES) {
      expect(country.iso2).toMatch(/^[A-Z]{2}$/);
      expect(country.iso3).toMatch(/^[A-Z]{3}$/);
      expect(country.name.length).toBeGreaterThan(1);
      expect([...country.flag]).toHaveLength(2);
    }
  });

  it('has no duplicate ISO codes or names', () => {
    expect(new Set(COUNTRIES.map((c) => c.iso2)).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((c) => c.name)).size).toBe(COUNTRIES.length);
  });

  it('includes the countries players expect', () => {
    for (const iso of ['FR', 'ES', 'PT', 'US', 'GB', 'DE', 'CN', 'IN', 'BR', 'ZA', 'AU', 'JP', 'EG', 'NG']) {
      expect(getCountry(iso), iso).toBeDefined();
    }
    expect(getCountry('FR')!.name).toBe('France');
    expect(getCountry('US')!.name).toBe('United States');
    expect(getCountry('CZ')!.name).toBe('Czechia');
  });

  it('excludes dependencies and territories from play', () => {
    for (const iso of ['GL', 'PR', 'HK', 'MO', 'GI', 'FK', 'EH', 'AQ']) {
      expect(getCountry(iso), iso).toBeUndefined();
    }
  });

  it('positions every country inside the projected canvas', () => {
    for (const country of COUNTRIES) {
      const [x, y] = country.centroid;
      expect(x, country.name).toBeGreaterThanOrEqual(-1);
      expect(x, country.name).toBeLessThanOrEqual(MAP_WIDTH + 1);
      expect(y, country.name).toBeGreaterThanOrEqual(-1);
      expect(y, country.name).toBeLessThanOrEqual(MAP_HEIGHT + 1);
      const [x0, y0, x1, y1] = country.bbox;
      expect(x1).toBeGreaterThanOrEqual(x0);
      expect(y1).toBeGreaterThanOrEqual(y0);
    }
  });

  it('draws a shape for every playable country plus extra territories', () => {
    const drawn = new Set(SHAPES.filter((s) => s.playable).map((s) => s.key));
    for (const country of COUNTRIES) expect(drawn.has(country.iso2), country.name).toBe(true);
    expect(SHAPES.length).toBeGreaterThan(COUNTRIES.length);
    for (const shape of SHAPES) expect(shape.d.startsWith('M')).toBe(true);
  });
});
