/**
 * Generates `src/data/visa-campaign.generated.json`: the Visa Denied campaign,
 * 1000 fixed levels, each a land journey with borders on the way closed.
 *
 * Part one, levels 1-100, is frozen in `scripts/data/visa-campaign-part-one.json`
 * and copied across exactly: players have progress against those levels, so
 * they can never change. They climb three ways at once -- one closed border
 * at first and four by level 100; start and destination three borders apart
 * at first and eight by the end, before the closures; and countries everyone
 * knows first, the whole map by the end. Level 1, France to Ukraine with
 * Germany closed, was chosen by hand.
 *
 * Part two, levels 101-1000, is built here, in nine waves of 100. Making each
 * level harder than the last for 900 levels would end in nothing but the
 * hardest journeys there are, so each wave climbs on its own: from fewer
 * closures on a shorter journey to more on a longer one, starting on better-
 * known countries and widening to the whole map. Both ends of the wave rise
 * from one wave to the next. As built, journeys average about 9 moves in the
 * first wave and 13 in the last, and closures about 3 a level in the first
 * three waves and nearly 4 after (aiming for more: a level closes one fewer
 * rather than reuse the same few crossroads countries).
 *
 * Throughout: every closure is on a shortest route and makes the journey
 * longer, so each one is an obstacle to plan around; no journey and no set of
 * closures is used twice; levels take turns between Europe, Asia, Africa, the
 * whole map and the Americas (which mostly pass their turn on: there is
 * little room to close anything there); and no country is closed again
 * within four levels or in more than a tenth of them, unless nothing else
 * will do. No level is longer than 14 moves.
 *
 * Takes several minutes.
 *
 * Once shipped, levels must not change. To add more, freeze what has shipped
 * as a new part and build on after it, as part two was built on part one.
 *
 * Run with: npm run build:visa
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES, getCountry } from '../src/core/world.ts';
import { distancesFrom, shortestMoveCount } from '../src/core/graph.ts';
import { closeBorders } from '../src/core/generate.ts';
import { seededRandom, weightedPick } from '../src/core/random.ts';
import type { Country } from '../src/core/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/visa-campaign.generated.json');
const PART_ONE = resolve(HERE, 'data/visa-campaign-part-one.json');

const LENGTH = 1000;
/** The waves of part two. */
const WAVE = 100;
/** No level may be longer than this, as in a random Visa Denied game. */
const MAX_MOVES = 14;

interface Level {
  level: number;
  start: string;
  destination: string;
  /** Fewest possible moves with the borders closed. */
  moves: number;
  closed: string[];
}

/** Sovereign, on the land graph and big enough to aim for: as everywhere else. */
const eligible = COUNTRIES.filter((c) => !c.territory && c.neighbours.length > 0 && c.area >= 0.25);

/**
 * How well known a country is, 0..1, by population rank. `breadth` 0 leans
 * hard on the top of the list; 1 treats every country nearly alike.
 */
const byPopulation = eligible.slice().sort((a, b) => b.population - a.population);
const rank = new Map(byPopulation.map((c, i) => [c.iso2, 1 - i / byPopulation.length]));
const fame = (iso: string, breadth: number) => 0.05 + (rank.get(iso) ?? 0) ** (3 * (1 - breadth));

// ---------------------------------------------------------------------------
// The curve for part two.
// ---------------------------------------------------------------------------
interface Shape {
  /** Borders to close. */
  closed: number;
  /** How far apart start and destination are before any closure. */
  distance: number;
  /** The most moves the level may take once its borders close. */
  longest: number;
  /** How far down the list of well-known countries to reach, 0..1. */
  breadth: number;
}

/**
 * One level of part two. Within a wave, `t` runs 0 to 1: the closures step up
 * by thirds, the distance climbs from `low` to `high`, and the detour the
 * closures may add grows with them.
 */
function shapeFor(level: number): Shape {
  const index = level - 101;
  const wave = Math.floor(index / WAVE);
  const t = (index % WAVE) / (WAVE - 1);
  // Two to four closures in waves 1-3, three to five in 4-6, four to five in 7-9.
  const fewest = 2 + Math.floor(wave / 3);
  const closed = Math.min(5, fewest + Math.min(2, Math.floor(t * 3)));
  const low = 4 + wave * 0.35;
  const high = 7 + wave * 0.25;
  const distance = Math.round(low + (high - low) * t);
  return {
    closed,
    distance,
    longest: Math.min(MAX_MOVES, distance + closed + 1 + Math.round(3 * t)),
    breadth: 0.6 + 0.4 * t,
  };
}

