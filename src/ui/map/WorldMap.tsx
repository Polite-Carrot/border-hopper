import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { MAP_HEIGHT, MAP_WIDTH, getCountry } from '../../core/world';
import { mapColors } from '../../theme';
import { cameraOffset, type Camera, type Stage } from './camera';
import { BaseLayer } from './BaseLayer';
import { PATH_BY_KEY } from './shapes';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Sample points used to interpolate scale geometrically rather than linearly. */
const CURVE = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

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
  arrivalToken = 0,
  userTransform,
  panHandlers,
  containerRef,
}: WorldMapProps) {
  const progress = useRef(new Animated.Value(1)).current;
  const from = useRef<Camera>(camera);
  const to = useRef<Camera>(camera);
  const ping = useRef(new Animated.Value(0)).current;

  // Re-aim the camera whenever the target changes.
  if (to.current !== camera) {
    from.current = to.current;
    to.current = camera;
  }

  useEffect(() => {
    progress.setValue(0);
    if (duration <= 0) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      // Slow at both ends: the map settles rather than snapping into place.
      easing: Easing.bezier(0.5, 0, 0.15, 1),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [camera, duration, progress]);

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

  // The player's own pinch and pan ride on top of the camera. Keeping them on
  // the container rather than inside the SVG means a drag is a single native
  // transform, with nothing re-rendering.
  const userStyle = userTransform
    ? {
        transform: [
          { translateX: userTransform.translateX },
          { translateY: userTransform.translateY },
          { scale: userTransform.scale },
        ],
      }
    : undefined;

  return (
    <>
    <Animated.View
      ref={containerRef}
      style={[StyleSheet.absoluteFill, userStyle]}
      pointerEvents={panHandlers ? 'auto' : 'none'}
      {...(panHandlers ?? {})}
    >
      <Svg width={stage.width} height={stage.height}>
        <Rect x={0} y={0} width={stage.width} height={stage.height} fill={mapColors.ocean} />
        <AnimatedG
          originX={0}
          originY={0}
          scale={transform.scale as unknown as number}
          translateX={transform.x as unknown as number}
          translateY={transform.y as unknown as number}
        >
          <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="transparent" />
          <BaseLayer />

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
        </AnimatedG>

        {/* Markers sit outside the camera group so they keep a constant size. */}
        <DestinationMarker
          destination={destination}
          camera={to.current}
          from={from.current}
          stage={stage}
          progress={progress}
        />


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

interface MarkerProps {
  destination: ReturnType<typeof getCountry>;
  camera: Camera;
  from: Camera;
  stage: Stage;
  progress: Animated.Value;
}

/** A small reticle over the destination: visible, but it gives no route away. */
function DestinationMarker({ destination, camera, from, stage, progress }: MarkerProps) {
  if (!destination) return null;
  const at = (c: Camera) => {
    const offset = cameraOffset(c, stage);
    return {
      x: destination.centroid[0] * c.k + offset.x,
      y: destination.centroid[1] * c.k + offset.y,
    };
  };
  const start = at(from);
  const end = at(camera);
  const cx = progress.interpolate({ inputRange: [0, 1], outputRange: [start.x, end.x] });
  const cy = progress.interpolate({ inputRange: [0, 1], outputRange: [start.y, end.y] });

  return (
    <AnimatedG translateX={cx as unknown as number} translateY={cy as unknown as number}>
      <Circle r={17} fill="none" stroke={mapColors.destination} strokeWidth={1.4} strokeOpacity={0.5} />
      <Circle r={8} fill="none" stroke={mapColors.destination} strokeWidth={2} />
      <Circle r={2.6} fill={mapColors.destination} />
    </AnimatedG>
  );
}
