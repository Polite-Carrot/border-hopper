import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { PoliteCarrotMark } from '../components/PoliteCarrotMark';
import { PoliteCarrotWordmark } from '../components/PoliteCarrotWordmark';

/**
 * Timings lifted from the studio's boot splash so every Polite Carrot game
 * opens identically. The web original does this in CSS keyframes; the numbers
 * here are the same ones.
 */
const MARK_DELAY = 180;
const MARK_DURATION = 700;
const NAME_DELAY = 720;
const NAME_DURATION = 550;
/** How long the finished lockup sits there before it starts to leave. */
const HOLD = 2300;
const FADE_DURATION = 550;

export interface BootScreenProps {
  /** Called once the splash has faded out and should stop being rendered. */
  onDone: () => void;
  reduceMotion: boolean;
}

/**
 * The startup identity: the carrot, then the name, then out of the way.
 *
 * The menu underneath is already mounted and laid out behind it, so the game
 * is ready to play the instant the splash clears rather than starting to build
 * itself then. Unlike the web original this does swallow taps: there the thing
 * behind the splash is a canvas nobody can press by accident, here it is a
 * menu, and a tap landing on a button you cannot see would start a game.
 */
export function BootScreen({ onDone, reduceMotion }: BootScreenProps) {
  const { width, height } = useWindowDimensions();
  // Frozen on the first render. Settings load from storage a few milliseconds
  // in, and letting that change restart the sequence would stutter the splash.
  const reduce = useRef(reduceMotion);
  const mark = useRef(new Animated.Value(0)).current;
  const name = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Reduced motion still shows the lockup, and for the same length of time:
    // it is an identity, not a flourish. Only the movement goes.
    const reduceMotion = reduce.current;
    // A duration of 1ms rather than 0 so the value still lands on its end
    // state through the same code path.
    const instant = 1;
    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(mark, {
          toValue: 1,
          delay: reduceMotion ? 0 : MARK_DELAY,
          duration: reduceMotion ? instant : MARK_DURATION,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(name, {
          toValue: 1,
          delay: reduceMotion ? 0 : NAME_DELAY,
          duration: reduceMotion ? instant : NAME_DURATION,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ]),
      // Measured from when the lockup finished arriving, so the identity is on
      // screen for HOLD either way. Subtracting the full entrance regardless
      // would cut reduced motion's splash by the 1.27s it never spent.
      Animated.delay(Math.max(0, HOLD - (reduceMotion ? instant : NAME_DELAY + NAME_DURATION))),
      Animated.timing(fade, {
        toValue: 0,
        duration: FADE_DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    sequence.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => sequence.stop();
  }, [mark, name, fade, onDone]);

  // The same lockup proportions as the web original: bounded by the narrower
  // of the two axes so it never overflows a short landscape window.
  const lockup = Math.min(width * 0.68, height * 0.52, 360);

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <View style={{ width: lockup, alignItems: 'center' }}>
        <Animated.View
          style={{
            opacity: mark,
            transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
          }}
        >
          <PoliteCarrotMark size={lockup * 0.92} />
        </Animated.View>
        <Animated.View
          style={{
            marginTop: 12,
            opacity: name,
            transform: [{ translateY: name.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          }}
        >
          <PoliteCarrotWordmark width={lockup} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
