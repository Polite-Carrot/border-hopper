import { SHAPES } from '../../core/world';

/** Path data by country/territory key, for drawing highlights on top of the base map. */
export const PATH_BY_KEY: Record<string, string> = Object.fromEntries(
  SHAPES.map((shape) => [shape.key, shape.d])
);

export const BASE_SHAPES = SHAPES;
