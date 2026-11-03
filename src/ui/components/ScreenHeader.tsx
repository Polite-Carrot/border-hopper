import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { Icon } from './Icon';

export interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  /**
   * Straight to the main menu. Defaults to `onBack`, which is the menu for
   * every screen opened from it; a screen opened from another (Privacy &
   * data, from Settings) passes its own.
   */
  onClose?: () => void;
}

/** Back on the left, the title, and an X on the right that always means "main menu". */
export function ScreenHeader({ title, onBack, onClose = onBack }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        hitSlop={12}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Icon name="back" size={20} color={colors.text} />
      </Pressable>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close, back to the main menu"
        onPress={onClose}
        hitSlop={12}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Icon name="close" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  back: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  pressed: { opacity: 0.6 },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2.6,
  },
});
