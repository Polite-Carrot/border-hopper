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
import { COUNTRIES, getCountry } from '../src/core/world.ts';
import { distancesFrom, shortestMoveCount } from '../src/core/graph.ts';
import { seededRandom, weightedPick } from '../src/core/random.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/campaign.generated.json');

const LEVELS = 1000;
/**
 * The longest route the ladder asks for. Eight was enough for 250 levels, but
 * over 1000 it left the last 292 all the same length -- and by then the
 * obscurity pool has run out too, so that whole stretch would have played
 * alike. Land routes between eligible countries run to 18 moves; there are 342
 * distinct 12-move pairs, comfortably more than the 159 levels that use them.
 */
const LONGEST_ROUTE = 12;
/** The opening level, so the ladder starts somewhere everyone knows. */
const FIRST_LEVEL = { start: 'CA', destination: 'MX' };
/** How many countries the very first levels may draw on. */
const OPENING_POOL = 28;

// Population comes from the country data, which joins it once at build time
// (see `scripts/build-country-data.ts`). This script used to repeat that join
// against the same source, which is one more place for it to break quietly.
const missing = COUNTRIES.filter((c) => !c.population);
if (missing.length > 0) {
  console.warn(`no population for ${missing.length}: ${missing.map((c) => `${c.iso2} ${c.name}`).join(', ')}`);
}
// Population is most of what makes a country recognisable here. If it is
// absent the ladder quietly becomes "sorted by land area" instead -- so fail
// rather than ship that.
if (missing.length > 3) {
  throw new Error(`population present for only ${COUNTRIES.length - missing.length}/${COUNTRIES.length} countries`);
}

// ---------------------------------------------------------------------------
// How recognisable a country is, as a score in 0..1.
// ---------------------------------------------------------------------------
const normalise = (value: number, min: number, max: number) => (max === min ? 0.5 : (value - min) / (max - min));

const logPopulations = COUNTRIES.map((c) => Math.log10(Math.max(1e4, c.population || 1e5)));
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
 * Route length for a level: 2 moves at the start, LONGEST_ROUTE by the end.
 * Rounded rather than floored so the longest routes get a proper band of
 * levels instead of only the very last one.
 *
 * The exponent sets how front-loaded the climb is, and it is tuned so the
 * opening stays the same whatever the ladder's length: three warm-up levels at
 * two moves, then three-move routes from level 4. Scaling the old curve to
 * 1000 levels would have stretched the warm-up fourfold, back to the flat start
 * that was just removed. From there a route grows by one move every 60 to 150
 * levels, all the way to the end.
 */
const DISTANCE_CURVE = 0.53;
const movesForLevel = (level: number) =>
  2 +
  Math.min(
    LONGEST_ROUTE - 2,
    Math.round((level / LEVELS) ** DISTANCE_CURVE * (LONGEST_ROUTE - 2 + 0.4))
  );

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
/** How often each country has appeared so far, as either end of a level. */
const useCount = new Map<string, number>();

/**
 * How many levels back a country stays out of play. Over a 1000-level ladder
 * the same handful of well-connected countries otherwise come round again and
 * again -- a third of levels reused a country from the five before, and South
 * Africa alone appeared 44 times.
 */
const RECENT_LEVELS = 5;

function record(level: Level) {
  levels.push(level);
  if (americas.has(level.start)) americasLevels++;
  usedPairs.add([level.start, level.destination].sort().join('-'));
  for (const iso of [level.start, level.destination]) useCount.set(iso, (useCount.get(iso) ?? 0) + 1);
}

/** Countries used in the last few levels. */
const recentCountries = () =>
  new Set(levels.slice(-RECENT_LEVELS).flatMap((level) => [level.start, level.destination]));

/**
 * The Americas, and their fair share of the ladder.
 *
 * The land graph is two great land masses, and left to fame and route length
 * the bigger one wins nearly everything: the 1000-level ladder put 2.8% of its
 * levels in the Americas against their 15% of playable countries, and Belize,
 * Costa Rica, El Salvador, Honduras, Nicaragua and Panama never appeared at
 * all. Part of that is geography that cannot be helped -- the longest land
 * route inside the Americas is 10 moves, so 11- and 12-move levels have to be
 * set elsewhere. The rest is fixed by giving the Americas their share of every
 * level whose route length they can actually support.
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

/** Fame, discounted the more a country has already been used. */
const weight = (iso: string) => (fame.get(iso)! + 0.15) / (1 + (useCount.get(iso) ?? 0) * 0.6);

record({
  level: 1,
  ...FIRST_LEVEL,
  moves: shortestMoveCount(FIRST_LEVEL.start, FIRST_LEVEL.destination)!,
});

