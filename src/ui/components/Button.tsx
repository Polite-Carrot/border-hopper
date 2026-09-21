import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { play } from '../../audio/sounds';
import { Icon, type IconName } from './Icon';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: IconName;
  style?: ViewStyle;
  disabled?: boolean;
}

/** Buttons dip slightly when pressed; nothing else moves. */
export function Button({ label, onPress, variant = 'secondary', icon, style, disabled }: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 4 }).start();

  const isPrimary = variant === 'primary';
  const tint = disabled ? colors.textMuted : isPrimary ? '#04121C' : colors.text;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPressIn={() => spring(0.97)}
        onPressOut={() => spring(1)}
        onPress={() => {
          play('tap');
          onPress();
        }}
        style={[
          styles.base,
          isPrimary && styles.primary,
          variant === 'secondary' && styles.secondary,
          variant === 'ghost' && styles.ghost,
          disabled && styles.disabled,
        ]}
      >
        {icon ? (
          <View style={styles.icon}>
            <Icon name={icon} size={18} color={tint} />
          </View>
        ) : null}
        <Text style={[styles.label, { color: tint }, isPrimary && styles.labelPrimary]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  primary: { backgroundColor: colors.current },
  secondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  ghost: { backgroundColor: 'transparent', paddingVertical: 12 },
  disabled: { opacity: 0.45 },
  icon: { marginRight: 2 },
  label: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelPrimary: { fontWeight: '700' },
});
