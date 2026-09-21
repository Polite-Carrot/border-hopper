/**
 * Generates `src/data/campaign.generated.json`: a fixed ladder of levels that
 * gets harder in two ways at once.
 *
 * Harder by *distance*: the required route grows from two moves to eight.
 *
 * Harder by *obscurity*: countries are ranked by how likely a player is to
 * know them, and early levels draw only from the top of that ranking. The
 * pool widens as the ladder climbs, so Canada and Mexico open the game and
 * the likes of Eswatini and Kyrgyzstan turn up much later.
 *
 * Run with: npm run build:campaign
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import populations from 'country-json/src/country-by-population.json' with { type: 'json' };
import { COUNTRIES, getCountry } from '../src/core/world.ts';
import { distancesFrom, shortestMoveCount } from '../src/core/graph.ts';
import { seededRandom, weightedPick } from '../src/core/random.ts';

countries.registerLocale(enLocale as never);

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/campaign.generated.json');

const LEVELS = 250;
/** The opening level, so the ladder starts somewhere everyone knows. */
const FIRST_LEVEL = { start: 'CA', destination: 'MX' };
/** How many countries the very first levels may draw on. */
const OPENING_POOL = 28;

// ---------------------------------------------------------------------------
// Population, joined on to ISO codes by name.
// ---------------------------------------------------------------------------
// The dataset spells countries its own way ("Fiji Islands", "Holy See
// (Vatican City State)"), so this resolves against the game's own names and
// the aliases the search already knows, rather than hoping the spellings line
// up. `the` is dropped so "The Democratic Republic of Congo" resolves too.
// The runtime search folds accents from a lookup table, for engines without
// String.normalize. This runs in Node, so it can just use it.
const strip = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '');

const byExactName = new Map<string, string>();
for (const country of COUNTRIES) {
  byExactName.set(strip(country.name), country.iso2);
  for (const alias of country.aliases) byExactName.set(strip(alias), country.iso2);
}

function resolveIso(rawName: string): string | null {
  const query = strip(rawName);
  const exact = byExactName.get(query);
  if (exact) return exact;
  // "Fiji Islands" -> "fiji", "Micronesia, Federated States of" -> "micronesia"
  for (const [known, iso2] of byExactName) {
    if (known.length >= 4 && query.startsWith(`${known} `)) return iso2;
  }
  return null;
}

const populationByIso = new Map<string, number>();
for (const row of populations as { country: string; population: number | null }[]) {
  if (!row.population) continue;
  const iso2 = resolveIso(row.country);
  if (iso2 && !populationByIso.has(iso2)) populationByIso.set(iso2, row.population);
}

const missing = COUNTRIES.filter((c) => !populationByIso.has(c.iso2));
if (missing.length > 0) {
  console.warn(`no population for ${missing.length}: ${missing.map((c) => `${c.iso2} ${c.name}`).join(', ')}`);
}
// Population is most of what makes a country recognisable here. If the join
// breaks, the ladder quietly becomes "sorted by land area" instead -- so fail
// rather than ship that.
if (missing.length > 3) {
  throw new Error(`population joined for only ${COUNTRIES.length - missing.length}/${COUNTRIES.length} countries`);
}

// ---------------------------------------------------------------------------
// How recognisable a country is, as a score in 0..1.
// ---------------------------------------------------------------------------
const normalise = (value: number, min: number, max: number) => (max === min ? 0.5 : (value - min) / (max - min));

const logPopulations = COUNTRIES.map((c) => Math.log10(Math.max(1e4, populationByIso.get(c.iso2) ?? 1e5)));
const logAreas = COUNTRIES.map((c) => Math.log10(Math.max(0.01, c.area)));
const degrees = COUNTRIES.map((c) => c.neighbours.length);

const bounds = (values: number[]) => [Math.min(...values), Math.max(...values)] as const;
const [minPop, maxPop] = bounds(logPopulations);
const [minArea, maxArea] = bounds(logAreas);
const [minDegree, maxDegree] = bounds(degrees);

/**
 * Population carries most of the weight, with land area and how many
 * neighbours a country has filling in: a big country with many borders gets
 * met often even when few people live there.
 */
const fame = new Map<string, number>(
  COUNTRIES.map((country, i) => [
    country.iso2,
    0.6 * normalise(logPopulations[i], minPop, maxPop) +
      0.25 * normalise(logAreas[i], minArea, maxArea) +
      0.15 * normalise(degrees[i], minDegree, maxDegree),
  ])
);

