import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import type { Settings } from '../../storage/storage';
import { DIFFICULTY_OPTIONS } from '../components/difficulty';
import { Button } from '../components/Button';

export interface DifficultyPickerProps {
  /** The difficulty already saved, shown as the current choice. */
  current: Settings['difficulty'];
  /** Picking one starts the game immediately. */
  onPick: (difficulty: Settings['difficulty']) => void;
  onCancel: () => void;
}

/**
 * How far do you want to travel? Asked on the way into a random game.
 *
 * Picking starts the game there and then rather than selecting and confirming:
 * the choice *is* the action, and a second tap to agree with yourself is a tap
 * wasted. The saved difficulty comes in marked, and picking a different one
 * replaces it, so this and the Settings screen stay one setting rather than
 * two that disagree.
 */
export function DifficultyPicker({ current, onPick, onCancel }: DifficultyPickerProps) {
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entry]);

  return (
    <View style={styles.backdrop}>
      {/* Tapping the darkened map behind the card backs out, as a sheet should. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={StyleSheet.absoluteFill}
        onPress={onCancel}
      />
      <Animated.View
        style={[
          styles.card,
          {
            opacity: entry,
            transform: [{ translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          },
        ]}
      >
        <View>
          <Text style={styles.title}>RANDOM GAME</Text>
          <Text style={styles.subtitle}>How far do you want to travel?</Text>
        </View>

        <View style={styles.options}>
          {DIFFICULTY_OPTIONS.map((option) => {
            const selected = option.value === current;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={`${option.label}, ${option.hint}`}
                // Both, deliberately: `accessibilityState` is what iOS and
                // Android read, and `aria-checked` is the only one of the two
                // that reaches the DOM on web. Without the second, a screen
                // reader is told there are four options and not which is on.
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                onPress={() => onPick(option.value)}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              >
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionHint}>{option.hint}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioOn]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Button label="Cancel" variant="ghost" onPress={onCancel} />
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
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  options: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    gap: spacing.md,
  },
  pressed: { backgroundColor: 'rgba(61, 189, 248, 0.1)' },
  optionText: { flex: 1 },
  optionLabel: { color: colors.text, fontFamily: fonts.body, fontSize: 15.5, fontWeight: '600' },
  optionHint: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.current },
  radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.current },
});
