import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { Icon } from './Icon';
import { releaseFocus } from './MapControls';

export interface HintButtonProps {
  /** 'outline' before any hint, 'name' once the outline is showing, 'done' after both. */
  next: 'outline' | 'name' | 'done';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** How much room the button takes, for placing it. */
export const HINT_BUTTON_SIZE = { width: 96, height: 40 };

/**
 * Help for a stuck player, in two steps: first where to head, then its name.
 * Either one costs the perfect route, which is the whole price -- no ads, no
 * limit -- because the alternative is quitting.
 */
export function HintButton({ next, onPress, style }: HintButtonProps) {
  const done = next === 'done';
  const label = next === 'name' ? 'Name it' : 'Hint';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        done ? 'Hint: already given' : next === 'name' ? 'Hint: name the country' : 'Hint: show where to head'
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
  pressed: { opacity: 0.6 },
});
