import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Use } from 'react-native-svg';
import { MAP_HEIGHT, MAP_WIDTH, getCountry } from '../../core/world';
import { mapColors } from '../../theme';
import { nearestTurn, recentre, type Camera, type Stage } from './camera';
import { BaseLayer } from './BaseLayer';
import { PATH_BY_KEY } from './shapes';
import { Traveller, tripLength } from './Traveller';
import { planTrip, type Trip } from './trip';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The map is drawn once into `<Defs>` and stamped three times side by side, so
 * dragging west past Alaska arrives in Russia instead of running out of world.
 * The projection is equirectangular precisely so these copies meet cleanly.
 *
 * Three is enough because the gestures wrap the pan offset back inside one
 * canvas width (see `useMapGestures`): the middle copy is never more than half
 * a world from home, and the outer two cover whatever that exposes.
 */
const WORLD_ID = 'bh-world';
const COPIES = [-1, 0, 1] as const;

/** Clock reading for a traveller standing still: past the end of any trip. */
const AT_REST = 1e6;

/** Sample points used to interpolate scale geometrically rather than linearly. */
const CURVE = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

/** Where the camera is `t` of the way through a move: the same curve `transform` draws. */
function cameraAt(start: Camera, end: Camera, t: number): Camera {
  if (t >= 1) return end;
  if (t <= 0) return start;
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    k: Math.exp(Math.log(start.k) * (1 - t) + Math.log(end.k) * t),
  };
}

export interface WorldMapProps {
  stage: Stage;
  camera: Camera;
  /** Milliseconds for the travel animation. 0 jumps straight there. */
  duration: number;
  currentIso: string;
  destinationIso: string;
  /** Countries already passed through, excluding the current one. */
  visited: readonly string[];
  /** Briefly flashed in red after a rejected guess. */
  invalidIso?: string | null;
  /** Whether the move into `currentIso` was a flight rather than a border hop. */
  flown?: boolean;
  /** The flag the explorer is wearing, from the passport. */
  skin?: string | null;
  /** Off for the menu's drifting backdrop, which is scenery, not a journey. */
  showTraveller?: boolean;
  /** Bumped to replay the arrival ping. */
  arrivalToken?: number;
  /** Pinch/drag transform layered on top of the camera, if the map is interactive. */
  userTransform?: {
    scale: Animated.Value;
    translateX: Animated.Value;
    translateY: Animated.Value;
  };
  /** Gesture handlers from `useMapGestures`. */
  panHandlers?: Record<string, unknown>;
  containerRef?: React.Ref<View>;
}

/**
 * The world, drawn once and moved under a camera.
 *
 * The camera animates a single group transform rather than re-projecting or
 * re-rendering geometry, so travelling between countries costs one prop update
 * per frame no matter how much of the world is on screen.
 */
