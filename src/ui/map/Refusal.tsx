import { useMemo } from 'react';
import { Animated } from 'react-native';
import { Ellipse, G } from 'react-native-svg';
import { MAP_WIDTH } from '../../core/world';
import { Explorer } from './Explorer';
import { PoliceOfficer } from './PoliceOfficer';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

/** Milliseconds: out to the border, a moment there, thrown back, landed. */
const OUT = 380;
const CAUGHT = 600;
const LANDED = 1180;
export const REFUSAL_TIME = 1500;

const HOP_HEIGHT = 20;
const THROW_HEIGHT = 66;
/** Points along each arc, so they read as parabolas. */
const SAMPLES = Array.from({ length: 9 }, (_, i) => i / 8);

export interface RefusalProps {
  /** Where the explorer stands, in map units. */
  from: readonly [number, number];
  /** The edge of the closed country he reaches before he is stopped. */
  turn: readonly [number, number];
  clock: Animated.Value;
  camera: {
    scale: Animated.AnimatedInterpolation<number>;
    x: Animated.AnimatedNode;
    y: Animated.AnimatedNode;
  };
  /** Which wrapped copy of the world: -1, 0 or 1. */
  copy: number;
  skin: string | null;
  counterScale: Animated.AnimatedNode | number;
}

/**
 * Visa Denied: the explorer tries a closed border and is sent back.
 *
 * He hops towards the closed country, two border officers pop up in his way
 * with their hands up, and they throw him back -- a high, spinning arc that
 * lands him, squashed, where he started. He never leaves the country he was
 * in, which is exactly what the rules say happened.
 *
 * One clock drives everything, as with a normal hop, so the officers, the
 * throw and the landing can never drift apart.
 */
export function Refusal({ from, turn, clock, camera, copy, skin, counterScale }: RefusalProps) {
  const motion = useMemo(() => {
    const clamp = { extrapolate: 'clamp' as const };
    const shift = copy * MAP_WIDTH;
    const facing: 1 | -1 = turn[0] < from[0] ? -1 : 1;
    const times = [0, OUT, CAUGHT, LANDED, REFUSAL_TIME];
    const groundX = clock.interpolate({ inputRange: times, outputRange: [from[0], turn[0], turn[0], from[0], from[0]].map((x) => x + shift), ...clamp });
    const groundY = clock.interpolate({ inputRange: times, outputRange: [from[1], turn[1], turn[1], from[1], from[1]], ...clamp });

    // Two arcs: a small hop out, then the throw back.
    const hopTimes = SAMPLES.map((u) => u * OUT);
    const throwTimes = SAMPLES.map((u) => CAUGHT + u * (LANDED - CAUGHT));
    const arc = (height: number) => SAMPLES.map((u) => -height * 4 * u * (1 - u));
    const lift = clock.interpolate({
      inputRange: [...hopTimes, ...throwTimes],
      outputRange: [...arc(HOP_HEIGHT), ...arc(THROW_HEIGHT)],
      ...clamp,
    });
    // A full spin on the way back, heels over head away from the border.
    const spin = clock.interpolate({ inputRange: [CAUGHT, LANDED], outputRange: [0, -360 * facing], ...clamp });
    const squashTimes = [LANDED, LANDED + 90, LANDED + 200, REFUSAL_TIME];
    const scaleY = clock.interpolate({ inputRange: squashTimes, outputRange: [1, 0.66, 1.08, 1], ...clamp });
    const scaleX = clock.interpolate({ inputRange: squashTimes, outputRange: [1, 1.3, 0.96, 1], ...clamp });
    const shadow = clock.interpolate({
      inputRange: [...hopTimes, ...throwTimes],
      outputRange: [...arc(HOP_HEIGHT), ...arc(THROW_HEIGHT)].map((l) => 0.4 + l / 220),
      ...clamp,
    });

    // The officers pop up just as he arrives, stand firm, then step away.
    const popIn = clock.interpolate({
      inputRange: [OUT - 120, OUT + 40, OUT + 130, LANDED, REFUSAL_TIME],
      outputRange: [0, 1.18, 1, 1, 0.9],
      ...clamp,
    });
    const officers = clock.interpolate({
      inputRange: [OUT - 120, OUT - 40, LANDED + 60, REFUSAL_TIME],
      outputRange: [0, 1, 1, 0],
      ...clamp,
    });

    const at = (x: Animated.AnimatedNode, y: Animated.AnimatedNode) => ({
      x: Animated.add(camera.x, Animated.multiply(x, camera.scale)),
      y: Animated.add(camera.y, Animated.multiply(y, camera.scale)),
    });
    return {
      facing,
      explorer: at(groundX, groundY),
      border: at(new Animated.Value(turn[0] + shift), new Animated.Value(turn[1])),
      lift,
      spin,
      scaleX,
      scaleY,
      shadow,
      popIn,
      officers,
    };
  }, [from, turn, clock, camera, copy]);

  const { facing } = motion;
  // In his way: a step further on towards the closed country, one either side
  // of his path. Screen pixels, worked out from the direction he set off in.
  const length = Math.hypot(turn[0] - from[0], turn[1] - from[1]) || 1;
  const along = [(turn[0] - from[0]) / length, (turn[1] - from[1]) / length] as const;
  const across = [-along[1], along[0]] as const;
  const post = (side: number) => ({
    x: along[0] * 16 + across[0] * side * 9,
    // Feet a little lower than his, so they stand on the ground he is aiming for.
    y: along[1] * 16 + across[1] * side * 9 + 2,
  });

  return (
    <>
      <AnimatedG translateX={motion.border.x as unknown as number} translateY={motion.border.y as unknown as number}>
        <AnimatedG scale={counterScale as unknown as number}>
          <AnimatedG opacity={motion.officers as unknown as number}>
            {[-1, 1].map((side) => (
              <G key={side} translateX={post(side).x} translateY={post(side).y}>
                <AnimatedG scale={motion.popIn as unknown as number}>
                  <Ellipse rx={7} ry={2.4} fill="#000" opacity={0.35} />
                  <PoliceOfficer facing={facing === 1 ? -1 : 1} skinTone={side === -1 ? '#F1C59B' : '#8D5A3B'} />
                </AnimatedG>
              </G>
            ))}
          </AnimatedG>
        </AnimatedG>
      </AnimatedG>

      <AnimatedG translateX={motion.explorer.x as unknown as number} translateY={motion.explorer.y as unknown as number}>
        <AnimatedG scale={counterScale as unknown as number}>
          <AnimatedEllipse rx={8} ry={2.6} fill="#000" opacity={motion.shadow as unknown as number} />
          <AnimatedG translateY={motion.lift as unknown as number}>
            <AnimatedG scaleX={motion.scaleX as unknown as number} scaleY={motion.scaleY as unknown as number}>
              {/* Spun about his middle, not his feet. */}
              <G translateY={-18}>
                <AnimatedG rotation={motion.spin as unknown as number}>
                  <G translateY={18}>
                    <G scaleX={facing}>
                      <Explorer skin={skin} facing={facing} />
                    </G>
                  </G>
                </AnimatedG>
              </G>
            </AnimatedG>
          </AnimatedG>
        </AnimatedG>
      </AnimatedG>
    </>
  );
}
