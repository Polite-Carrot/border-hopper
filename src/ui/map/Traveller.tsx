import { useMemo } from 'react';
import { Animated } from 'react-native';
import { Ellipse, G } from 'react-native-svg';
import { MAP_WIDTH } from '../../core/world';
import { Explorer } from './Explorer';
import { ARC_HEIGHT, SETTLE_TIME, type Trip } from './trip';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

/** Points along the arc. A parabola needs more than three to look like one. */
const ARC_SAMPLES = Array.from({ length: 13 }, (_, i) => i / 12);

/** Total length of a trip's animation, landing included. */
export function tripLength(trip: Trip): number {
  return trip.air + SETTLE_TIME;
}

export interface TravellerProps {
  trip: Trip;
  /** Milliseconds into the trip; anything past its end is standing still. */
  clock: Animated.Value;
  /** The camera's own 0-to-1 progress, eased, which a flight keeps pace with. */
  progress: Animated.Value;
  /** The camera's current transform, which the traveller is placed through. */
  camera: {
    scale: Animated.AnimatedInterpolation<number>;
    x: Animated.AnimatedNode;
    y: Animated.AnimatedNode;
  };
  /** Which wrapped copy of the world this traveller stands on: -1, 0 or 1. */
  copy: number;
}

/**
 * The explorer, standing on the current country and hopping to the next.
 *
 * It lives outside the camera group so it stays the same size at every zoom,
 * but it is placed through the camera's transform, so it stays glued to the
 * ground while the camera travels: it takes off, the world slides under it,
 * and it lands on the new country.
 *
 * Everything runs off one clock in milliseconds, so the arc, the shadow and
 * the squash on landing can never drift apart.
 */
export function Traveller({ trip, clock, progress, camera, copy }: TravellerProps) {
  const motion = useMemo(() => {
    const air = trip.air;
    const height = trip.flown ? ARC_HEIGHT.flight : ARC_HEIGHT.hop;
    const shift = copy * MAP_WIDTH;
    const clamp = { extrapolate: 'clamp' as const };

    // A hop goes straight across at a steady pace under a parabola: the path
    // of anything thrown, which is why it reads as a jump. A flight instead
    // keeps pace with the camera, which eases in and out over half the world;
    // at a steady pace he would race off the screen on take-off and
    // fall back into it at the end.
    const along = trip.flown ? progress : clock;
    const span = trip.flown ? 1 : air;
    const groundX = along.interpolate({ inputRange: [0, span], outputRange: [trip.from[0] + shift, trip.to[0] + shift], ...clamp });
    const groundY = along.interpolate({ inputRange: [0, span], outputRange: [trip.from[1], trip.to[1]], ...clamp });
    const times = ARC_SAMPLES.map((u) => u * air);
    const rise = ARC_SAMPLES.map((u) => 4 * u * (1 - u));
    const lift = clock.interpolate({ inputRange: times, outputRange: rise.map((r) => -height * r), ...clamp });

    // The shadow stays on the ground and shrinks as he rises.
    const shadowScale = clock.interpolate({ inputRange: times, outputRange: rise.map((r) => 1 - 0.5 * r), ...clamp });
    const shadowOpacity = clock.interpolate({ inputRange: times, outputRange: rise.map((r) => 0.4 - 0.25 * r), ...clamp });

    // Stretch on take-off and on the way down, squash on landing, then a
    // small wobble back to standing.
    const land = air;
    const stretchTimes = [0, air * 0.12, air * 0.5, air * 0.9, land, land + SETTLE_TIME * 0.3, land + SETTLE_TIME * 0.65, land + SETTLE_TIME];
    const scaleY = clock.interpolate({ inputRange: stretchTimes, outputRange: [1, 1.16, 1, 1.06, 0.7, 1.08, 0.97, 1], ...clamp });
    const scaleX = clock.interpolate({ inputRange: stretchTimes, outputRange: [1, 0.9, 1, 0.96, 1.28, 0.95, 1.02, 1], ...clamp });

    return {
      x: Animated.add(camera.x, Animated.multiply(groundX, camera.scale)),
      y: Animated.add(camera.y, Animated.multiply(groundY, camera.scale)),
      lift,
      shadowScale,
      shadowOpacity,
      scaleX,
      scaleY,
    };
  }, [trip, clock, progress, camera, copy]);

  return (
    <AnimatedG translateX={motion.x as unknown as number} translateY={motion.y as unknown as number}>
      <AnimatedEllipse
        rx={8}
        ry={2.6}
        fill="#000"
        opacity={motion.shadowOpacity as unknown as number}
        scale={motion.shadowScale as unknown as number}
      />
      <AnimatedG translateY={motion.lift as unknown as number}>
        <AnimatedG scaleX={motion.scaleX as unknown as number} scaleY={motion.scaleY as unknown as number}>
          <G scaleX={trip.facing}>
            <Explorer />
          </G>
        </AnimatedG>
      </AnimatedG>
    </AnimatedG>
  );
}
