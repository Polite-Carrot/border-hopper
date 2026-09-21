import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import type { Country } from '../../core/types';

export interface CountryRowProps {
  country: Country;
  onPress: (iso2: string) => void;
  /** Marks the country the player is standing in. */
  isCurrent?: boolean;
  /** Marks a country already passed through. */
  isVisited?: boolean;
}

function CountryRowComponent({ country, onPress, isCurrent, isVisited }: CountryRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Travel to ${country.name}`}
      onPress={() => onPress(country.iso2)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.flag}>{country.flag}</Text>
      <Text
        style={[styles.name, isCurrent && styles.current, isVisited && !isCurrent && styles.visited]}
        numberOfLines={1}
      >
        {country.name}
      </Text>
      {isCurrent ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>YOU</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Memoised: the list re-renders on every keystroke, the rows should not. */
export const CountryRow = memo(CountryRowComponent);

export const COUNTRY_ROW_HEIGHT = 50;

const styles = StyleSheet.create({
  row: {
    height: COUNTRY_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: 'rgba(61, 189, 248, 0.14)' },
  flag: { fontSize: 22, width: 30 },
  name: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 16.5, letterSpacing: 0.1 },
  current: { color: colors.current, fontWeight: '600' },
  visited: { color: colors.textMuted },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(61, 189, 248, 0.18)',
  },
  badgeText: { color: colors.current, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
});
