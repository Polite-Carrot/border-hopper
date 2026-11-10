import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { MAP_WIDTH, getCountry } from '../../core/world';
import { mapColors } from '../../theme';
import { ICON_PATHS } from '../components/Icon';
import { nearestTurn, recentre, type Camera, type Stage } from './camera';
import { BaseMap } from './BaseMap';
import { PATH_BY_KEY, nearestOutlinePoint } from './shapes';
import { Traveller, tripLength } from './Traveller';
import { nearestCopy, planTrip, type Trip } from './trip';
import { REFUSAL_TIME, Refusal } from './Refusal';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The world is three copies side by side, so dragging west past Alaska arrives
 * in Russia instead of running out of world. The projection is
 * equirectangular precisely so these copies meet cleanly. The countries
 * themselves are drawn by `BaseMap`; what is drawn here -- highlights and
 * markers -- follows the same three copies.
 *
 * Three is enough because the gestures wrap the pan offset back inside one
 * canvas width (see `useMapGestures`): the middle copy is never more than half
 * a world from home, and the outer two cover whatever that exposes.
 */
const COPIES = [-1, 0, 1] as const;

/**
 * Which copy of the world (-1, 0 or 1) puts a point at map x nearest `focusX`.
 * The camera keeps within one world of home and the gestures within half a
 * world of the camera, so that copy is the one on screen.
 */
function copyNear(x: number | undefined, focusX: number): number {
  if (x === undefined) return 0;
  return Math.max(-1, Math.min(1, Math.round((focusX - x) / MAP_WIDTH)));
}

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
  /** Hub airports to mark with a plane: flight mode only. */
  hubs?: readonly string[];
  /** A country to outline as a hint. */
  hintIso?: string | null;
  /** Visa Denied: countries whose border is closed, shaded and signed. */
  closed?: readonly string[];
  /**
   * A closed border the explorer just tried: he is sent back from it. A new
   * token replays it. Leave unset to skip the animation (reduce motion).
   */
  refusal?: { iso: string; token: number } | null;
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
 * The camera never re-projects or re-renders geometry. The countries move as
 * one layer shifted by the graphics chip (`BaseMap`); the highlights and
 * markers on top move with a single SVG group transform.
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
  hubs,
  hintIso = null,
  closed,
  refusal = null,
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

  // Visa Denied: out to the closed border and thrown back. Planned when a
  // refusal arrives, in step with where the camera is aimed.
  const refusalClock = useRef(new Animated.Value(0)).current;
  const [refused, setRefused] = useState<{ from: [number, number]; turn: [number, number]; token: number } | null>(null);
  useEffect(() => {
    if (!refusal) return;
    const here = getCountry(currentIso)?.anchor;
    if (!here) return;
    const from: [number, number] = [nearestCopy(here[0], to.current.x), here[1]];
    // Aimed at the border he is trying to cross, not the closed country's
    // middle: from North Korea, Russia is a short hop north-east.
    const target = nearestOutlinePoint(refusal.iso, from, MAP_WIDTH);
    if (!target) return;
    const dx = target[0] - from[0];
    const dy = target[1] - from[1];
    const length = Math.hypot(dx, dy) || 1;
    // Right up to the border, but never so far he leaves the screen: at
    // most about 70 pixels at this zoom, and at least a visible hop.
    const k = Math.max(to.current.k, 0.0001);
    const step = Math.max(Math.min(length, 70 / k), 24 / k);
    const turn: [number, number] = [from[0] + (dx / length) * step, from[1] + (dy / length) * step];
    setRefused({ from, turn, token: refusal.token });
    refusalClock.setValue(0);
    const animation = Animated.timing(refusalClock, {
      toValue: REFUSAL_TIME,
      duration: REFUSAL_TIME,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) setRefused((current) => (current?.token === refusal.token ? null : current));
    });
    return () => animation.stop();
    // Keyed on the token: each attempt is one throw.
  }, [refusal?.token]);

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
  const hintPath = hintIso ? PATH_BY_KEY[hintIso] : undefined;
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
  // Where the camera is headed, in map units: markers go on the copy nearest it.
  const focusX = to.current.x;
  const counterScale = useMemo(() => (userScale ? Animated.divide(1, userScale) : 1), [userScale]);

  return (
    <>
    <Animated.View
      ref={containerRef}
      style={[StyleSheet.absoluteFill, styles.ocean]}
      pointerEvents={panHandlers ? 'auto' : 'none'}
      {...(panHandlers ?? {})}
    >
      {/* The countries: a layer of their own, moved without being redrawn. */}
      <BaseMap stage={stage} ocean={mapColors.ocean} camera={transform} progress={progress} user={userTransform} />

      {/* Everything that changes during play, drawn over the countries. */}
      <Svg width={stage.width} height={stage.height} style={StyleSheet.absoluteFill}>
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
              <Highlights
                key={`highlights-${copy}`}
                offset={copy * MAP_WIDTH}
                visited={visited}
                destinationPath={destinationPath}
                currentPath={currentPath}
                invalidPath={invalidPath}
                hintPath={hintPath}
                closed={closed}
              />
            ))}
          </AnimatedG>

          {/*
            Markers sit outside the camera group so they keep a constant size.
            Each is drawn once, on the copy of the world nearest where the
            camera is headed -- the one on screen -- rather than on all three:
            every marker drawn is one more thing to move on every frame of a
            glide, and flight mode alone has some twenty airports.
          */}
          {closed?.map((iso) => {
            const country = getCountry(iso);
            return (
              <ClosedMarker
                key={`closed-${iso}`}
                country={country}
                copy={copyNear(country?.anchor[0], focusX)}
                camera={transform}
                counterScale={counterScale}
              />
            );
          })}

          {hubs?.map((iso) => {
            const country = getCountry(iso);
            return (
              <HubMarker
                key={`hub-${iso}`}
                country={country}
                copy={copyNear(country?.anchor[0], focusX)}
                camera={transform}
                counterScale={counterScale}
              />
            );
          })}
          <DestinationMarker
            copy={copyNear(destination?.centroid[0], focusX)}
            destination={destination}
            camera={transform}
            counterScale={counterScale}
          />

          {/* The explorer's trips are planned on the copy nearest the camera already. */}
          {refused && showTraveller ? (
            <Refusal
              from={refused.from}
              turn={refused.turn}
              clock={refusalClock}
              camera={transform}
              copy={0}
              skin={skin}
              counterScale={counterScale}
            />
          ) : null}

          {currentTrip && showTraveller && !refused ? (
            <Traveller
              trip={currentTrip}
              clock={clock}
              progress={progress}
              camera={transform}
              copy={0}
              skin={skin}
              counterScale={counterScale}
            />
          ) : null}

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
  ocean: { backgroundColor: mapColors.ocean, overflow: 'hidden' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
});

