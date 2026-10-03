import { MAP_WIDTH } from '../../core/world';

/**
 * One move of the traveller, in map units, worked out when the player enters a
 * new country: where it takes off, where it lands, and how it gets there.
 */
export interface Trip {
  from: readonly [number, number];
  to: readonly [number, number];
  /** A flight gets a long, high arc instead of a hop. */
  flown: boolean;
  /** Milliseconds in the air. */
  air: number;
  /** 1 to face east, -1 to face west: he looks where he is going. */
  facing: 1 | -1;
}

/** Shifts x by whole worlds until it is as close as it can be to `near`. */
export function nearestCopy(x: number, near: number): number {
  let shifted = x;
  while (shifted - near > MAP_WIDTH / 2) shifted -= MAP_WIDTH;
  while (near - shifted > MAP_WIDTH / 2) shifted += MAP_WIDTH;
  return shifted;
}

/**
 * Plans a move from one anchor to the next, in step with the camera.
 *
 * The explorer takes off from the copy of the old country the camera is leaving
 * and lands on the copy of the new one the camera is heading for, so it always
 * travels the way the world is sliding. Choosing "the short way" between the
 * two anchors instead looks right for France to Germany but not for the USA to
 * Russia: Russia's anchor is west of the Urals, so he would set off
 * over the Atlantic while the camera swung west over the Pacific.
 */
export function planTrip(
  from: readonly [number, number] | undefined,
  to: readonly [number, number],
  camera: { from: number; to: number; duration: number },
  flown: boolean
): Trip {
  const end: [number, number] = [nearestCopy(to[0], camera.to), to[1]];
  const start: [number, number] = from ? [nearestCopy(from[0], camera.from), from[1]] : end;
  return {
    from: start,
    to: end,
    flown,
    air: flown ? camera.duration : HOP_TIME,
    facing: end[0] < start[0] ? -1 : 1,
  };
}

/**
 * Milliseconds in the air for a hop over a border. A flight takes exactly as
 * long as the camera's journey instead, so he touches down as the
 * camera settles.
 */
export const HOP_TIME = 440;
/** Milliseconds for the squash and wobble after landing. */
export const SETTLE_TIME = 280;
/** Height of the arc at its top, in screen pixels. */
export const ARC_HEIGHT = { hop: 26, flight: 84 } as const;
