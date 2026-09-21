/**
 * Generates `src/data/world.generated.json` from Natural Earth 1:50m data.
 *
 * Run with: npm run build:data
 *
 * Three things come out of this script:
 *   1. Playable country metadata (ISO codes, canonical name, flag, aliases).
 *   2. A land-border adjacency graph, DERIVED from the geometry rather than
 *      hand-written: in a TopoJSON topology two polygons that share a border
 *      literally share an arc, so "countries that share an arc share a land
 *      border" is exact. Sea crossings share no arc and so are never neighbours.
 *   3. Pre-projected SVG path strings so the app ships no projection code and
 *      never re-projects at runtime.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import { presimplify, simplify } from 'topojson-simplify';
import { geoNaturalEarth1, geoPath, geoArea, geoCentroid, geoContains } from 'd3-geo';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import topology from 'world-atlas/countries-50m.json' with { type: 'json' };
import { NON_SOVEREIGN_ISO2, MERGE_INTO, DISPLAY_NAME, ALIASES, EXCLUDED_BORDERS } from './sovereign.ts';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

countries.registerLocale(enLocale as never);

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/world.generated.json');

/** Width of the projected canvas, in abstract map units. */
const MAP_WIDTH = 2000;
/** Decimal places kept in path data. At 2000 units wide this is sub-pixel. */
const PRECISION = 1;
/**
 * Douglas-Peucker weight (in steradians) below which points are dropped.
 * Applied to the topology, so shared border arcs stay shared and the derived
 * adjacency keeps matching what is drawn.
 */
const SIMPLIFY_WEIGHT = 0.004;
/**
 * Offshore specks below this share of a country's largest polygon are dropped.
 * Every country always keeps its largest polygon, so nothing disappears.
 */
const MIN_POLYGON_SHARE = 0.002;
/** Shortest a sea crossing may be: touching countries are a land border. */
const MIN_CROSSING_KM = 5;
/** Furthest a sea crossing may span, in kilometres. */
const MAX_CROSSING_KM = 2000;
/** How many nearby countries across water each country can fly to. */
const CROSSINGS_PER_COUNTRY = 3;
/** Coastline points kept per country when measuring water gaps. */
const CROSSING_SAMPLE = 260;
/**
 * Share of a country's largest polygon that a second polygon must reach to
 * count as part of its main landmass for camera framing.
 */
const MAIN_LANDMASS_SHARE = 0.25;
/** Natural Earth 1 puts Antarctica in a distorted band; the game never uses it. */
const EXCLUDED_NAMES = new Set(['Antarctica', 'Fr. S. Antarctic Lands', 'Heard I. and McDonald Is.']);

type NeGeom = (Polygon | MultiPolygon) & { id?: string; properties: { name: string } };

const topo = topology as unknown as Topology<{
  countries: GeometryCollection<{ name: string }>;
  land: GeometryCollection;
}>;
const rawGeometries = topo.objects.countries.geometries as unknown as NeGeom[];

// ---------------------------------------------------------------------------
// 1. Resolve every Natural Earth polygon to an owner key.
// ---------------------------------------------------------------------------
// An owner key is an ISO alpha-2 code when we can find one, otherwise a
// `ne:<name>` pseudo-key for territories ISO does not code (these are drawn but
// never playable).

interface Owner {
  key: string;
  iso2: string | null;
  name: string;
  playable: boolean;
}

const owners = new Map<string, Owner>();
/** Natural Earth geometry index -> owner key. */
const geomOwner: (string | null)[] = [];

rawGeometries.forEach((geom, i) => {
  const neName = geom.properties.name;
  if (EXCLUDED_NAMES.has(neName)) {
    geomOwner[i] = null;
    return;
  }

  let iso2: string | null = MERGE_INTO[neName] ?? null;
  if (!iso2 && geom.id && /^\d{3}$/.test(String(geom.id))) {
    iso2 = countries.numericToAlpha2(String(geom.id)) ?? null;
  }

  const key = iso2 ?? `ne:${neName}`;
  const playable = iso2 !== null && !NON_SOVEREIGN_ISO2.has(iso2);
  const name = iso2
    ? DISPLAY_NAME[iso2] ?? countries.getName(iso2, 'en') ?? neName
    : neName;

  if (!owners.has(key)) owners.set(key, { key, iso2, name, playable });
  geomOwner[i] = key;
});