/** Endpoints must be reachable over land and big enough to be a fair target. */
const eligible = COUNTRIES.filter((c) => c.neighbours.length > 0 && c.area >= 0.25)
  .slice()
  .sort((a, b) => fame.get(b.iso2)! - fame.get(a.iso2)!);

// ---------------------------------------------------------------------------
// The curves.
// ---------------------------------------------------------------------------
/**
 * Route length for a level: 2 moves at the start, 8 by the end. Rounded
 * rather than floored so the longest routes get a proper band of levels
 * instead of only the very last one.
 */
const movesForLevel = (level: number) => 2 + Math.min(6, Math.round((level / LEVELS) ** 0.85 * 6.4));

/** How far down the recognisability ranking a level is allowed to reach. */
const poolForLevel = (level: number) =>
  Math.round(OPENING_POOL + (eligible.length - OPENING_POOL) * (level / LEVELS) ** 1.15);

// ---------------------------------------------------------------------------
// Build.
// ---------------------------------------------------------------------------
interface Level {
  level: number;
  start: string;
  destination: string;
  moves: number;
}

const levels: Level[] = [];
const usedPairs = new Set<string>();
const startCount = new Map<string, number>();

function record(level: Level) {
  levels.push(level);
  usedPairs.add([level.start, level.destination].sort().join('-'));
  startCount.set(level.start, (startCount.get(level.start) ?? 0) + 1);
}

record({
  level: 1,
  ...FIRST_LEVEL,
  moves: shortestMoveCount(FIRST_LEVEL.start, FIRST_LEVEL.destination)!,
});

for (let level = 2; level <= LEVELS; level++) {
  const rand = seededRandom(`borderhopper-campaign:${level}`);
  const targetMoves = movesForLevel(level);
  let placed = false;

  // Widen the pool and then loosen the move target only if a level cannot be
  // built, so the curve holds wherever it can.
  for (let relax = 0; relax <= 3 && !placed; relax++) {
    const pool = eligible.slice(0, Math.min(eligible.length, poolForLevel(level) + relax * 20));
    const poolCodes = new Set(pool.map((c) => c.iso2));
    const allowedMoves = relax < 2 ? [targetMoves] : [targetMoves, targetMoves + 1, targetMoves - 1];

    for (let attempt = 0; attempt < 400 && !placed; attempt++) {
      // Prefer countries the player is likelier to know, and spread the
      // starts around rather than opening from the same place repeatedly.
      const start = weightedPick(
        pool,
        pool.map((c) => (fame.get(c.iso2)! + 0.15) / (1 + (startCount.get(c.iso2) ?? 0) * 2)),
        rand
      );
      const distances = distancesFrom(start.iso2);
      const options = [...distances]
        .filter(([iso, d]) => allowedMoves.includes(d) && poolCodes.has(iso) && iso !== start.iso2)
        .filter(([iso]) => !usedPairs.has([start.iso2, iso].sort().join('-')));
      if (options.length === 0) continue;

      const destination = weightedPick(
        options.map(([iso]) => iso),
        options.map(([iso]) => fame.get(iso)! + 0.15),
        rand
      );
      record({ level, start: start.iso2, destination, moves: distances.get(destination)! });
      placed = true;
    }
  }

  if (!placed) throw new Error(`could not build campaign level ${level}`);
}

writeFileSync(
  OUT,
  `${JSON.stringify({
    generated: 'scripts/build-campaign.ts',
    levels: levels.map(({ level, start, destination, moves }) => ({ level, start, destination, moves })),
  })}\n`
);

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------
const name = (iso: string) => getCountry(iso)!.name;
console.log(`levels: ${levels.length}`);
console.log(`unique pairs: ${usedPairs.size}`);
for (const l of [1, 2, 3, 10, 25, 50, 100, 150, 200, 240, 250]) {
  const entry = levels[l - 1];
  console.log(
    `  ${String(l).padStart(3)}  ${entry.moves} moves  ${name(entry.start)} -> ${name(entry.destination)}`
  );
}
const byMoves = new Map<number, number>();
for (const l of levels) byMoves.set(l.moves, (byMoves.get(l.moves) ?? 0) + 1);
console.log('moves spread:', [...byMoves].sort((a, b) => a[0] - b[0]).map(([m, n]) => `${m}:${n}`).join('  '));
