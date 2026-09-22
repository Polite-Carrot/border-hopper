import { COUNTRIES } from './world';
import type { Country } from './types';

/**
 * Folds accents without relying on String.prototype.normalize, which is not
 * guaranteed across every JS engine the app runs on.
 */
const FOLD: Record<string, string> = {
  à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a', ā: 'a', ă: 'a', ą: 'a',
  ç: 'c', ć: 'c', č: 'c', ď: 'd', đ: 'd',
  è: 'e', é: 'e', ê: 'e', ë: 'e', ē: 'e', ė: 'e', ę: 'e', ě: 'e',
  ğ: 'g', ì: 'i', í: 'i', î: 'i', ï: 'i', ī: 'i', į: 'i', ı: 'i',
  ł: 'l', ñ: 'n', ń: 'n', ň: 'n',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o', ø: 'o', ō: 'o', ő: 'o',
  ř: 'r', ś: 's', š: 's', ş: 's', ß: 'ss',
  ť: 't', ț: 't', ţ: 't',
  ù: 'u', ú: 'u', û: 'u', ü: 'u', ū: 'u', ů: 'u', ű: 'u',
  ý: 'y', ÿ: 'y', ź: 'z', ż: 'z', ž: 'z', æ: 'ae', œ: 'oe',
};

/** Lower-cases, folds accents and drops punctuation, so "Côte d'Ivoire" -> "cote divoire". */
export function normalise(input: string): string {
  let out = '';
  for (const char of input.toLowerCase()) {
    const folded = FOLD[char] ?? char;
    if (/[a-z0-9 ]/.test(folded) || folded.length > 1) out += folded;
    else if (folded === '-') out += ' ';
  }
  return out.replace(/\s+/g, ' ').trim();
}

interface Indexed {
  country: Country;
  name: string;
  words: string[];
  aliases: string[];
}

const INDEX: Indexed[] = COUNTRIES.map((country) => {
  const name = normalise(country.name);
  return {
    country,
    name,
    words: name.split(' '),
    aliases: country.aliases.map(normalise).filter((a) => a && a !== name),
  };
});

/** True when every character of `query` appears in `text`, in order. */
function isSubsequence(query: string, text: string): boolean {
  let i = 0;
  for (let j = 0; j < text.length && i < query.length; j++) {
    if (text[j] === query[i]) i++;
  }
  return i === query.length;
}

function score(entry: Indexed, query: string): number {
  if (entry.name === query) return 1000;
  if (entry.aliases.includes(query)) return 900;
  if (entry.name.startsWith(query)) return 800 - entry.name.length;
  if (entry.words.some((w) => w.startsWith(query))) return 700 - entry.name.length;
  if (entry.aliases.some((a) => a.startsWith(query))) return 600 - entry.name.length;
  if (entry.name.includes(query)) return 500 - entry.name.length;
  if (entry.aliases.some((a) => a.includes(query))) return 400 - entry.name.length;
  // Tolerates typos and skipped letters, e.g. "nthrlnds" -> Netherlands.
  if (query.length >= 3 && isSubsequence(query, entry.name)) return 200 - entry.name.length;
  return 0;
}

/**
 * Case-insensitive, accent-insensitive, partial and alias-aware country search.
 * An empty query returns every country in alphabetical order.
 *
 * Nothing is dropped by default. There are under 200 countries and the list is
 * windowed, so capping it buys nothing and costs the player the second half of
 * the alphabet: a default of 60 used to end the browsable list at Gabon.
 * `limit` remains for callers that genuinely want one, such as `bestMatch`.
 */
export function searchCountries(rawQuery: string, limit = COUNTRIES.length): Country[] {
  const query = normalise(rawQuery);
  if (!query) return COUNTRIES.slice(0, limit);
  const hits: { entry: Indexed; score: number }[] = [];
  for (const entry of INDEX) {
    const value = score(entry, query);
    if (value > 0) hits.push({ entry, score: value });
  }
  hits.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
  return hits.slice(0, limit).map((h) => h.entry.country);
}

/** The single best match, used for "press enter to travel". */
export function bestMatch(query: string): Country | undefined {
  return searchCountries(query, 1)[0];
}
