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
import { geoNaturalEarth1, geoPath, geoArea, geoCentroid } from 'd3-geo';
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
/** Natural Earth 1 puts Antarctica in a distorted band; the game never uses it. */
const EXCLUDED_NAMES = new Set(['Antarctica', 'Fr. S. Antarctic Lands', 'Heard I. and McDonald Is.']);

type NeGeom = (Polygon | MultiPolygon) & { id?: string; properties: { name: string } };

const topo = topology as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
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
const simplified = simplify(presimplify(dequantize(structuredClone(topo))), SIMPLIFY_WEIGHT);
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
  centroid: [number, number];
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
  const [x0, y0, x1, y1] = [...pathGen.bounds(shape)[0], ...pathGen.bounds(shape)[1]];
  const geoCentre = geoCentroid(shape);
  const projected = projection(geoCentre);
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
