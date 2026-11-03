import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';

export interface SettingRowProps {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** Shown, but not changeable: personalised ads once ads are removed. */
  disabled?: boolean;
}

/**
 * One labelled switch. Shared by Settings and Privacy & data so a toggle in
 * one looks and reads exactly like a toggle in the other.
 */
export function SettingRow({ label, hint, value, onChange, disabled = false }: SettingRowProps) {
  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: 'rgba(120,160,205,0.2)', true: 'rgba(61,189,248,0.5)' }}
        thumbColor={value ? colors.current : '#8098B4'}
      />
    </View>
  );
}

export interface ActionRowProps {
  label: string;
  hint: string;
  /** The button's own text: a price, "Restore", "Removed". */
  action: string;
  onPress: () => void;
  disabled?: boolean;
  /** For screen readers, where the button's text alone is not enough. */
  actionLabel?: string;
}

/** A labelled row with a button where a switch would be: buying, restoring. */
export function ActionRow({ label, hint, action, onPress, disabled = false, actionLabel }: ActionRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel ?? `${label}: ${action}`}
        accessibilityState={{ disabled }}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={onPress}
        hitSlop={6}
        style={({ pressed }) => [styles.action, disabled && styles.actionDisabled, pressed && styles.pressed]}
      >
        <Text style={[styles.actionText, disabled && styles.actionTextDisabled]}>{action}</Text>
      </Pressable>
    </View>
  );
}

/** The card the rows sit in, so both screens group them the same way. */
export const settingCard = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
}).card;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    gap: spacing.md,
  },
  text: { flex: 1 },
  label: { color: colors.text, fontFamily: fonts.body, fontSize: 15.5, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  disabled: { opacity: 0.55 },
  action: {
    minWidth: 84,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.current,
    alignItems: 'center',
  },
  actionDisabled: { backgroundColor: colors.hairlineStrong },
  actionText: { color: '#04121C', fontFamily: fonts.body, fontSize: 14, fontWeight: '700' },
  actionTextDisabled: { color: colors.textMuted },
  pressed: { opacity: 0.7 },
});