export function WorldMap({
  stage,
  camera,
  duration,
  currentIso,
  destinationIso,
  visited,
  invalidIso,
  flown = false,
  skin = null,
  showTraveller = true,
  arrivalToken = 0,
  userTransform,
  panHandlers,
  containerRef,
}: WorldMapProps) {
  // A fresh progress value for every camera move. Resetting one shared value
  // would drag the previous move's nodes back to their start for a frame
  // before the new ones took over; a new value leaves them where they are.
  const progressRef = useRef<Animated.Value | null>(null);
  const progressNow = useRef(1);
  const watch = (value: Animated.Value) => {
    value.addListener(({ value: t }) => {
      progressNow.current = t;
    });
    return value;
  };
  progressRef.current ??= watch(new Animated.Value(1));
  const from = useRef<Camera>(camera);
  const to = useRef<Camera>(camera);
  const ping = useRef(new Animated.Value(0)).current;

  // Re-aim the camera whenever the target changes, across the seam if that is
  // the shorter way. `seen` tracks the prop itself, because `to` holds the
  // re-aimed copy of it rather than the object that came in. A move that
  // arrives mid-flight starts from wherever the camera is now, not from where
  // it was heading, or the map would jump.
  const seen = useRef<Camera>(camera);
  if (seen.current !== camera) {
    seen.current = camera;
    const here = cameraAt(from.current, to.current, progressNow.current);
    const turn = recentre(here, nearestTurn(camera, here));
    from.current = turn.from;
    to.current = turn.to;
    progressRef.current.stopAnimation();
    progressRef.current.removeAllListeners();
    progressNow.current = duration > 0 ? 0 : 1;
    progressRef.current = watch(new Animated.Value(progressNow.current));
  }
  const progress = progressRef.current;
  // Read when a move starts, not watched: the screen changes `duration` on the
  // render after a move, and restarting the flight then would jump it back.
  const durationRef = useRef(duration);
  durationRef.current = duration;

  // The traveller's next move, planned when the player enters a new country,
  // after the camera has been re-aimed, so it can travel in step with it.
  const clock = useRef(new Animated.Value(AT_REST)).current;
  const trip = useRef<Trip | null>(null);
  const tripIso = useRef<string | null>(null);
  if (tripIso.current !== currentIso) {
    const before = tripIso.current ? getCountry(tripIso.current)?.anchor : undefined;
    const after = getCountry(currentIso)?.anchor;
    tripIso.current = currentIso;
    trip.current = after ? planTrip(before, after, { from: from.current.x, to: to.current.x, duration }, flown) : null;
  }
  const currentTrip = trip.current;

  useEffect(() => {
    const length = durationRef.current;
    if (length <= 0) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: length,
      // Slow at both ends: the map settles rather than snapping into place.
      easing: Easing.bezier(0.5, 0, 0.15, 1),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress]);

  // Hop whenever there is somewhere new to hop to. The camera's duration is 0
  // for the opening frame and whenever reduce motion is on, and then the
  // explorer simply appears on the new country instead of jumping.
  const animateTrip = duration > 0;
  useEffect(() => {
    if (!currentTrip || currentTrip.from === currentTrip.to || !animateTrip) {
      clock.setValue(AT_REST);
      return;
    }
    clock.setValue(0);
    const length = tripLength(currentTrip);
    const animation = Animated.timing(clock, {
      toValue: length,
      duration: length,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) clock.setValue(AT_REST);
    });
    return () => animation.stop();
    // Keyed on the trip alone: a camera nudge mid-hop must not restart it.
  }, [currentTrip, clock]);

  useEffect(() => {
    if (!arrivalToken) return;
    ping.setValue(0);
    const animation = Animated.timing(ping, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [arrivalToken, ping]);

  const transform = useMemo(() => {
    const start = from.current;
    const end = to.current;
    // Geometric interpolation of scale keeps the apparent speed even whether
    // the camera is skimming Europe or pulling back to the whole world.
    const scale = progress.interpolate({
      inputRange: CURVE,
      outputRange: CURVE.map((t) => Math.exp(Math.log(start.k) * (1 - t) + Math.log(end.k) * t)),
    });
    const focusX = progress.interpolate({ inputRange: [0, 1], outputRange: [start.x, end.x] });
    const focusY = progress.interpolate({ inputRange: [0, 1], outputRange: [start.y, end.y] });
    const centreX = stage.visible.x + stage.visible.width / 2;
    const centreY = stage.visible.y + stage.visible.height / 2;
    return {
      scale,
      x: Animated.subtract(centreX, Animated.multiply(focusX, scale)),
      y: Animated.subtract(centreY, Animated.multiply(focusY, scale)),
    };
  }, [camera, progress, stage]);

  const currentPath = PATH_BY_KEY[currentIso];
  const destinationPath = PATH_BY_KEY[destinationIso];
  const invalidPath = invalidIso ? PATH_BY_KEY[invalidIso] : undefined;
  const destination = getCountry(destinationIso);
  const current = getCountry(currentIso);

  const pingRadius = ping.interpolate({ inputRange: [0, 1], outputRange: [0, 46] });
  const pingOpacity = ping.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.75, 0] });

  /**
   * The player's own pinch and pan ride on top of the camera, as a group
   * *inside* the SVG rather than a transform on the container.
   *
   * Transforming the container moves the SVG's clipping box along with its
   * contents, so a drag slides the whole map off the screen and reveals
   * nothing: the wrapped copies stay clipped away exactly as they were. Moving
   * the group instead leaves the viewport where it is, so dragging uncovers
   * the next copy of the world. `originX`/`originY` put the pinch focus at the
   * middle of the viewport, which is where the gestures measure it from.
   */
  const stageCentre = { x: stage.width / 2, y: stage.height / 2 };

  // Undoes the player's zoom for things that mark a spot rather than cover
  // ground -- the explorer and the destination reticle -- so they stay the same
  // size on screen however far in or out the map goes.
  const userScale = userTransform?.scale;
  const counterScale = useMemo(() => (userScale ? Animated.divide(1, userScale) : 1), [userScale]);

  return (
    <>
    <Animated.View
      ref={containerRef}
      style={StyleSheet.absoluteFill}
      pointerEvents={panHandlers ? 'auto' : 'none'}
      {...(panHandlers ?? {})}
    >
      <Svg width={stage.width} height={stage.height}>
        <Rect x={0} y={0} width={stage.width} height={stage.height} fill={mapColors.ocean} />
        {/*
          Only the never-changing base map is shared through <use>. Anything
          that changes during play lives outside <Defs>: touching a <Defs>
          child makes the browser rebuild every copy of the whole world.
        */}
        <Defs>
          <G id={WORLD_ID}>
          <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="transparent" />
          <BaseLayer />
          </G>
        </Defs>

        <AnimatedG
          originX={stageCentre.x}
          originY={stageCentre.y}
          scale={(userTransform?.scale ?? 1) as unknown as number}
          translateX={(userTransform?.translateX ?? 0) as unknown as number}
          translateY={(userTransform?.translateY ?? 0) as unknown as number}
        >
          <AnimatedG
            originX={0}
            originY={0}
            scale={transform.scale as unknown as number}
            translateX={transform.x as unknown as number}
            translateY={transform.y as unknown as number}
          >
            {COPIES.map((copy) => (
              <Use key={copy} href={`#${WORLD_ID}`} x={copy * MAP_WIDTH} />
            ))}
            {COPIES.map((copy) => (
              <Highlights
                key={`highlights-${copy}`}
                offset={copy * MAP_WIDTH}
                visited={visited}
                destinationPath={destinationPath}
                currentPath={currentPath}
                invalidPath={invalidPath}
              />
            ))}
          </AnimatedG>

          {/* Markers sit outside the camera group so they keep a constant size. */}
          {COPIES.map((copy) => (
            <DestinationMarker
              key={copy}
              copy={copy}
              destination={destination}
              camera={transform}
              counterScale={counterScale}
            />
          ))}

          {currentTrip && showTraveller
            ? COPIES.map((copy) => (
                <Traveller
                  key={`traveller-${copy}`}
                  trip={currentTrip}
                  clock={clock}
                  progress={progress}
                  camera={transform}
                  copy={copy}
                  skin={skin}
                  counterScale={counterScale}
                />
              ))
            : null}

          {current ? (
            <AnimatedCircle
              cx={stage.visible.x + stage.visible.width / 2}
              cy={stage.visible.y + stage.visible.height / 2}
              r={pingRadius as unknown as number}
              stroke={mapColors.current}
              strokeWidth={2}
              fill="none"
              opacity={pingOpacity as unknown as number}
            />
          ) : null}
        </AnimatedG>
      </Svg>
    </Animated.View>

    {/*
      The HUD sits over the top of the map. Fading the map out underneath it
      keeps the destination name and the route legible whatever country happens
      to be up there.

      This is deliberately outside the transformed container: inside it, the
      player's own pinch and pan would drag the scrim off the HUD along with
      the map.
    */}
    {stage.visible.y > 0 ? (
      <View style={styles.scrim} pointerEvents="none">
        <Svg width={stage.width} height={stage.visible.y}>
          <Defs>
            <LinearGradient id="hudScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={mapColors.ocean} stopOpacity="0.98" />
              <Stop offset="0.6" stopColor={mapColors.ocean} stopOpacity="0.86" />
              <Stop offset="1" stopColor={mapColors.ocean} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={stage.width} height={stage.visible.y} fill="url(#hudScrim)" />
        </Svg>
      </View>
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
});

interface HighlightsProps {
  offset: number;
  visited: readonly string[];
  destinationPath?: string;
  currentPath?: string;
  invalidPath?: string;
}

/** Current, visited, destination and rejected countries, drawn over one copy of the world. */
const Highlights = memo(function Highlights({
  offset,
  visited,
  destinationPath,
  currentPath,
  invalidPath,
}: HighlightsProps) {
  return (
    <G translateX={offset}>
      {visited.map((iso) =>
        PATH_BY_KEY[iso] ? (
          <Path
            key={`visited-${iso}`}
            d={PATH_BY_KEY[iso]}
            fill={mapColors.visited}
            stroke={mapColors.stroke}
            strokeWidth={0.7}
            vectorEffect="non-scaling-stroke"
          />
        ) : null
      )}

      {destinationPath ? (
        <Path
          d={destinationPath}
          fill="none"
          stroke={mapColors.destination}
          strokeWidth={2.4}
          strokeOpacity={0.95}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      {currentPath ? (
        <>
          {/* A wide translucent stroke reads as a glow at every zoom level. */}
          <Path
            d={currentPath}
            fill="none"
            stroke={mapColors.current}
            strokeOpacity={0.22}
            strokeWidth={14}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <Path
            d={currentPath}
            fill={mapColors.current}
            fillOpacity={0.9}
            stroke={mapColors.currentStroke}
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : null}

      {invalidPath ? (
        <Path
          d={invalidPath}
          fill={mapColors.invalid}
          fillOpacity={0.55}
          stroke={mapColors.invalid}
          strokeWidth={1.6}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </G>
  );
});

interface MarkerProps {
  destination: ReturnType<typeof getCountry>;
  /** The live camera transform, so the reticle stays pinned to the country mid-move. */
  camera: {
    scale: Animated.AnimatedInterpolation<number>;
    x: Animated.AnimatedNode;
    y: Animated.AnimatedNode;
  };
  /** Which wrapped copy of the world this marker belongs to: -1, 0 or 1. */
  copy: number;
  /** Cancels the player's zoom, so the reticle keeps its size. */
  counterScale: Animated.AnimatedNode | number;
}

/** A small reticle over the destination: visible, but it gives no route away. */
function DestinationMarker({ destination, camera, copy, counterScale }: MarkerProps) {
  if (!destination) return null;
  const cx = Animated.add(Animated.multiply(destination.centroid[0] + copy * MAP_WIDTH, camera.scale), camera.x);
  const cy = Animated.add(Animated.multiply(destination.centroid[1], camera.scale), camera.y);

  return (
    <AnimatedG translateX={cx as unknown as number} translateY={cy as unknown as number}>
      <AnimatedG scale={counterScale as unknown as number}>
        <Circle r={17} fill="none" stroke={mapColors.destination} strokeWidth={1.4} strokeOpacity={0.5} />
        <Circle r={8} fill="none" stroke={mapColors.destination} strokeWidth={2} />
        <Circle r={2.6} fill={mapColors.destination} />
      </AnimatedG>
    </AnimatedG>
  );
}
