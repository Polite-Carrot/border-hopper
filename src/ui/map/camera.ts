import { LAND_BOUNDS, MAP_HEIGHT, MAP_WIDTH } from '../../core/world';

/**
 * A camera over the projected world. `k` is map-units-per-pixel; `x`/`y` is the
 * map point held at the centre of the stage's visible area.
 */
export interface Camera {
  x: number;
  y: number;
  k: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The map fills the whole screen, but the HUD and the control panel sit on top
 * of it. `visible` is the part that is actually clear, and it is what the
 * camera frames into -- so the current country lands in open space rather than
 * behind the country list.
 */
export interface Stage {
  width: number;
  height: number;
  visible: Rect;
}

export function makeStage(width: number, height: number, insets: Partial<Rect> = {}): Stage {
  const top = insets.y ?? 0;
  const left = insets.x ?? 0;
  return {
    width,
    height,
    visible: {
      x: left,
      y: top,
      width: Math.max(80, insets.width ?? width - left),
      height: Math.max(80, insets.height ?? height - top),
    },
  };
}

/**
 * Smallest slice of the world the camera will frame. Without a floor, Monaco
 * would fill the screen and the player would lose all sense of where they are.
 */
const MIN_SPAN = 175;
/** Headroom kept around the framed shape, as a multiple of its size. */
const PADDING = 2.8;
const MAX_SCALE = 26;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Fits every country into the visible area. Framed on inhabited land rather
 * than the full canvas, whose top and bottom are empty ocean.
 */
export function worldCamera(stage: Stage): Camera {
  const [x0, y0, x1, y1] = LAND_BOUNDS;
  const k = Math.min(stage.visible.width / (x1 - x0), stage.visible.height / (y1 - y0));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, k };
}

/**
 * Frames one or more bounding boxes with room to breathe, never zooming in
 * past `MIN_SPAN` or out past the whole world.
 */
export function frameBoxes(
  boxes: readonly (readonly [number, number, number, number])[],
  stage: Stage
): Camera {
  const x0 = Math.min(...boxes.map((b) => b[0]));
  const y0 = Math.min(...boxes.map((b) => b[1]));
  const x1 = Math.max(...boxes.map((b) => b[2]));
  const y1 = Math.max(...boxes.map((b) => b[3]));

  const { width, height } = stage.visible;
  const aspect = height / width;
  const spanX = Math.max((x1 - x0) * PADDING, MIN_SPAN);
  const spanY = Math.max((y1 - y0) * PADDING, MIN_SPAN * aspect);

  const minScale = Math.min(stage.width / MAP_WIDTH, stage.height / MAP_HEIGHT);
  const k = clamp(Math.min(width / spanX, height / spanY), minScale, MAX_SCALE);

  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, k };
}

/**
 * Converts a camera into the translation a map-space `<G>` needs. With the
 * group's transform origin at (0,0), a map point p is drawn at `p * k + offset`.
 */
export function cameraOffset(camera: Camera, stage: Stage): { x: number; y: number } {
  const { visible } = stage;
  return {
    x: visible.x + visible.width / 2 - camera.x * camera.k,
    y: visible.y + visible.height / 2 - camera.y * camera.k,
  };
}

/** Where a map point ends up on screen under a given camera. */
export function projectToScreen(
  point: readonly [number, number],
  camera: Camera,
  stage: Stage
): { x: number; y: number } {
  const offset = cameraOffset(camera, stage);
  return { x: point[0] * camera.k + offset.x, y: point[1] * camera.k + offset.y };
}
