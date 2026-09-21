import { describe, expect, it } from 'vitest';
import { bestMatch, normalise, searchCountries } from '../src/core/search';
import { COUNTRIES } from '../src/core/world';

const first = (query: string) => searchCountries(query)[0]?.name;
const codes = (query: string) => searchCountries(query).map((c) => c.iso2);

describe('country search', () => {
  it('folds case, accents and punctuation', () => {
    expect(normalise('Côte d’Ivoire')).toBe('cote divoire');
    expect(normalise('  TÜRKIYE ')).toBe('turkiye');
    expect(normalise('Guinea-Bissau')).toBe('guinea bissau');
  });

  it('returns every country for an empty query', () => {
    expect(searchCountries('', 500)).toHaveLength(COUNTRIES.length);
    expect(searchCountries('   ', 500)).toHaveLength(COUNTRIES.length);
  });

  it('matches a partial prefix', () => {
    expect(first('spa')).toBe('Spain');
    expect(first('port')).toBe('Portugal');
    expect(first('germ')).toBe('Germany');
    expect(first('braz')).toBe('Brazil');
  });

  it('is case insensitive', () => {
    expect(first('SPAIN')).toBe('Spain');
    expect(first('sPaIn')).toBe('Spain');
    expect(first('france')).toBe('France');
  });

  it('ignores accents in the query and the data', () => {
    expect(first('turkiye')).toBe('Türkiye');
    expect(first('türkiye')).toBe('Türkiye');
    expect(first('cote divoire')).toBe("Côte d'Ivoire");
    expect(first('sao tome')).toBe('São Tomé and Príncipe');
  });

  it('understands common names and abbreviations', () => {
    expect(first('uk')).toBe('United Kingdom');
    expect(first('usa')).toBe('United States');
    expect(first('us')).toBe('United States');
    expect(first('america')).toBe('United States');
    expect(first('holland')).toBe('Netherlands');
    expect(first('czech republic')).toBe('Czechia');
    expect(first('burma')).toBe('Myanmar');
    expect(first('ivory coast')).toBe("Côte d'Ivoire");
    expect(first('swaziland')).toBe('Eswatini');
    expect(first('south korea')).toBe('South Korea');
    expect(first('north korea')).toBe('North Korea');
    expect(first('uae')).toBe('United Arab Emirates');
    expect(first('drc')).toBe('DR Congo');
    expect(first('turkey')).toBe('Türkiye');
    expect(first('east timor')).toBe('Timor-Leste');
  });

  it('matches ISO codes', () => {
    expect(first('deu')).toBe('Germany');
    expect(first('esp')).toBe('Spain');
    expect(first('jpn')).toBe('Japan');
  });

  it('matches on a word that is not the first', () => {
    expect(codes('zealand')).toContain('NZ');
    expect(codes('africa')).toContain('ZA');
    expect(codes('guinea')).toEqual(expect.arrayContaining(['GN', 'GW', 'GQ', 'PG']));
  });

  it('tolerates skipped letters', () => {
    expect(first('nthrlnds')).toBe('Netherlands');
    expect(first('kyrgyzstn')).toBe('Kyrgyzstan');
  });

  it('returns nothing for gibberish', () => {
    expect(searchCountries('qqzzxxjj')).toEqual([]);
  });

  it('respects the result limit', () => {
    expect(searchCountries('a', 5)).toHaveLength(5);
  });

  it('exposes a single best match for submitting the search field', () => {
    expect(bestMatch('spa')?.iso2).toBe('ES');
    expect(bestMatch('')?.iso2).toBe(COUNTRIES[0].iso2);
    expect(bestMatch('qqzzxxjj')).toBeUndefined();
  });

  it('finds every country by its own exact name', () => {
    for (const country of COUNTRIES) {
      expect(bestMatch(country.name)?.iso2, country.name).toBe(country.iso2);
    }
  });
});
