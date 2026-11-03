/**
 * Generates `src/data/campaign.generated.json`: a fixed ladder of 2000 levels.
 *
 * Part one, levels 1-1000, is frozen in `scripts/data/campaign-part-one.json`
 * and copied across exactly. Players have progress against those levels, so
 * they can never change -- not when the map gains a territory, not when this
 * script is tuned. They were built to get harder in two ways at once: routes
 * grew from two moves to twelve, and the countries at either end went from
 * the ones everybody knows (Canada to Mexico opens the game) to the likes of
 * Eswatini and Kyrgyzstan.
 *
 * Part two, levels 1001-2000, is built here. By then every country is in
 * play and routes are already long, so making each level longer than the
 * last would turn a thousand levels into one long slog. Instead it comes in
 * waves of 100: each wave climbs from a middling route to a long one, and both
 * ends of the wave rise from one wave to the next. Level 2000 is the longest
 * walk on the map, Lesotho to Papua New Guinea.
 *
 * Every pair of countries is used once in the whole ladder, a country is kept
 * out of play for a few levels after it appears, and the Americas get their
 * fair share of every level they have routes long enough for.
 *
 * Run with: npm run build:campaign
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES, getCountry } from '../src/core/world.ts';
import { distancesFrom, shortestMoveCount } from '../src/core/graph.ts';
import { seededRandom, weightedPick } from '../src/core/random.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/campaign.generated.json');
const PART_ONE = resolve(HERE, 'data/campaign-part-one.json');

const LEVELS = 2000;
/** The waves of part two. */
const WAVE = 100;
/** The last wave's final stretch: a run of the longest routes before the end. */
const FINALE = 10;
/** The longest land walk between two eligible countries: the last level. */
const LAST_LEVEL = { start: 'LS', destination: 'PG' };

// Only sovereign countries are ever a start or destination; territories are
// places to pass through (see `scripts/sovereign.ts`).
const sovereign = COUNTRIES.filter((c) => !c.territory);

// Population comes from the country data, which joins it once at build time
// (see `scripts/build-country-data.ts`). Population is most of what makes a
// country recognisable here. If it is absent the ladder quietly becomes
// "sorted by land area" instead -- so fail rather than ship that.
const missing = sovereign.filter((c) => !c.population);
if (missing.length > 3) {
  throw new Error(`population present for only ${sovereign.length - missing.length}/${sovereign.length} countries`);
}

// ---------------------------------------------------------------------------
// How recognisable a country is, as a score in 0..1.
// ---------------------------------------------------------------------------
const normalise = (value: number, min: number, max: number) => (max === min ? 0.5 : (value - min) / (max - min));

const logPopulations = sovereign.map((c) => Math.log10(Math.max(1e4, c.population || 1e5)));
const logAreas = sovereign.map((c) => Math.log10(Math.max(0.01, c.area)));
const degrees = sovereign.map((c) => c.neighbours.length);

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
  sovereign.map((country, i) => [
    country.iso2,
    0.6 * normalise(logPopulations[i], minPop, maxPop) +
      0.25 * normalise(logAreas[i], minArea, maxArea) +
      0.15 * normalise(degrees[i], minDegree, maxDegree),
  ])
);

/** Endpoints must be reachable over land and big enough to be a fair target. */
const eligible = sovereign
  .filter((c) => c.neighbours.length > 0 && c.area >= 0.25)
  .sort((a, b) => fame.get(b.iso2)! - fame.get(a.iso2)!);
const eligibleCodes = new Set(eligible.map((c) => c.iso2));

// ---------------------------------------------------------------------------
// The curve for part two.
// ---------------------------------------------------------------------------
/**
 * Route length for a level of part two. Each wave of 100 climbs from `low` to
 * `high`; the first wave runs 6 to 12 moves and the last 9 to 14, so the
 * second thousand starts easier than the first ended -- a breather after
 * level 1000's twelve moves -- and finishes harder. The very end is a run of
 * the longest routes there are.
 */
