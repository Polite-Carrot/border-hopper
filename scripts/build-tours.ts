/**
 * Generates `src/data/tours.generated.json`: the continent tours.
 *
 * A tour is a short, themed run of land levels -- 20 to 30 -- with every start
 * and destination in one part of the world, ending in a passport badge. Each
 * climbs from two moves to the longest routes its region has, and opens on
 * countries people know before reaching the ones they may not.
 *
 * Built once, like the campaign, so every player gets the same tours. Once
 * they have shipped, regenerating them would move players' progress onto
 * different journeys: change this script only to add a tour, and keep the
 * existing ones' levels as they are.
 *
 * Run with: npm run build:tours
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES, getCountry } from '../src/core/world.ts';
import { distancesFrom } from '../src/core/graph.ts';
import { seededRandom, weightedPick } from '../src/core/random.ts';
import type { Continent, Country } from '../src/core/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/tours.generated.json');

/** Sovereign, on the land graph and big enough to aim for: as everywhere else. */
const eligible = COUNTRIES.filter((c) => !c.territory && c.neighbours.length > 0 && c.area >= 0.25);
const on = (...continents: Continent[]) => eligible.filter((c) => continents.includes(c.continent));

interface Spec {
  id: string;
  length: number;
  /** Where levels start, and where they end. */
  starts: Country[];
  ends: Country[];
  /** Route length of the first level and the last. */
  shortest: number;
  longest: number;
  /** The opening level, chosen by hand so every tour starts somewhere everyone knows. */
  first: [string, string];
}

const TOURS: Spec[] = [
  { id: 'europe', length: 30, starts: on('Europe'), ends: on('Europe'), shortest: 2, longest: 7, first: ['ES', 'IT'] },
  { id: 'africa', length: 30, starts: on('Africa'), ends: on('Africa'), shortest: 2, longest: 10, first: ['ZA', 'ZM'] },
  { id: 'asia', length: 30, starts: on('Asia'), ends: on('Asia'), shortest: 2, longest: 10, first: ['IN', 'TH'] },
  {
    id: 'americas',
    length: 25,
    starts: on('North America', 'South America'),
    ends: on('North America', 'South America'),
    shortest: 2,
    longest: 10,
    first: ['US', 'GT'],
  },
  // Overland from Europe into Asia: every level starts in Europe and ends in Asia.
  { id: 'silk-road', length: 20, starts: on('Europe'), ends: on('Asia'), shortest: 2, longest: 11, first: ['GR', 'IR'] },
];

/**
 * How well known a country is, 0..1, by population rank: early levels lean
 * hard on the top of the list, later ones barely at all.
 */
const byPopulation = eligible.slice().sort((a, b) => b.population - a.population);
const rank = new Map(byPopulation.map((c, i) => [c.iso2, 1 - i / byPopulation.length]));
const weight = (iso: string, progress: number, uses: number) =>
  (0.05 + rank.get(iso)! ** (3 * (1 - progress))) / (1 + uses);

interface Level {
  level: number;
  start: string;
  destination: string;
  moves: number;
}

function buildTour(spec: Spec): Level[] {
  const levels: Level[] = [];
  const used = new Set<string>();
  const uses = new Map<string, number>();
  const endCodes = new Set(spec.ends.map((c) => c.iso2));

  const record = (placed: Level) => {
    levels.push(placed);
    used.add([placed.start, placed.destination].sort().join('-'));
    for (const iso of [placed.start, placed.destination]) uses.set(iso, (uses.get(iso) ?? 0) + 1);
  };
  const [firstStart, firstEnd] = spec.first;
  const firstMoves = distancesFrom(firstStart).get(firstEnd);
  if (firstMoves !== spec.shortest) throw new Error(`${spec.id}: first level is ${firstMoves} moves, not ${spec.shortest}`);
  record({ level: 1, start: firstStart, destination: firstEnd, moves: firstMoves });

  for (let level = 2; level <= spec.length; level++) {
    const progress = (level - 1) / (spec.length - 1);
    // The first third draws only on the better-known half of the region,
    // widening to all of it by the end.
    const reach = (list: Country[]) => {
      const sorted = list.slice().sort((a, b) => b.population - a.population);
      return sorted.slice(0, Math.ceil(sorted.length * Math.min(1, 0.45 + progress)));
    };
    const target = Math.round(spec.shortest + (spec.longest - spec.shortest) * progress);
    const rand = seededRandom(`borderhopper-tour:${spec.id}:${level}`);
    const recent = new Set(levels.slice(-2).flatMap((l) => [l.start, l.destination]));
    let placed: Level | null = null;

    // Loosen only if a level cannot be built: variety first, then the length.
    for (let relax = 0; relax < 4 && !placed; relax++) {
      const lengths = relax < 2 ? [target] : relax < 3 ? [target - 1, target + 1] : [target - 2, target + 2];
      const pool = relax < 3 ? reach(spec.starts) : spec.starts;
      const endPool = new Set((relax < 3 ? reach(spec.ends) : spec.ends).map((c) => c.iso2));
      const starts = pool.filter((c) => relax > 0 || !recent.has(c.iso2));
      for (let attempt = 0; attempt < 300 && !placed && starts.length; attempt++) {
        const start = weightedPick(starts, starts.map((c) => weight(c.iso2, progress, uses.get(c.iso2) ?? 0)), rand);
        const options = [...distancesFrom(start.iso2)].filter(
          ([iso, d]) =>
            lengths.includes(d) &&
            endCodes.has(iso) &&
            endPool.has(iso) &&
            iso !== start.iso2 &&
            !used.has([start.iso2, iso].sort().join('-')) &&
            (relax > 0 || !recent.has(iso))
        );
        if (!options.length) continue;
        const [destination, moves] = weightedPick(
          options,
          options.map(([iso]) => weight(iso, progress, uses.get(iso) ?? 0)),
          rand
        );
        placed = { level, start: start.iso2, destination, moves };
      }
    }
    if (!placed) throw new Error(`could not build ${spec.id} level ${level}`);
    record(placed);
  }
  return levels;
}

const tours = TOURS.map((spec) => ({ id: spec.id, levels: buildTour(spec) }));
writeFileSync(OUT, `${JSON.stringify({ generated: 'scripts/build-tours.ts', tours })}\n`);

const name = (iso: string) => getCountry(iso)!.name;
for (const tour of tours) {
  const first = tour.levels[0];
  const last = tour.levels[tour.levels.length - 1];
  const countries = new Set(tour.levels.flatMap((l) => [l.start, l.destination]));
  console.log(
    `${tour.id.padEnd(10)} ${tour.levels.length} levels, ${countries.size} countries, moves ` +
      `${tour.levels.map((l) => l.moves).join(' ')}\n` +
      `           first ${name(first.start)} -> ${name(first.destination)}; last ${name(last.start)} -> ${name(last.destination)}`
  );
}
