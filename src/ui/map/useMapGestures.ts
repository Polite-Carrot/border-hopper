import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, type View } from 'react-native';

/** How far in and out the player may take the map, relative to the framed view. */
const MIN_SCALE = 1;
const MAX_SCALE = 9;
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
  world: { width: number; height: number }
): MapGestures {
  const containerRef = useRef<View | null>(null);
  const [adjusted, setAdjusted] = useState(false);

  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Plain mirrors of the animated values. Animated does not expose its current
  // value synchronously, and a gesture needs it on every frame.
  const current = useRef({ scale: 1, x: 0, y: 0 });
  const gestureStart = useRef({ scale: 1, x: 0, y: 0, distance: 0, focalX: 0, focalY: 0 });

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
    },
    [scale, translateX, translateY]
  );

  const markAdjusted = useCallback(() => setAdjusted(true), []);

  const reset = useCallback(
    (animated = true) => {
      setAdjusted(false);
      current.current = { scale: 1, x: 0, y: 0 };
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
    [scale, translateX, translateY]
  );

  /**
   * Zooms about a focal point so whatever is under the fingers stays under
   * them. Transforms are applied about the view's centre, so the focal point
   * is measured from there.
   */
  const zoomAbout = useCallback(
    (nextScale: number, focalX: number, focalY: number, base: { scale: number; x: number; y: number }) => {
      const limited = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const ratio = limited / base.scale;
      apply({
        scale: limited,
        x: focalX - (focalX - base.x) * ratio,
        y: focalY - (focalY - base.y) * ratio,
      });
    },
    [apply]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (event, gesture) =>
          event.nativeEvent.touches.length >= 2 ||
          Math.abs(gesture.dx) > DRAG_SLOP ||
          Math.abs(gesture.dy) > DRAG_SLOP,
        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches;
          gestureStart.current = {
            ...current.current,
            distance: touches.length >= 2 ? distance(touches[0], touches[1]) : 0,
            focalX: 0,
            focalY: 0,
          };
          if (touches.length >= 2) {
            gestureStart.current.focalX =
              (touches[0].pageX + touches[1].pageX) / 2 - centre.current.x;
            gestureStart.current.focalY =
              (touches[0].pageY + touches[1].pageY) / 2 - centre.current.y;
          }
          markAdjusted();
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          const start = gestureStart.current;

          if (touches.length >= 2) {
            const spread = distance(touches[0], touches[1]);
            if (start.distance === 0) {
              // A second finger landed mid-drag; restart the pinch from here.
              gestureStart.current = {
                ...current.current,
                distance: spread,
                focalX: (touches[0].pageX + touches[1].pageX) / 2 - centre.current.x,
                focalY: (touches[0].pageY + touches[1].pageY) / 2 - centre.current.y,
              };
              return;
            }
            zoomAbout(start.scale * (spread / start.distance), start.focalX, start.focalY, start);
            return;
          }

          apply({ scale: start.scale, x: start.x + gesture.dx, y: start.y + gesture.dy });
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [apply, markAdjusted, zoomAbout]
  );

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
  };
}