function movesForLevel(level: number): number {
  const index = level - 1001;
  if (level > LEVELS - FINALE) return Math.min(17, 15 + Math.floor((level - (LEVELS - FINALE) - 1) / 4));
  const wave = Math.floor(index / WAVE);
  const t = (index % WAVE) / (WAVE - 1);
  const low = 6 + wave * 0.35;
  const high = 12 + wave * 0.25;
  return Math.round(low + (high - low) * t);
}

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
/** How often each country has appeared so far, as either end of a level. */
const useCount = new Map<string, number>();
const pairKey = (a: string, b: string) => [a, b].sort().join('-');

/**
 * How many levels back a country stays out of play. Over a long ladder the
 * same handful of well-connected countries otherwise come round again and
 * again -- a third of levels reused a country from the five before, and South
 * Africa alone appeared 44 times in the first thousand.
 */
const RECENT_LEVELS = 5;

/**
 * The Americas, and their fair share of the ladder.
 *
 * The land graph is two great land masses, and left to fame and route length
 * the bigger one wins nearly everything. Part of that is geography that
 * cannot be helped -- the longest land route inside the Americas is 10 moves,
 * so longer levels have to be set elsewhere. The rest is fixed by giving the
 * Americas their share of every level whose route length they can support.
 */
const americas = new Set(distancesFrom('US').keys());
const AMERICAS_SHARE = eligible.filter((c) => americas.has(c.iso2)).length / eligible.length;
const AMERICAS_LONGEST = Math.max(
  ...eligible
    .filter((c) => americas.has(c.iso2))
    .flatMap((c) => [...distancesFrom(c.iso2)].filter(([iso]) => americas.has(iso)).map(([, d]) => d))
);
let americasLevels = 0;
let americasPossible = 0;

function record(level: Level) {
  levels.push(level);
  if (americas.has(level.start)) americasLevels++;
  if (level.moves <= AMERICAS_LONGEST) americasPossible++;
  usedPairs.add(pairKey(level.start, level.destination));
  for (const iso of [level.start, level.destination]) useCount.set(iso, (useCount.get(iso) ?? 0) + 1);
}

/**
 * The most any one country appears in part two before the rules loosen.
 * Long routes need far-apart ends, and there are only a few: left alone,
 * Eswatini and Lesotho each turned up in one level in twenty-five.
 */
const PART_TWO_MAX_USES = 25;
const partTwoUses = new Map<string, number>();

/** Countries used in the last few levels. */
const recentCountries = () =>
  new Set(levels.slice(-RECENT_LEVELS).flatMap((level) => [level.start, level.destination]));

/**
 * Fame, discounted the more a country has already been used. Squared in part
 * two: long routes need far-apart ends, and the far end of Afro-Eurasia is a
 * handful of countries in southern Africa that a gentler discount let turn up
 * in one level in twenty.
 */
const weight = (iso: string) => (fame.get(iso)! + 0.15) / (1 + (useCount.get(iso) ?? 0) * 0.6) ** 2;

// Part one, exactly as shipped. Checked against today's map: a level whose
// route the map no longer agrees with would score players against the wrong
// number of moves.
const partOne = (JSON.parse(readFileSync(PART_ONE, 'utf8')) as { levels: Level[] }).levels;
if (partOne.length !== 1000) throw new Error(`part one has ${partOne.length} levels, not 1000`);
for (const level of partOne) {
  const moves = shortestMoveCount(level.start, level.destination);
  if (moves !== level.moves) {
    throw new Error(`level ${level.level} is ${level.moves} moves as shipped but ${moves} on today's map`);
  }
  record(level);
}

