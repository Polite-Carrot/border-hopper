declare module 'polylabel' {
  /**
   * The point inside a polygon furthest from its edges (the "pole of
   * inaccessibility"). `polygon` is GeoJSON-style rings: the outline first,
   * then any holes. The result also carries that distance.
   */
  export default function polylabel(
    polygon: number[][][],
    precision?: number,
    debug?: boolean
  ): [number, number] & { distance: number };
}
