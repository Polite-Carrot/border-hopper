import { StyleSheet, Switch, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';

export interface SettingRowProps {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/**
 * One labelled switch. Shared by Settings and Privacy & data so a toggle in
 * one looks and reads exactly like a toggle in the other.
 */
export function SettingRow({ label, hint, value, onChange }: SettingRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: 'rgba(120,160,205,0.2)', true: 'rgba(61,189,248,0.5)' }}
        thumbColor={value ? colors.current : '#8098B4'}
      />
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
});
