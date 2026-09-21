import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { Button } from '../components/Button';

export interface OnboardingOverlayProps {
  onStart: () => void;
}

const STEPS = [
  { flag: '🧭', text: 'You start in one country and need to reach another.' },
  { flag: '🛂', text: 'You can only travel to a country that shares a land border with the one you are in.' },
  { flag: '🏁', text: 'Get there in as few moves as you can.' },
];

/** Three lines, once, then straight into a game. */
export function OnboardingOverlay({ onStart }: OnboardingOverlayProps) {
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entry, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [entry]);

  return (
    <View style={styles.backdrop}>
      <Animated.View
        style={[
          styles.card,
          { opacity: entry, transform: [{ translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
        ]}
      >
        <Text style={styles.title}>HOW IT WORKS</Text>
        {STEPS.map((step) => (
          <View key={step.text} style={styles.step}>
            <Text style={styles.stepFlag}>{step.flag}</Text>
            <Text style={styles.stepText}>{step.text}</Text>
          </View>
        ))}
        <Button label="Start travelling" variant="primary" onPress={onStart} style={styles.button} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5, 10, 18, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSolid,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    gap: spacing.lg,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2.6,
    textAlign: 'center',
  },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepFlag: { fontSize: 19, width: 26 },
  stepText: { flex: 1, color: colors.textMuted, fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21 },
  button: { marginTop: spacing.xs },
});