// ---------------------------------------------------------------------------
// 2. Adjacency, from shared TopoJSON arcs.
// ---------------------------------------------------------------------------
// Each arc index is collected per owner. An arc referenced by two different
// owners is a stretch of shared land border between them.

function arcIndices(geom: NeGeom): number[] {
  const out: number[] = [];
  const walk = (a: unknown): void => {
    if (Array.isArray(a) && typeof a[0] === 'number') {
      for (const n of a as number[]) out.push(n < 0 ? ~n : n);
    } else if (Array.isArray(a)) {
      for (const child of a) walk(child);
    }
  };
  walk((geom as unknown as { arcs: unknown }).arcs);
  return out;
}

const arcOwners = new Map<number, Set<string>>();
rawGeometries.forEach((geom, i) => {
  const key = geomOwner[i];
  if (!key) return;
  for (const arc of arcIndices(geom)) {
    let set = arcOwners.get(arc);
    if (!set) arcOwners.set(arc, (set = new Set()));
    set.add(key);
  }
});

const neighbours = new Map<string, Set<string>>();
for (const owner of owners.values()) neighbours.set(owner.key, new Set());
for (const set of arcOwners.values()) {
  if (set.size < 2) continue;
  const keys = [...set];
  for (const a of keys) {
    for (const b of keys) {
      if (a !== b) neighbours.get(a)!.add(b);
    }
  }
}

for (const [a, b] of EXCLUDED_BORDERS) {
  const removedA = neighbours.get(a)?.delete(b);
  const removedB = neighbours.get(b)?.delete(a);
  if (!removedA || !removedB) {
    throw new Error(`EXCLUDED_BORDERS lists ${a}-${b}, which is not a border in the source data`);
  }
}

// ---------------------------------------------------------------------------
// 3. Projected geometry.
// ---------------------------------------------------------------------------

/** Expand delta-encoded, quantized arcs back to real lon/lat degrees. */
function dequantize<T extends Topology>(t: T): T {
  const transform = t.transform;
  if (!transform) return t;
  const [sx, sy] = transform.scale;
  const [tx, ty] = transform.translate;
  t.arcs = t.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty] as [number, number];
    });
  });
  delete t.transform;
  return t;
}

// Simplify for rendering only. Adjacency above was derived from the full
// topology, and simplify() preserves arc indices and geometry order.
const dequantized = dequantize(structuredClone(topo));
/**
 * Every landmass at full detail. Used to tell a sea crossing from a hop over
 * a neighbouring country -- simplified geometry would close narrow straits
 * like Gibraltar and turn them into land.
 */
const landFeature = feature(dequantized, dequantized.objects.land) as unknown as Feature<MultiPolygon>;
const simplified = simplify(presimplify(structuredClone(dequantized)), SIMPLIFY_WEIGHT);
const fc = feature(simplified, simplified.objects.countries) as unknown as FeatureCollection;
/** Merge every Natural Earth feature belonging to one owner into one shape. */
const shapes = new Map<string, Feature<MultiPolygon>>();
fc.features.forEach((f, i) => {
  const key = geomOwner[i];
  if (!key) return;
  const geom = f.geometry as Polygon | MultiPolygon;
  const polys = (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates)
    .filter((rings) => rings.length > 0 && rings[0].length >= 4);
  const existing = shapes.get(key);
  if (existing) existing.geometry.coordinates.push(...polys);
  else shapes.set(key, { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [...polys] } });
});

// Drop offshore specks, keeping each country's largest landmass.
for (const shape of shapes.values()) {
  const polys = shape.geometry.coordinates;
  if (polys.length < 2) continue;
  const areas = polys.map((rings) => geoArea({ type: 'Polygon', coordinates: rings }));
  const largest = Math.max(...areas);
  shape.geometry.coordinates = polys.filter((_, i) => areas[i] >= largest * MIN_POLYGON_SHARE);
}

