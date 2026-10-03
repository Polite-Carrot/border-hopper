import { describe, expect, it } from 'vitest';
import { MAP_WIDTH, requireCountry } from '../src/core/world';
import { frameBoxes, makeStage, nearestTurn, recentre } from '../src/ui/map/camera';
import { nearestCopy, planTrip } from '../src/ui/map/trip';

const PHONE = makeStage(430, 932, { y: 120, height: 430 });

/** The camera move WorldMap makes when the player goes from one country to another. */
function cameraMove(fromIso: string, toIso: string) {
  const start = frameBoxes([requireCountry(fromIso).bbox], PHONE);
  return recentre(start, nearestTurn(frameBoxes([requireCountry(toIso).bbox], PHONE), start));
}

function tripBetween(fromIso: string, toIso: string, flown = false) {
  const move = cameraMove(fromIso, toIso);
  return {
    move,
    trip: planTrip(requireCountry(fromIso).anchor, requireCountry(toIso).anchor, { from: move.from.x, to: move.to.x, duration: 1100 }, flown),
  };
}

describe('traveller trips', () => {
  it('hops between neighbours in place, facing the way it goes', () => {
    const { trip } = tripBetween('FR', 'DE');
    expect(trip.from).toEqual(requireCountry('FR').anchor);
    expect(trip.to).toEqual(requireCountry('DE').anchor);
    expect(trip.facing).toBe(1);
    expect(tripBetween('DE', 'FR').trip.facing).toBe(-1);
  });

  it('hops quickly over a border but flies as long as the camera travels', () => {
    expect(tripBetween('FR', 'DE').trip.air).toBeLessThan(600);
    expect(tripBetween('TR', 'WS', true).trip.air).toBe(1100);
  });

  it('always travels the same way as the camera', () => {
    // The USA to Russia: the camera swings west over the Pacific, and Russia's
    // anchor sits west of the Urals, so the short way between the two anchors
    // would be east over the Atlantic -- against the camera.
    for (const [a, b] of [['US', 'RU'], ['RU', 'US'], ['JP', 'US'], ['US', 'JP'], ['FJ', 'AU'], ['NZ', 'CL'], ['FR', 'DE']]) {
      const { move, trip } = tripBetween(a, b, true);
      const cameraWay = Math.sign(move.to.x - move.from.x);
      const carrotWay = Math.sign(trip.to[0] - trip.from[0]);
      if (cameraWay !== 0 && carrotWay !== 0) expect(carrotWay, `${a}-${b}`).toBe(cameraWay);
      // And it ends up standing where the camera is looking.
      expect(Math.abs(trip.to[0] - move.to.x), `${a}-${b}`).toBeLessThan(MAP_WIDTH / 2);
    }
  });

  it('stands still on the first country, with nowhere to come from', () => {
    const jp = requireCountry('JP').anchor;
    const trip = planTrip(undefined, jp, { from: jp[0] - MAP_WIDTH, to: jp[0] - MAP_WIDTH, duration: 0 }, false);
    expect(trip.to[0]).toBeCloseTo(jp[0] - MAP_WIDTH, 5);
    expect(trip.from).toBe(trip.to);
  });

  it('never moves a point by anything but whole worlds', () => {
    for (const [x, near] of [[10, 1990], [1990, 10], [500, 500], [1200, -900]]) {
      const shifted = nearestCopy(x, near);
      expect(Math.abs(shifted - near)).toBeLessThanOrEqual(MAP_WIDTH / 2);
      expect(((shifted - x) / MAP_WIDTH) % 1).toBeCloseTo(0, 9);
    }
  });
});

describe('camera recentring', () => {
  it('keeps flying west round the world on the middle copy', () => {
    // Round and round the Pacific, westward, many times over. Without
    // recentring the camera ends up past the last tiled copy of the world.
    const legs = ['US', 'JP', 'IN', 'FR', 'US', 'JP', 'IN', 'FR', 'US', 'JP', 'IN', 'FR', 'US'];
    let camera = frameBoxes([requireCountry(legs[0]).bbox], PHONE);
    for (const iso of legs.slice(1)) {
      const move = recentre(camera, nearestTurn(frameBoxes([requireCountry(iso).bbox], PHONE), camera));
      expect(move.to.x, iso).toBeGreaterThanOrEqual(0);
      expect(move.to.x, iso).toBeLessThan(MAP_WIDTH);
      // The start is shifted by the same amount, so the move looks the same.
      expect(Math.abs(move.to.x - move.from.x), iso).toBeLessThanOrEqual(MAP_WIDTH / 2);
      camera = move.to;
    }
  });

  it('leaves a move already on the middle copy untouched', () => {
    const from = frameBoxes([requireCountry('FR').bbox], PHONE);
    const to = frameBoxes([requireCountry('DE').bbox], PHONE);
    const move = recentre(from, to);
    expect(move.from).toBe(from);
    expect(move.to).toBe(to);
  });
});
