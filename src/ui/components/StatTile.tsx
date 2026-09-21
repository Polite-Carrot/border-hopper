import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';

export interface StatTileProps {
  label: string;
  value: string;
  accent?: boolean;
}

export function StatTile({ label, value, accent }: StatTileProps) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.value, accent && styles.accent]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
  },
  value: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  accent: { color: colors.current },
  label: {
    color: colors.textMuted,
    fontSize: 10.5,
    letterSpacing: 0.9,
    fontWeight: '600',
    marginTop: 5,
    textAlign: 'center',
  },
});