/**
 * Where part two's levels go, in turn: within one continent, or anywhere
 * (null), which on long journeys mostly means across two. Left to the
 * distances alone nearly every level would cross from Africa or Europe into
 * Asia through the same few countries.
 */
const THEMES: readonly (readonly string[] | null)[] = [
  ['Europe'],
  ['Asia'],
  ['Africa'],
  null,
  // The Americas are one long chain with few ways round anything: they get a
  // level where they have one to give, and the whole map takes the rest.
  ['North America', 'South America'],
  ['Europe'],
  ['Africa'],
  ['Asia'],
  null,
];

/** The most levels, as a share of those so far, that may close any one country. */
const CLOSURE_SHARE = 0.1;

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

// ---------------------------------------------------------------------------
// Build.
// ---------------------------------------------------------------------------
const levels: Level[] = [];
const pairs = new Set<string>();
const uses = new Map<string, number>();
const closures = new Map<string, number>();
const closedSets = new Set<string>();
const bump = (map: Map<string, number>, iso: string) => map.set(iso, (map.get(iso) ?? 0) + 1);
const pairKey = (a: string, b: string) => [a, b].sort().join('-');
const closedKey = (closed: Iterable<string>) => [...closed].sort().join('-');

function record(placed: Level) {
  levels.push(placed);
  pairs.add(pairKey(placed.start, placed.destination));
  bump(uses, placed.start);
  bump(uses, placed.destination);
  for (const iso of placed.closed) bump(closures, iso);
  closedSets.add(closedKey(placed.closed));
}

// Part one, exactly as it shipped.
const partOne = (JSON.parse(readFileSync(PART_ONE, 'utf8')) as { levels: Level[] }).levels;
partOne.forEach((level, i) => {
  if (level.level !== i + 1) throw new Error(`part one is out of order at ${level.level}`);
  const moves = shortestMoveCount(level.start, level.destination, false, new Set(level.closed));
  // The map changing under a shipped level would change its answer: stop.
  if (moves !== level.moves) throw new Error(`level ${level.level} is now ${moves} moves, not ${level.moves}`);
  record(level);
});