// ---------------------------------------------------------------------------
// 2b. Sea crossings: the nearest countries across open water.
// ---------------------------------------------------------------------------
// Flight mode lets the player hop a stretch of water to a nearby country, so
// every country needs to know which ones are actually close to it by sea.
// This measures the real gap between coastlines rather than between centres,
// which is why the United States reaches Russia -- the Bering Strait is 82km
// even though the countries' middles are a world apart.

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = toRadians(b[1] - a[1]);
  const dLon = toRadians(b[0] - a[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Coastline points for a country, thinned to keep the pairwise sweep quick. */
function coastlineSample(shape: Feature<MultiPolygon>): [number, number][] {
  const points: [number, number][] = [];
  for (const polygon of shape.geometry.coordinates) {
    for (const ring of polygon) {
      for (const point of ring) points.push(point as [number, number]);
    }
  }
  if (points.length <= CROSSING_SAMPLE) return points;
  const step = points.length / CROSSING_SAMPLE;
  return Array.from({ length: CROSSING_SAMPLE }, (_, i) => points[Math.floor(i * step)]);
}

const playableOwners = [...owners.values()].filter((o) => o.playable && o.iso2);
const samples = new Map<string, [number, number][]>();
const sampleBounds = new Map<string, [number, number, number, number]>();
for (const owner of playableOwners) {
  const shape = shapes.get(owner.key);
  if (!shape) continue;
  const points = coastlineSample(shape);
  samples.set(owner.iso2!, points);
  sampleBounds.set(owner.iso2!, [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ]);
}

/** Cheap lower bound on the gap between two countries, for skipping pairs. */
function boundsGapKm(a: string, b: string): number {
  const [aMinX, aMinY, aMaxX, aMaxY] = sampleBounds.get(a)!;
  const [bMinX, bMinY, bMaxX, bMaxY] = sampleBounds.get(b)!;
  const dLon = Math.max(0, Math.max(aMinX - bMaxX, bMinX - aMaxX));
  const dLat = Math.max(0, Math.max(aMinY - bMaxY, bMinY - aMaxY));
  // Longitude degrees shrink towards the poles; use the equator so this stays
  // an underestimate and never prunes a pair that might qualify.
  return Math.hypot(dLon, dLat) * 111;
}

/**
 * True when the gap between two countries is open water the whole way.
 *
 * "Nearest country I share no border with" is not the same thing as a sea
 * crossing: France's nearest such country is Austria, 143km away with
 * Switzerland in between, and a landlocked country like Zimbabwe would reach
 * Madagascar by crossing Mozambique first. Requiring the whole segment to be
 * water rules both out, and lets exactly one sample fail so a lone islet in
 * the channel does not veto a real crossing.
 */
const WATER_SAMPLES = 10;
const ALLOWED_LAND_SAMPLES = 1;

function isOverWater(a: [number, number], b: [number, number]): boolean {
  // Take the short way round. Interpolating raw longitudes sends a crossing
  // between Fiji and Kiribati the wrong way across the planet, over Africa.
  let deltaLon = b[0] - a[0];
  if (deltaLon > 180) deltaLon -= 360;
  else if (deltaLon < -180) deltaLon += 360;

  const at = (t: number): [number, number] => {
    let lon = a[0] + deltaLon * t;
    if (lon > 180) lon -= 360;
    else if (lon < -180) lon += 360;
    return [lon, a[1] + (b[1] - a[1]) * t];
  };

  // Both ends must already be at sea. Checking only the overall proportion is
  // not enough: over a long enough line the land part looks like noise, which
  // is how landlocked Andorra ended up with a crossing to Malta.
  if (geoContains(landFeature, at(0.05)) || geoContains(landFeature, at(0.95))) return false;

  let onLand = 0;
  for (let i = 1; i < WATER_SAMPLES; i++) {
    if (geoContains(landFeature, at(0.05 + (0.9 * i) / WATER_SAMPLES))) {
      onLand += 1;
      if (onLand > ALLOWED_LAND_SAMPLES) return false;
    }
  }
  return true;
}

/**
 * Candidate crossings between two countries, shortest first: for each of the
 * origin's coastal points, its closest approach to the target.
 *
 * Taking only the single closest pair of points is not enough. Ukraine's
 * nearest point to Türkiye sits on its western land border, so that segment
 * starts inland and gets rejected -- while the real crossing, Crimea to the
 * Turkish coast, is a little longer and entirely at sea.
 */
function crossingSegments(from: string, to: string) {
  const fromPoints = samples.get(from)!;
  const toPoints = samples.get(to)!;
  const segments: { km: number; a: [number, number]; b: [number, number] }[] = [];
  for (const a of fromPoints) {
    let best = Infinity;
    let bestB = toPoints[0];
    for (const b of toPoints) {
      const km = haversineKm(a, b);
      if (km < best) {
        best = km;
        bestB = b;
      }
    }
    segments.push({ km: best, a, b: bestB });
  }
  return segments.sort((x, y) => x.km - y.km);
}

/** How many candidate segments to test per country pair before giving up. */
const SEGMENTS_TESTED = 8;

const crossings = new Map<string, { iso2: string; km: number }[]>();
const excluded = new Set(EXCLUDED_BORDERS.map((pair) => pair.slice().sort().join('-')));

for (const owner of playableOwners) {
  const from = owner.iso2!;
  if (!samples.has(from)) continue;
  const landNeighbours = neighbours.get(owner.key)!;

  const nearby = playableOwners
    .filter((other) => {
      const to = other.iso2!;
      return (
        to !== from &&
        !landNeighbours.has(other.key) &&
        samples.has(to) &&
        !excluded.has([from, to].sort().join('-')) &&
        boundsGapKm(from, to) <= MAX_CROSSING_KM
      );
    })
    .map((other) => ({ iso2: other.iso2!, segments: crossingSegments(from, other.iso2!) }))
    .filter((entry) => entry.segments[0].km <= MAX_CROSSING_KM)
    .sort((x, y) => x.segments[0].km - y.segments[0].km);

  const found: { iso2: string; km: number }[] = [];
  for (const entry of nearby) {
    if (found.length >= CROSSINGS_PER_COUNTRY) break;
    for (const segment of entry.segments.slice(0, SEGMENTS_TESTED)) {
      if (segment.km < MIN_CROSSING_KM || segment.km > MAX_CROSSING_KM) continue;
      if (!isOverWater(segment.a, segment.b)) continue;
      found.push({ iso2: entry.iso2, km: Math.round(segment.km) });
      break;
    }
  }
  crossings.set(from, found);

  if (process.env.CROSSING_DEBUG && process.env.CROSSING_DEBUG.split(',').includes(from)) {
    console.log(`\n  [debug] ${from}: ${found.map((f) => `${f.iso2} ${f.km}km`).join(', ') || '(none)'}`);
  }
}

// Crossings are a two-way street: if one country can fly to another, the
// return leg has to exist too, or routes would only work in one direction.
for (const [from, list] of crossings) {
  for (const { iso2: to, km } of list) {
    const back = crossings.get(to);
    if (back && !back.some((entry) => entry.iso2 === from)) back.push({ iso2: from, km });
  }
}
for (const list of crossings.values()) list.sort((a, b) => a.km - b.km);

const projection = geoNaturalEarth1();
const all: FeatureCollection = { type: 'FeatureCollection', features: [...shapes.values()] };
projection.fitWidth(MAP_WIDTH, all);
const pathGen = geoPath(projection);
const [[, minY], [, maxY]] = pathGen.bounds(all);
// Re-centre vertically so the canvas is exactly the drawn extent.
const translate = projection.translate();
projection.translate([translate[0], translate[1] - minY]);
const MAP_HEIGHT = Math.ceil(maxY - minY);

const round = (d: string): string => d.replace(/-?\d+\.\d+/g, (n) => String(Number(Number(n).toFixed(PRECISION))));

// ---------------------------------------------------------------------------
// 4. Emit.
// ---------------------------------------------------------------------------

interface OutCountry {
  iso2: string;
  iso3: string;
  name: string;
  flag: string;
  aliases: string[];
  neighbours: string[];
  /** Nearby countries across water, nearest first, for flight mode. */
  crossings: { iso2: string; km: number }[];
  /** Centre of the main landmass, in projected map units. */
  centroid: [number, number];
  /** Bounding box of the main landmass: [minX, minY, maxX, maxY]. */
  bbox: [number, number, number, number];
  area: number;
}

const flagOf = (iso2: string): string =>
  String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

const playableKeys = new Set([...owners.values()].filter((o) => o.playable).map((o) => o.key));

const outCountries: OutCountry[] = [];
const shapesOut: { key: string; d: string; playable: boolean }[] = [];

for (const owner of [...owners.values()].sort((a, b) => a.name.localeCompare(b.name))) {
  const shape = shapes.get(owner.key);
  if (!shape) continue;
  const d = round(pathGen(shape) ?? '');
  if (!d) continue;
  shapesOut.push({ key: owner.key, d, playable: owner.playable });

  if (!owner.playable || !owner.iso2) continue;
  const iso2 = owner.iso2;
  // Frame the country by its main landmass. France's polygons reach from
  // Guadeloupe to Réunion, and framing all of them would show half the planet
  // every time the player lands there.
  const polys = shape.geometry.coordinates;
  const polyAreas = polys.map((rings) => geoArea({ type: 'Polygon', coordinates: rings }));
  const largestArea = Math.max(...polyAreas);
  const mainland: Feature<MultiPolygon> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiPolygon',
      coordinates: polys.filter((_, i) => polyAreas[i] >= largestArea * MAIN_LANDMASS_SHARE),
    },
  };
  const [[x0, y0], [x1, y1]] = pathGen.bounds(mainland);
  const projected = projection(geoCentroid(mainland));
  const aliasSet = new Set<string>(ALIASES[iso2] ?? []);
  const iso3 = countries.alpha2ToAlpha3(iso2) ?? iso2;
  aliasSet.add(iso3.toLowerCase());
  aliasSet.add(iso2.toLowerCase());
  const isoEnglish = countries.getName(iso2, 'en');
  if (isoEnglish) aliasSet.add(isoEnglish.toLowerCase());
  aliasSet.delete(owner.name.toLowerCase());

  outCountries.push({
    iso2,
    iso3,
    name: owner.name,
    flag: flagOf(iso2),
    aliases: [...aliasSet].sort(),
    neighbours: [...neighbours.get(owner.key)!].filter((k) => playableKeys.has(k)).sort(),
    crossings: crossings.get(iso2) ?? [],
    centroid: projected
      ? [Number(projected[0].toFixed(1)), Number(projected[1].toFixed(1))]
      : [Number(((x0 + x1) / 2).toFixed(1)), Number(((y0 + y1) / 2).toFixed(1))],
    bbox: [x0, y0, x1, y1].map((n) => Number(n.toFixed(1))) as [number, number, number, number],
    area: Number((geoArea(shape) * 1e4).toFixed(2)),
  });
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({
    generated: 'scripts/build-country-data.ts from world-atlas/countries-50m (Natural Earth 1:50m)',
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    countries: outCountries,
    shapes: shapesOut,
  })
);

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------
const byIso = new Map(outCountries.map((c) => [c.iso2, c]));
const isolated = outCountries.filter((c) => c.neighbours.length === 0);
console.log(`playable countries : ${outCountries.length}`);
console.log(`drawn shapes       : ${shapesOut.length}`);
console.log(`canvas             : ${MAP_WIDTH} x ${MAP_HEIGHT}`);
console.log(`island nations     : ${isolated.length}`);
console.log(`output size        : ${(JSON.stringify(outCountries).length / 1024).toFixed(0)}KB meta + ${(JSON.stringify(shapesOut).length / 1024).toFixed(0)}KB paths`);

