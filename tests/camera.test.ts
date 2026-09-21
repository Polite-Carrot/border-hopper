import { describe, expect, it } from 'vitest';
import { cameraOffset, frameBoxes, makeStage, projectToScreen, worldCamera } from '../src/ui/map/camera';
import { LAND_BOUNDS, MAP_HEIGHT, MAP_WIDTH, requireCountry } from '../src/core/world';

const PHONE = makeStage(430, 932, { y: 120, height: 430 });
const DESKTOP = makeStage(1440, 900, { y: 100, width: 1040, height: 800 });

describe('map camera', () => {
  it('puts the framed centre in the middle of the visible area', () => {
    const camera = frameBoxes([requireCountry('FR').bbox], PHONE);
    const centre = projectToScreen([camera.x, camera.y], camera, PHONE);
    expect(centre.x).toBeCloseTo(PHONE.visible.x + PHONE.visible.width / 2, 5);
    expect(centre.y).toBeCloseTo(PHONE.visible.y + PHONE.visible.height / 2, 5);
  });

  it('keeps the framed country inside the visible area', () => {
    for (const iso of ['FR', 'PT', 'RU', 'LU', 'CL', 'US', 'IN', 'VA']) {
      const country = requireCountry(iso);
      const camera = frameBoxes([country.bbox], PHONE);
      const centre = projectToScreen(country.centroid, camera, PHONE);
      expect(centre.x, iso).toBeGreaterThanOrEqual(0);
      expect(centre.x, iso).toBeLessThanOrEqual(PHONE.width);
      expect(centre.y, iso).toBeGreaterThanOrEqual(0);
      expect(centre.y, iso).toBeLessThanOrEqual(PHONE.height);
    }
  });

  it('frames a small country wider than the country itself', () => {
    const luxembourg = requireCountry('LU');
    const camera = frameBoxes([luxembourg.bbox], PHONE);
    const visibleSpan = PHONE.visible.width / camera.k;
    expect(visibleSpan).toBeGreaterThan(luxembourg.bbox[2] - luxembourg.bbox[0]);
    // ...but not so wide that the player loses track of where they are.
    expect(visibleSpan).toBeLessThan(MAP_WIDTH / 4);
  });

  it('zooms out for a pair of far-apart countries', () => {
    const near = frameBoxes([requireCountry('FR').bbox], PHONE);
    const far = frameBoxes([requireCountry('FR').bbox, requireCountry('CN').bbox], PHONE);
    expect(far.k).toBeLessThan(near.k);
  });

  it('never zooms out past the whole map', () => {
    const camera = frameBoxes([[0, 0, MAP_WIDTH, MAP_HEIGHT]], PHONE);
    expect(camera.k).toBeGreaterThanOrEqual(Math.min(430 / MAP_WIDTH, 932 / MAP_HEIGHT));
  });

  it('fits every country into the world view', () => {
    const camera = worldCamera(DESKTOP);
    const [x0, y0, x1, y1] = LAND_BOUNDS;
    for (const corner of [[x0, y0], [x1, y1]] as [number, number][]) {
      const point = projectToScreen(corner, camera, DESKTOP);
      expect(point.x).toBeGreaterThanOrEqual(DESKTOP.visible.x - 1);
      expect(point.x).toBeLessThanOrEqual(DESKTOP.visible.x + DESKTOP.visible.width + 1);
      expect(point.y).toBeGreaterThanOrEqual(DESKTOP.visible.y - 1);
      expect(point.y).toBeLessThanOrEqual(DESKTOP.visible.y + DESKTOP.visible.height + 1);
    }
  });

  it('offsets around the panel rather than the screen centre', () => {
    const camera = { x: 1000, y: 400, k: 1 };
    const full = cameraOffset(camera, makeStage(1000, 1000));
    const withPanel = cameraOffset(camera, makeStage(1000, 1000, { width: 600 }));
    expect(withPanel.x).toBeLessThan(full.x);
  });

  it('survives a degenerate viewport', () => {
    const tiny = makeStage(0, 0);
    const camera = frameBoxes([requireCountry('FR').bbox], tiny);
    expect(Number.isFinite(camera.k)).toBe(true);
    expect(camera.k).toBeGreaterThan(0);
  });
});