for (let level = partOne.length + 1; level <= LENGTH; level++) {
  const shape = shapeFor(level);
  const pool = byPopulation;
  const recent = new Set(levels.slice(-3).flatMap((l) => [l.start, l.destination, ...l.closed]));
  const rand = seededRandom(`borderhopper-visa:${level}`);
  const weight = (iso: string) => fame(iso, shape.breadth) / (1 + (uses.get(iso) ?? 0));
  // On the whole map, moves around it: a region the last few levels started in is
  // less likely to start the next.
  const lately = levels.slice(-4).map((l) => getCountry(l.start)!.continent);
  const region = (c: Country) => 1 / (1 + 2 * lately.filter((continent) => continent === c.continent).length);
  // Not closed again within four levels, unless nothing else will do.
  const recentlyClosed = new Set(levels.slice(-4).flatMap((l) => l.closed));
  // Nor more than its share overall: the crossroads countries, Sudan above
  // all, are on so many routes that they would otherwise close in a quarter
  // of all levels.
  const quota = Math.max(4, Math.ceil(level * CLOSURE_SHARE));
  const theme = THEMES[level % THEMES.length];
  let placed: Level | null = null;
  const why: Record<string, number> = {};
  const no = (reason: string) => void (why[reason] = (why[reason] ?? 0) + 1);

  // Loosen only if a level cannot be built, in steps: the countries just
  // used (1), the distance and the countries just closed (2), the move limit
  // for this point in the wave (3), one closure fewer (4) and, on the whole
  // map only, each country's share of closures (5). A level for one part of
  // the world that cannot be built there goes to the whole map instead.
  for (const within of theme ? [theme, null] : [null]) {
    for (let relax = 0; relax < (within ? 5 : 6) && !placed; relax++) {
      placed = buildLevel(within, relax);
    }
  }

  function buildLevel(within: readonly string[] | null, relax: number): Level | null {
    const d = shape.distance;
    // Inside one continent the map runs out sooner, so shorter journeys are
    // fine there: the closures still make the detours.
    const distances = within
      ? range(Math.max(3, d - 2 - relax), d + (relax >= 2 ? 1 : 0))
      : relax < 2 ? [d] : relax < 3 ? [d - 1, d + 1] : [d - 2, d - 1, d + 1, d + 2];
    // Last resort: one closure fewer.
    const wanted = relax < 4 ? shape.closed : shape.closed - 1;
    const inside = (iso: string) => !within || within.includes(getCountry(iso)!.continent);
    const starts = pool.filter((c) => (relax > 0 || !recent.has(c.iso2)) && inside(c.iso2));
    // Spreading levels over the less-used countries leads, late on, to the
    // edges of the map, where routes have no way round to close. The last
    // steps let that go and try harder.
    const desperate = relax >= 4;
    const pick = (iso: string) => (desperate ? fame(iso, shape.breadth) : weight(iso));
    for (let attempt = 0; attempt < (desperate ? 1500 : 300) && starts.length; attempt++) {
      const start = weightedPick(starts, starts.map((c) => pick(c.iso2) * region(c)), rand);
      const options = [...distancesFrom(start.iso2)].filter(
        ([iso, dist]) =>
          distances.includes(dist) &&
          rank.has(iso) &&
          inside(iso) &&
          !pairs.has(pairKey(start.iso2, iso)) &&
          (relax > 0 || !recent.has(iso))
      );
      if (!options.length) { no('no destination'); continue; }
      const [destination] = weightedPick(options, options.map(([iso]) => pick(iso)), rand);
      // Closures lean on the big crossroads countries, famous ones first,
      // and away from ones already closed, so it is not Russia every time.
      // Countries closed lately or too often overall are left alone, and no
      // closure may push the journey past this point in the wave's limit.
      const closed = closeBorders(start.iso2, destination, wanted, rand, {
        weight: (c: Country) =>
          (c.neighbours.length ** 1.5 * fame(c.iso2, shape.breadth)) /
          ((1 + (closures.get(c.iso2) ?? 0)) ** 2 * (recent.has(c.iso2) && relax === 0 ? 4 : 1)),
        exclude: (iso) =>
          (relax < 2 && recentlyClosed.has(iso)) || (relax < 5 && (closures.get(iso) ?? 0) >= quota),
        longest: relax < 3 ? shape.longest : MAX_MOVES,
      });
      if (!closed) { no(`cannot close ${wanted}`); continue; }
      const moves = shortestMoveCount(start.iso2, destination, false, closed)!;
      // The same closures again are the same puzzle in a new place.
      if (closedSets.has(closedKey(closed))) { no('same closures'); continue; }
      return { level, start: start.iso2, destination, moves, closed: [...closed] };
    }
    return null;
  }

  if (!placed) throw new Error(`could not build Visa Denied level ${level}: ${JSON.stringify({ shape, why })}`);
  record(placed);
}

writeFileSync(OUT, `${JSON.stringify({ generated: 'scripts/build-visa-campaign.ts', levels })}\n`);

// A summary per wave, and a few sample levels, to read the curve by eye.
const name = (iso: string) => getCountry(iso)!.name;
for (let from = 1; from <= LENGTH; from += WAVE) {
  const wave = levels.slice(from - 1, from - 1 + WAVE);
  const mean = (f: (l: Level) => number) => (wave.reduce((sum, l) => sum + f(l), 0) / wave.length).toFixed(1);
  const americas = wave.filter((l) => ['North America', 'South America'].includes(getCountry(l.start)!.continent)).length;
  console.log(
    `${String(from).padStart(4)}-${from + WAVE - 1}: moves ${mean((l) => l.moves)} ` +
      `(${Math.min(...wave.map((l) => l.moves))}-${Math.max(...wave.map((l) => l.moves))}), ` +
      `closed ${mean((l) => l.closed.length)} (${Math.min(...wave.map((l) => l.closed.length))}-${Math.max(...wave.map((l) => l.closed.length))}), ` +
      `Americas ${americas}`
  );
}
for (const n of [101, 150, 199, 200, 201, 500, 900, 1000]) {
  const l = levels[n - 1];
  console.log(`${String(n).padStart(5)}  ${name(l.start)} -> ${name(l.destination)}  ${l.moves} moves, closed ${l.closed.map(name).join(', ')}`);
}
const most = [...closures].sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log(`most closed: ${most.map(([iso, n]) => `${name(iso)} ${n}`).join(', ')}`);
console.log(`countries used: ${new Set(levels.flatMap((l) => [l.start, l.destination, ...l.closed])).size}`);