interface HighlightsProps {
  offset: number;
  visited: readonly string[];
  destinationPath?: string;
  currentPath?: string;
  invalidPath?: string;
  hintPath?: string;
  closed?: readonly string[];
}

/** Current, visited, destination, hinted and rejected countries, drawn over one copy of the world. */
const Highlights = memo(function Highlights({
  offset,
  visited,
  destinationPath,
  currentPath,
  invalidPath,
  hintPath,
  closed,
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

      {/* Closed borders: red, and hatched with a dashed edge so they read as
          shut even to someone who cannot tell red from the land around it. */}
      {closed?.map((iso) =>
        PATH_BY_KEY[iso] ? (
          <Path
            key={`closed-${iso}`}
            d={PATH_BY_KEY[iso]}
            fill={mapColors.closed}
            fillOpacity={0.3}
            stroke={mapColors.closed}
            strokeWidth={1.8}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null
      )}

      {hintPath ? (
        <Path
          d={hintPath}
          fill={mapColors.hint}
          fillOpacity={0.18}
          stroke={mapColors.hint}
          strokeWidth={2}
          strokeDasharray="5 4"
          vectorEffect="non-scaling-stroke"
        />
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

interface HubMarkerProps {
  country: ReturnType<typeof getCountry>;
  camera: MarkerProps['camera'];
  copy: number;
  counterScale: Animated.AnimatedNode | number;
}

/**
 * A plane on a hub airport, so the flight rule can be seen rather than
 * remembered. Small and quiet: it marks where flying is possible without
 * competing with the destination or the explorer.
 */
function HubMarker({ country, camera, copy, counterScale }: HubMarkerProps) {
  if (!country) return null;
  const cx = Animated.add(Animated.multiply(country.anchor[0] + copy * MAP_WIDTH, camera.scale), camera.x);
  const cy = Animated.add(Animated.multiply(country.anchor[1], camera.scale), camera.y);
  return (
    <AnimatedG translateX={cx as unknown as number} translateY={cy as unknown as number}>
      <AnimatedG scale={counterScale as unknown as number}>
        <Circle r={8.5} fill={mapColors.hubFill} stroke={mapColors.hub} strokeWidth={1.2} />
        <G transform="translate(-6 -6) scale(0.5)">
          <Path d={ICON_PATHS.plane} fill={mapColors.hub} />
        </G>
      </AnimatedG>
    </AnimatedG>
  );
}

/** A no-entry sign on a closed country, the same size at every zoom. */
function ClosedMarker({ country, camera, copy, counterScale }: HubMarkerProps) {
  if (!country) return null;
  const cx = Animated.add(Animated.multiply(country.anchor[0] + copy * MAP_WIDTH, camera.scale), camera.x);
  const cy = Animated.add(Animated.multiply(country.anchor[1], camera.scale), camera.y);
  return (
    <AnimatedG translateX={cx as unknown as number} translateY={cy as unknown as number}>
      <AnimatedG scale={counterScale as unknown as number}>
        <Circle r={9} fill={mapColors.closed} stroke="#FFFFFF" strokeWidth={1.6} />
        <Rect x={-5.5} y={-1.6} width={11} height={3.2} rx={1} fill="#FFFFFF" />
      </AnimatedG>
    </AnimatedG>
  );
}
