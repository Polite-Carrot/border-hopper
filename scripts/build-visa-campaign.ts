/**
 * Generates `src/data/visa-campaign.generated.json`: the Visa Denied campaign.
 *
 * 100 fixed levels, each a land journey with borders on the way closed. It
 * climbs three ways at once:
 *   - closed borders: one for levels 1-25, two to 60, three to 90, four to 100;
 *   - distance: start and destination begin three borders apart, before any
 *     closure, and end eight apart, with the detours the closures force
 *     growing from a step or two to as many as six;
 *   - familiarity: the early levels start, end and close in countries everyone
 *     knows, widening to the whole map by the end.
 * Every closure is on a shortest route and makes the journey longer, so each
 * one is an obstacle the player has to plan around. Level 1 is chosen by
 * hand; the rest move around the world, with about one in nine in the
 * Americas, and rotate which countries close.
 *
 * Built once, like the campaign, so every player gets the same levels. Once
 * shipped, regenerating would move players' progress onto different
 * journeys: only extend it, and keep the levels already there as they are.
 *
 * Run with: npm run build:visa
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES, getCountry } from '../src/core/world.ts';
import { distancesFrom, shortestMoveCount } from '../src/core/graph.ts';
import { closeBorders } from '../src/core/generate.ts';
import { seededRandom, weightedPick } from '../src/core/random.ts';
import type { Country } from '../src/core/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/visa-campaign.generated.json');

const LENGTH = 100;

/** How many borders a level closes. */
const closedFor = (level: number) => (level <= 25 ? 1 : level <= 60 ? 2 : level <= 90 ? 3 : 4);

/** Sovereign, on the land graph and big enough to aim for: as everywhere else. */
const eligible = COUNTRIES.filter((c) => !c.territory && c.neighbours.length > 0 && c.area >= 0.25);

/**
 * How well known a country is, 0..1, by population rank: early levels lean
 * hard on the top of the list, later ones barely at all.
 */
const byPopulation = eligible.slice().sort((a, b) => b.population - a.population);
const rank = new Map(byPopulation.map((c, i) => [c.iso2, 1 - i / byPopulation.length]));
const fame = (iso: string, progress: number) => 0.05 + (rank.get(iso) ?? 0) ** (3 * (1 - progress));

interface Level {
  level: number;
  start: string;
  destination: string;
  /** Fewest possible moves with the borders closed. */
  moves: number;
  closed: string[];
}

/**
 * The opening level, chosen by hand: France to Ukraine is a straight line
 * through Germany, so with Germany closed the way round is easy to see.
 */
const FIRST = { start: 'FR', destination: 'UA', closed: ['DE'] };

/**
 * The longest a level may become once its borders close: a gentle detour at
 * first, growing to the full limit by the end.
 */
const longestFor = (target: number, wanted: number, progress: number) =>
  Math.min(14, target + wanted + 1 + Math.round(4 * progress));

const levels: Level[] = [];
const pairs = new Set<string>();
const uses = new Map<string, number>();
const closures = new Map<string, number>();
const closedSets = new Set<string>();
const bump = (map: Map<string, number>, iso: string) => map.set(iso, (map.get(iso) ?? 0) + 1);

{
  const moves = shortestMoveCount(FIRST.start, FIRST.destination, false, new Set(FIRST.closed));
  if (moves === null) throw new Error('first level has no route');
  levels.push({ level: 1, ...FIRST, moves });
  pairs.add([FIRST.start, FIRST.destination].sort().join('-'));
  bump(uses, FIRST.start);
  bump(uses, FIRST.destination);
  for (const iso of FIRST.closed) bump(closures, iso);
}

