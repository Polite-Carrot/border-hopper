import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';

export interface ToastProps {
  /** Message text, or null to hide. Changing the token replays the animation. */
  message: string | null;
  token: number;
}

/**
 * Feedback for a rejected guess: it slides in, shakes once and leaves on its
 * own. Nothing to dismiss, nothing to tap through.
 */
export function Toast({ message, token }: ToastProps) {
  const entry = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    entry.setValue(0);
    shake.setValue(0);
    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(entry, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(entry, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.timing(shake, { toValue: 1, duration: 320, easing: Easing.linear, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [message, token, entry, shake]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          opacity: entry,
          transform: [
            { translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            {
              translateX: shake.interpolate({
                inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
                outputRange: [0, -7, 6, -4, 2, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(40, 14, 22, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 129, 0.45)',
  },
  text: { color: colors.danger, fontFamily: fonts.body, fontSize: 14, fontWeight: '600' },
});