function buildLevel(level: number, targetMoves: number): Level {
  const rand = seededRandom(`borderhopper-campaign:${level}`);
  const recent = recentCountries();
  // The last level's two countries are kept for the last level.
  const banned = new Set(level > LEVELS - RECENT_LEVELS ? [LAST_LEVEL.start, LAST_LEVEL.destination] : []);
  const allowed = (iso: string, relax: number) =>
    !banned.has(iso) && (relax >= 2 || (partTwoUses.get(iso) ?? 0) < PART_TWO_MAX_USES);
  const owed = targetMoves <= AMERICAS_LONGEST && americasLevels < AMERICAS_SHARE * (americasPossible + 1);

  // Loosen the rules one at a time, only when a level cannot be built: variety
  // first, and the move target last, so the curve holds wherever it can. When
  // the Americas are owed a level, try there first; they only get the gentle
  // relaxations, never a shorter or longer route.
  for (const region of owed ? (['americas', 'anywhere'] as const) : (['anywhere'] as const)) {
    const lastRelax = region === 'americas' ? 1 : 3;
    for (let relax = 0; relax <= lastRelax; relax++) {
      const fresh = relax === 0;
      const allowedMoves = relax < 2 ? [targetMoves] : relax < 3 ? [targetMoves - 1, targetMoves + 1] : [targetMoves - 2, targetMoves + 2];
      const inRegion = region === 'americas' ? eligible.filter((c) => americas.has(c.iso2)) : eligible;
      const starts = inRegion.filter((c) => (!fresh || !recent.has(c.iso2)) && allowed(c.iso2, relax));

      for (let attempt = 0; attempt < 400 && starts.length > 0; attempt++) {
        const start = weightedPick(starts, starts.map((c) => weight(c.iso2)), rand);
        const distances = distancesFrom(start.iso2);
        const options = [...distances]
          .filter(([iso, d]) => allowedMoves.includes(d) && eligibleCodes.has(iso) && iso !== start.iso2)
          .filter(([iso]) => region === 'anywhere' || americas.has(iso))
          .filter(([iso]) => (!fresh || !recent.has(iso)) && allowed(iso, relax))
          .filter(([iso]) => !usedPairs.has(pairKey(start.iso2, iso)));
        if (options.length === 0) continue;
        const destination = weightedPick(
          options.map(([iso]) => iso),
          options.map(([iso]) => weight(iso)),
          rand
        );
        return { level, start: start.iso2, destination, moves: distances.get(destination)! };
      }
    }
  }
  throw new Error(`could not build campaign level ${level}`);
}

for (let level = 1001; level < LEVELS; level++) {
  const built = buildLevel(level, movesForLevel(level));
  record(built);
  for (const iso of [built.start, built.destination]) partTwoUses.set(iso, (partTwoUses.get(iso) ?? 0) + 1);
}
record({ level: LEVELS, ...LAST_LEVEL, moves: shortestMoveCount(LAST_LEVEL.start, LAST_LEVEL.destination)! });
if (usedPairs.size !== LEVELS) throw new Error(`the last level repeats an earlier pair`);

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
for (const l of [1, 1000, 1001, 1050, 1100, 1101, 1500, 1900, 1990, 1999, LEVELS]) {
  const entry = levels[l - 1];
  console.log(
    `  ${String(l).padStart(4)}  ${String(entry.moves).padStart(2)} moves  ${name(entry.start)} -> ${name(entry.destination)}`
  );
}
const partTwo = levels.slice(1000);
const uses = new Map<string, number>();
let reusedRecently = 0;
levels.forEach((entry, i) => {
  if (i < 1000) return;
  const recent = new Set(levels.slice(Math.max(0, i - RECENT_LEVELS), i).flatMap((l) => [l.start, l.destination]));
  if (recent.has(entry.start) || recent.has(entry.destination)) reusedRecently++;
  for (const iso of [entry.start, entry.destination]) uses.set(iso, (uses.get(iso) ?? 0) + 1);
});
const mostUsed = [...uses].sort((a, b) => b[1] - a[1]).slice(0, 3);
console.log(
  `part two variety: ${uses.size} countries; ${reusedRecently} levels reuse one from the last ${RECENT_LEVELS}; ` +
    `most used ${mostUsed.map(([iso, n]) => `${iso} x${n}`).join(', ')}`
);
const partTwoAmericas = partTwo.filter((l) => americas.has(l.start)).length;
console.log(`part two americas: ${partTwoAmericas} levels (${((100 * partTwoAmericas) / partTwo.length).toFixed(1)}%)`);
const offTarget = partTwo.filter((l) => l.moves !== movesForLevel(l.level) && l.level !== LEVELS).length;
console.log(`part two off the curve: ${offTarget}`);
const byMoves = new Map<number, number>();
for (const l of partTwo) byMoves.set(l.moves, (byMoves.get(l.moves) ?? 0) + 1);
console.log('part two moves spread:', [...byMoves].sort((a, b) => a[0] - b[0]).map(([m, n]) => `${m}:${n}`).join('  '));
