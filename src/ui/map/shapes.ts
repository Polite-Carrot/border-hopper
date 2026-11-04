import { SHAPES } from '../../core/world';

/** Path data by country/territory key, for drawing highlights on top of the base map. */
export const PATH_BY_KEY: Record<string, string> = Object.fromEntries(
  SHAPES.map((shape) => [shape.key, shape.d])
);

export const BASE_SHAPES = SHAPES;

const pointsCache = new Map<string, [number, number][]>();

/** Every vertex of a country's outline, read once from its path data. */
function outlinePoints(key: string): [number, number][] {
  let points = pointsCache.get(key);
  if (!points) {
    const numbers = (PATH_BY_KEY[key] ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    points = [];
    for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]]);
    pointsCache.set(key, points);
  }
  return points;
}

/**
 * The point of a country's outline nearest to `near`, on whichever wrapped
 * copy of the world is closest. Used to aim at the border actually being
 * crossed: Russia's middle is in Europe, but from North Korea its border is a
 * short hop north-east.
 */
export function nearestOutlinePoint(
  key: string,
  near: readonly [number, number],
  mapWidth: number
): [number, number] | null {
  let best: [number, number] | null = null;
  let bestDistance = Infinity;
  for (const [x, y] of outlinePoints(key)) {
    for (const shift of [-mapWidth, 0, mapWidth]) {
      const distance = Math.hypot(x + shift - near[0], y - near[1]);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = [x + shift, y];
      }
    }
  }
  return best;
}