const asym = outCountries.filter((c) => c.neighbours.some((n) => !byIso.get(n)?.neighbours.includes(c.iso2)));
console.log(`asymmetric edges   : ${asym.length}`);

for (const iso of ['FR', 'ES', 'PT', 'DE', 'GB', 'US', 'SO', 'DJ', 'CN', 'IN', 'RS', 'CY', 'MA', 'MR', 'IT', 'CH', 'RU']) {
  const c = byIso.get(iso);
  console.log(`  ${iso} ${c?.name}: ${c?.neighbours.map((n) => byIso.get(n)?.name).join(', ') || '(none)'}`);
}

console.log('\nsea crossings:');
const noCrossing = outCountries.filter((c) => c.crossings.length === 0);
console.log(`  countries with none: ${noCrossing.length}${noCrossing.length ? ` (${noCrossing.map((c) => c.iso2).join(', ')})` : ''}`);
for (const iso of ['US', 'GB', 'FR', 'JP', 'IS', 'NZ', 'MG', 'CU', 'AU', 'LK', 'ID', 'PH', 'MT', 'CY']) {
  const c = byIso.get(iso);
  console.log(
    `  ${iso} ${c?.name}: ${c?.crossings.map((x) => `${byIso.get(x.iso2)?.name} ${x.km}km`).join(', ') || '(none)'}`
  );
}
