import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, type View } from 'react-native';

/**
 * How far in the player may take the map, relative to the framed view. How
 * far out depends on the country -- out to the whole world -- so it comes in
 * as an option rather than a constant.
 */
const MAX_SCALE = 9;
/** One press of the zoom buttons doubles or halves the scale. */
const BUTTON_STEP = 2;
/** Scales this close to a limit count as at it, so a button greys out cleanly. */
const EPSILON = 1e-3;
/** Finger travel, in pixels, before a drag counts as a drag rather than a tap. */
const DRAG_SLOP = 3;

export interface MapGestures {
  /** Spread onto the map's container view. */
  panHandlers: Record<string, unknown>;
  containerRef: React.RefObject<View | null>;
  /** Animated transform applied on top of the camera. */
  transform: {
    scale: Animated.Value;
    translateX: Animated.Value;
    translateY: Animated.Value;
  };
  /** True once the player has moved the map away from the framed view. */
  adjusted: boolean;
  /** Eases the map back to wherever the camera is pointing. */
  reset: (animated?: boolean) => void;
  /**
   * One step in (+1) or out (-1), about a point given relative to the middle
   * of the view -- the zoom buttons, which want the middle of the visible map
   * to stay put rather than the middle of the screen.
   */
  zoomStep: (direction: 1 | -1, focal: { x: number; y: number }, animated?: boolean) => void;
  /** False at the zoom limits, so the buttons can say so. */
  canZoomIn: boolean;
  canZoomOut: boolean;
}

export interface MapGestureOptions {
  /**
   * The furthest out the map may go, as a scale on the framed view: whatever
   * fits the whole world in. Anything above 1 is treated as 1, so the framed
   * view is always reachable.
   */
  minScale?: number;
}

const distance = (a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }) =>
  Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Pinch-to-zoom and drag-to-pan over the map.
 *
 * This sits *on top of* the camera rather than replacing it: the camera still
 * frames each country as the player travels, and this lets them look around
 * within that framing. The transform is driven straight into Animated values
 * from the gesture, so dragging never re-renders the map.
 */