for (let level = 2; level <= LEVELS; level++) {
  const rand = seededRandom(`borderhopper-campaign:${level}`);
  const targetMoves = movesForLevel(level);
  let placed = false;

  // Loosen the rules one at a time, only when a level cannot be built: variety
  // first, then the pool's reach, and the move target last, so the difficulty
  // curve holds wherever it possibly can.
  const recent = recentCountries();
  if (targetMoves <= AMERICAS_LONGEST) americasPossible++;
  const owed = targetMoves <= AMERICAS_LONGEST && americasLevels < AMERICAS_SHARE * americasPossible;
  // When the Americas are owed a level, try there first; if no level of the
  // right length can be built there, fall back to anywhere. The Americas only
  // get the gentle relaxations -- never a shorter or longer route -- because
  // the difficulty curve outranks regional balance: a 2-move level dropped into
  // a run of 3-move ones to keep the map fair is the worse of the two faults.
  for (const region of owed ? (['americas', 'anywhere'] as const) : (['anywhere'] as const)) {
  const lastRelax = region === 'americas' ? 2 : 4;
  for (let relax = 0; relax <= lastRelax && !placed; relax++) {
    const fresh = relax === 0;
    // The Americas reach further down the fame ranking than the rest of the
    // world, because they have so few routes to choose from: 196 in all,
    // against several thousand elsewhere. Held to the same reach, their lesser
    // known countries never qualified in time and the region got 3% of levels.
    const widen = Math.max(0, relax - 1) * (region === 'americas' ? 3 : 1);
    const pool = eligible.slice(0, Math.min(eligible.length, poolForLevel(level) + widen * 20));
    const poolCodes = new Set(pool.map((c) => c.iso2));
    const allowedMoves = relax < 3 ? [targetMoves] : [targetMoves, targetMoves + 1, targetMoves - 1];
    const inRegion = region === 'americas' ? pool.filter((c) => americas.has(c.iso2)) : pool;
    const starts = fresh ? inRegion.filter((c) => !recent.has(c.iso2)) : inRegion;
    if (starts.length === 0) continue;

    for (let attempt = 0; attempt < 400 && !placed; attempt++) {
      // Prefer countries the player is likelier to know, discounted by how
      // often each has already come up at either end of a level.
      const start = weightedPick(starts, starts.map((c) => weight(c.iso2)), rand);
      const distances = distancesFrom(start.iso2);
      const options = [...distances]
        .filter(([iso, d]) => allowedMoves.includes(d) && poolCodes.has(iso) && iso !== start.iso2)
        .filter(([iso]) => !fresh || !recent.has(iso))
        .filter(([iso]) => !usedPairs.has([start.iso2, iso].sort().join('-')));
      if (options.length === 0) continue;

      const destination = weightedPick(
        options.map(([iso]) => iso),
        options.map(([iso]) => weight(iso)),
        rand
      );
      record({ level, start: start.iso2, destination, moves: distances.get(destination)! });
      placed = true;
    }
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
for (const l of [1, 2, 3, 10, 25, 50, 100, 250, 500, 750, 900, LEVELS]) {
  const entry = levels[l - 1];
  console.log(
    `  ${String(l).padStart(4)}  ${String(entry.moves).padStart(2)} moves  ${name(entry.start)} -> ${name(entry.destination)}`
  );
}
// Variety: a long ladder that keeps visiting the same few countries reads as
// a short one on repeat.
const uses = new Map<string, number>();
let reusedRecently = 0;
levels.forEach((entry, i) => {
  const recent = new Set(levels.slice(Math.max(0, i - RECENT_LEVELS), i).flatMap((l) => [l.start, l.destination]));
  if (recent.has(entry.start) || recent.has(entry.destination)) reusedRecently++;
  for (const iso of [entry.start, entry.destination]) uses.set(iso, (uses.get(iso) ?? 0) + 1);
});
const mostUsed = [...uses].sort((a, b) => b[1] - a[1]).slice(0, 3);
console.log(
  `variety: ${uses.size} countries; ${reusedRecently} levels reuse one from the last ${RECENT_LEVELS}; ` +
    `most used ${mostUsed.map(([iso, n]) => `${iso} x${n}`).join(', ')}`
);
console.log(
  `americas: ${americasLevels} levels (${((100 * americasLevels) / levels.length).toFixed(1)}%), ` +
    `fair share ${(100 * AMERICAS_SHARE).toFixed(0)}% of the ${americasPossible} levels they can support`
);
const byMoves = new Map<number, number>();
for (const l of levels) byMoves.set(l.moves, (byMoves.get(l.moves) ?? 0) + 1);
console.log('moves spread:', [...byMoves].sort((a, b) => a[0] - b[0]).map(([m, n]) => `${m}:${n}`).join('  '));