for (let level = 2; level <= LENGTH; level++) {
  const progress = (level - 1) / (LENGTH - 1);
  const wanted = closedFor(level);
  // Three borders apart at the start, eight by the end, before any closure.
  const target = Math.round(3 + 5 * progress);
  // The first third draws only on the better-known half of the world.
  const pool = byPopulation.slice(0, Math.ceil(byPopulation.length * Math.min(1, 0.4 + progress)));
  const poolCodes = new Set(pool.map((c) => c.iso2));
  const recent = new Set(levels.slice(-3).flatMap((l) => [l.start, l.destination, ...l.closed]));
  const rand = seededRandom(`borderhopper-visa:${level}`);
  const weight = (iso: string) => fame(iso, progress) / (1 + (uses.get(iso) ?? 0));
  // Moves around the world: a region the last few levels started in is
  // less likely to start the next.
  const lately = levels.slice(-4).map((l) => getCountry(l.start)!.continent);
  const region = (c: Country) => 1 / (1 + 2 * lately.filter((continent) => continent === c.continent).length);
  const longest = longestFor(target, wanted, progress);
  // The Americas are one long chain with few ways round anything, so they
  // seldom win a free draw against Europe, Africa and Asia. About one level
  // in nine is theirs.
  const americas = level % 9 === 4;
  let placed: Level | null = null;

  // Loosen only if a level cannot be built: variety first, then the
  // distance. An Americas level that cannot be built even one move longer
  // or shorter goes to the rest of the world instead.
  for (const onlyAmericas of americas ? [true, false] : [false]) {
    for (let relax = 0; relax < (onlyAmericas ? 3 : 4) && !placed; relax++) {
      placed = buildLevel(onlyAmericas, relax);
    }
  }

  function buildLevel(onlyAmericas: boolean, relax: number): Level | null {
    const distances = relax < 2 ? [target] : relax < 3 ? [target - 1, target + 1] : [target - 2, target + 2];
    const starts = pool.filter(
      (c) =>
        (relax > 0 || !recent.has(c.iso2)) &&
        (!onlyAmericas || c.continent === 'North America' || c.continent === 'South America')
    );
    for (let attempt = 0; attempt < 300 && starts.length; attempt++) {
      const start = weightedPick(starts, starts.map((c) => weight(c.iso2) * region(c)), rand);
      const options = [...distancesFrom(start.iso2)].filter(
        ([iso, d]) =>
          distances.includes(d) &&
          poolCodes.has(iso) &&
          !pairs.has([start.iso2, iso].sort().join('-')) &&
          (relax > 0 || !recent.has(iso))
      );
      if (!options.length) continue;
      const [destination] = weightedPick(options, options.map(([iso]) => weight(iso)), rand);
      // Closures lean on the big crossroads countries, famous ones first,
      // and away from ones already closed, so it is not Russia every time.
      const closed = closeBorders(
        start.iso2,
        destination,
        wanted,
        rand,
        (c: Country) =>
          (c.neighbours.length ** 1.5 * fame(c.iso2, progress)) /
          ((1 + (closures.get(c.iso2) ?? 0)) ** 2 * (recent.has(c.iso2) && relax === 0 ? 4 : 1))
      );
      if (!closed) continue;
      const moves = shortestMoveCount(start.iso2, destination, false, closed)!;
      if (moves > longest && relax < 3) continue;
      // The same closures again are the same puzzle in a new place.
      const closedKey = [...closed].sort().join('-');
      if (closedSets.has(closedKey) && (relax < 2 || onlyAmericas)) continue;
      return { level, start: start.iso2, destination, moves, closed: [...closed] };
    }
    return null;
  }

  if (!placed) throw new Error(`could not build Visa Denied level ${level}`);
  levels.push(placed);
  pairs.add([placed.start, placed.destination].sort().join('-'));
  bump(uses, placed.start);
  bump(uses, placed.destination);
  for (const iso of placed.closed) bump(closures, iso);
  closedSets.add(placed.closed.slice().sort().join('-'));
}

writeFileSync(OUT, `${JSON.stringify({ generated: 'scripts/build-visa-campaign.ts', levels })}\n`);

const name = (iso: string) => getCountry(iso)!.name;
for (const l of levels) {
  const open = shortestMoveCount(l.start, l.destination)!;
  console.log(
    `${String(l.level).padStart(3)}  ${name(l.start)} -> ${name(l.destination)}  ` +
      `${open} -> ${l.moves} moves, closed ${l.closed.map(name).join(', ')}`
  );
}
const most = [...closures].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log(`most closed: ${most.map(([iso, n]) => `${name(iso)} ${n}`).join(', ')}`);
console.log(`countries used: ${new Set(levels.flatMap((l) => [l.start, l.destination, ...l.closed])).size}`);