export function useMapGestures(
  size: { width: number; height: number },
  /** On-screen size of one copy of the world under the current camera. */
  world: { width: number; height: number },
  options: MapGestureOptions = {}
): MapGestures {
  const containerRef = useRef<View | null>(null);
  const [adjusted, setAdjusted] = useState(false);
  const minScale = useRef(1);
  minScale.current = Math.min(1, options.minScale ?? 1);

  // Whether each button has anywhere left to go. Kept as state, but only set
  // when it actually changes: `apply` runs on every frame of a pinch.
  const [limits, setLimits] = useState({ canZoomIn: true, canZoomOut: minScale.current < 1 - EPSILON });
  const limitsRef = useRef(limits);
  const report = useCallback((scale: number) => {
    const next = {
      canZoomIn: scale < MAX_SCALE - EPSILON,
      canZoomOut: scale > minScale.current + EPSILON,
    };
    if (next.canZoomIn !== limitsRef.current.canZoomIn || next.canZoomOut !== limitsRef.current.canZoomOut) {
      limitsRef.current = next;
      setLimits(next);
    }
  }, []);

  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Plain mirrors of the animated values. Animated does not expose its current
  // value synchronously, and a gesture needs it on every frame.
  const current = useRef({ scale: 1, x: 0, y: 0 });
  // `dx`/`dy` is the PanResponder's running offset when this phase began, and
  // `touches` how many fingers it began with: a change of either starts afresh.
  const gestureStart = useRef({ scale: 1, x: 0, y: 0, distance: 0, focalX: 0, focalY: 0, dx: 0, dy: 0, touches: 0 });

  /**
   * Transforms are applied about the view's centre, and focal points are
   * measured from there. The map fills the screen, so its untransformed centre
   * is simply the middle of it -- measuring the node instead would return the
   * already-transformed box and send the focal point drifting.
   */
  const centre = useRef({ x: size.width / 2, y: size.height / 2 });
  centre.current = { x: size.width / 2, y: size.height / 2 };

  const bounds = useRef({ size, world });
  bounds.current = { size, world };

  /**
   * Folds the horizontal offset back inside one world width.
   *
   * The map is drawn as three copies of the canvas side by side, so moving it
   * by exactly one world width changes nothing on screen -- which means the
   * player can keep dragging west forever and the offset never grows. Without
   * this, three copies would only buy one world width of dragging before the
   * edge showed up again.
   */
  const wrapX = (x: number, scale: number): number => {
    const period = bounds.current.world.width * scale;
    if (!(period > 1)) return x;
    return (((x + period / 2) % period) + period) % period - period / 2;
  };

  /**
   * Vertical drag has no wrap -- there is no world north of the north pole --
   * so it is bounded instead, keeping a good part of the map on screen. The
   * allowance grows with the zoom, so looking around a country close up is
   * never cramped.
   */
  const clampY = (y: number, scale: number): number => {
    const { size: view, world: canvas } = bounds.current;
    const slack = Math.max(
      view.height * 0.4,
      (canvas.height * scale - view.height) / 2 + view.height * 0.4
    );
    return clamp(y, -slack, slack);
  };

  const apply = useCallback(
    (next: { scale: number; x: number; y: number }) => {
      const settled = {
        scale: next.scale,
        x: wrapX(next.x, next.scale),
        y: clampY(next.y, next.scale),
      };
      current.current = settled;
      scale.setValue(settled.scale);
      translateX.setValue(settled.x);
      translateY.setValue(settled.y);
      report(settled.scale);
    },
    [scale, translateX, translateY, report]
  );

  const markAdjusted = useCallback(() => setAdjusted(true), []);

  const reset = useCallback(
    (animated = true) => {
      setAdjusted(false);
      current.current = { scale: 1, x: 0, y: 0 };
      report(1);
      if (!animated) {
        scale.setValue(1);
        translateX.setValue(0);
        translateY.setValue(0);
        return;
      }
      // JS driver, not native. These values drive an SVG group's props rather
      // than a View's style, and the native driver cannot animate those: on
      // web it warns and falls back, but on a device it throws. They are also
      // written every frame by `apply` during a gesture, which the native
      // driver forbids on a value it has taken ownership of.
      const config = { duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false };
      Animated.parallel([
        Animated.timing(scale, { ...config, toValue: 1 }),
        Animated.timing(translateX, { ...config, toValue: 0 }),
        Animated.timing(translateY, { ...config, toValue: 0 }),
      ]).start();
    },
    [scale, translateX, translateY, report]
  );

  /**
   * Zooms about a focal point so whatever is under the fingers stays under
   * them. Transforms are applied about the view's centre, so the focal point
   * is measured from there.
   */
  const zoomAbout = useCallback(
    (nextScale: number, focalX: number, focalY: number, base: { scale: number; x: number; y: number }) => {
      const limited = clamp(nextScale, minScale.current, MAX_SCALE);
      const ratio = limited / base.scale;
      apply({
        scale: limited,
        x: focalX - (focalX - base.x) * ratio,
        y: focalY - (focalY - base.y) * ratio,
      });
    },
    [apply]
  );

  const zoomStep = useCallback(
    (direction: 1 | -1, focal: { x: number; y: number }, animated = true) => {
      const base = current.current;
      const limited = clamp(base.scale * BUTTON_STEP ** direction, minScale.current, MAX_SCALE);
      if (Math.abs(limited - base.scale) < EPSILON) return;
      const ratio = limited / base.scale;
      const target = {
        scale: limited,
        x: focal.x - (focal.x - base.x) * ratio,
        y: clampY(focal.y - (focal.y - base.y) * ratio, limited),
      };
      markAdjusted();
      if (!animated) {
        apply(target);
        return;
      }
      // Recorded straight away, so a second press mid-animation steps on from
      // where this one is going rather than where it started.
      current.current = target;
      report(limited);
      const config = { duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false };
      Animated.parallel([
        Animated.timing(scale, { ...config, toValue: target.scale }),
        Animated.timing(translateX, { ...config, toValue: target.x }),
        Animated.timing(translateY, { ...config, toValue: target.y }),
      ]).start(({ finished }) => {
        // Folding x back inside one world width only once it has arrived, so
        // the animation never slides a whole world sideways to get there.
        if (finished) apply(current.current);
      });
    },
    [apply, markAdjusted, report, scale, translateX, translateY]
  );

  // The limit moves with the camera -- the whole world is a different zoom
  // from France than from Russia -- so re-check the buttons when it does.
  const limit = minScale.current;
  useEffect(() => report(current.current.scale), [limit, report]);

  const panResponder = useMemo(() => {
    type Touch = { pageX: number; pageY: number };
    const begin = (touches: readonly Touch[], gesture: { dx: number; dy: number }) => {
      const two = touches.length >= 2;
      gestureStart.current = {
        ...current.current,
        distance: two ? distance(touches[0], touches[1]) : 0,
        focalX: two ? (touches[0].pageX + touches[1].pageX) / 2 - centre.current.x : 0,
        focalY: two ? (touches[0].pageY + touches[1].pageY) / 2 - centre.current.y : 0,
        dx: gesture.dx,
        dy: gesture.dy,
        touches: Math.min(touches.length, 2),
      };
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (event, gesture) =>
        event.nativeEvent.touches.length >= 2 ||
        Math.abs(gesture.dx) > DRAG_SLOP ||
        Math.abs(gesture.dy) > DRAG_SLOP,
      onPanResponderGrant: (event, gesture) => {
        begin(event.nativeEvent.touches, gesture);
        markAdjusted();
      },
      onPanResponderMove: (event, gesture) => {
        const touches = event.nativeEvent.touches;
        // A finger landing or lifting mid-gesture carries on from where the
        // map is, rather than snapping back to how the gesture started.
        if (Math.min(touches.length, 2) !== gestureStart.current.touches) {
          begin(touches, gesture);
          return;
        }
        const start = gestureStart.current;

        if (touches.length >= 2) {
          const limited = clamp(
            start.scale * (distance(touches[0], touches[1]) / Math.max(start.distance, 1)),
            minScale.current,
            MAX_SCALE
          );
          const ratio = limited / start.scale;
          // The point under the fingers follows their midpoint, so a pinch can
          // pan at the same time.
          const focalX = (touches[0].pageX + touches[1].pageX) / 2 - centre.current.x;
          const focalY = (touches[0].pageY + touches[1].pageY) / 2 - centre.current.y;
          apply({
            scale: limited,
            x: focalX - (start.focalX - start.x) * ratio,
            y: focalY - (start.focalY - start.y) * ratio,
          });
          return;
        }

        apply({
          scale: start.scale,
          x: start.x + gesture.dx - start.dx,
          y: start.y + gesture.dy - start.dy,
        });
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, [apply, markAdjusted]);

  // Web: take over the browser's own pinch and wheel zoom, which would
  // otherwise scale the entire page -- HUD, panel and all.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node) return;
    node.style.touchAction = 'none';

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const base = current.current;
      const factor = Math.exp(-event.deltaY * 0.0015);
      zoomAbout(
        base.scale * factor,
        event.clientX - centre.current.x,
        event.clientY - centre.current.y,
        base
      );
      markAdjusted();
    };
    // Safari pinches the page through its own gesture events.
    const swallow = (event: Event) => event.preventDefault();

    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('gesturestart', swallow);
    node.addEventListener('gesturechange', swallow);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('gesturestart', swallow);
      node.removeEventListener('gesturechange', swallow);
    };
  }, [markAdjusted, zoomAbout]);

  return {
    panHandlers: panResponder.panHandlers as unknown as Record<string, unknown>,
    containerRef,
    transform: { scale, translateX, translateY },
    adjusted,
    reset,
    zoomStep,
    canZoomIn: limits.canZoomIn,
    canZoomOut: limits.canZoomOut,
  };
}
