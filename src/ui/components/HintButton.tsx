import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { Icon } from './Icon';
import { releaseFocus } from './MapControls';

export interface HintButtonProps {
  /** 'outline' before any hint, 'name' once the outline is showing, 'done' after both. */
  next: 'outline' | 'name' | 'done';
  /** Hints still to take this game; at none the button is spent. */
  left: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** How much room the button takes, for placing it. */
export const HINT_BUTTON_SIZE = { width: 96, height: 40 };

/**
 * Help for a stuck player, in two steps: first where to head, then its name.
 * Either one costs the perfect route, and a game has MAX_HINTS of them; the
 * number on the button is how many are left.
 */
export function HintButton({ next, left, onPress, style }: HintButtonProps) {
  const spent = left === 0;
  const done = next === 'done' || spent;
  const label = spent ? 'No hints' : next === 'name' ? 'Name it' : 'Hint';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        spent
          ? 'Hint: none left this game'
          : next === 'done'
            ? 'Hint: already given'
            : `Hint: ${next === 'name' ? 'name the country' : 'show where to head'}, ${left} left`
      }
      accessibilityState={{ disabled: done }}
      aria-disabled={done}
      disabled={done}
      // Let go of focus, or Enter after typing a country presses Hint again.
      onPress={(event) => {
        onPress();
        releaseFocus(event);
      }}
      hitSlop={4}
      style={({ pressed }) => [styles.button, style, done && styles.done, pressed && styles.pressed]}
    >
      <Icon name="bulb" size={16} color={done ? colors.textFaint : colors.gold} />
      <Text style={[styles.label, done && styles.doneLabel]}>{label}</Text>
      {spent ? null : (
        <Text style={[styles.count, done && styles.doneLabel]} accessibilityElementsHidden importantForAccessibility="no">
          {left}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    height: HINT_BUTTON_SIZE.height,
    minWidth: HINT_BUTTON_SIZE.width,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSolid,
    borderWidth: 1,
    borderColor: 'rgba(255, 206, 106, 0.4)',
  },
  label: { color: colors.gold, fontFamily: fonts.body, fontSize: 14, fontWeight: '700' },
  done: { borderColor: colors.hairlineStrong },
  doneLabel: { color: colors.textFaint },
  count: {
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    opacity: 0.75,
  },
  pressed: { opacity: 0.6 },
});
