import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import type { Country } from '../../core/types';
import { countryName } from '../../core/world';

export interface CountryRowProps {
  country: Country;
  onPress: (iso2: string) => void;
  /** Marks the country the player is standing in. */
  isCurrent?: boolean;
  /** Marks a country already passed through. */
  isVisited?: boolean;
  /** Visa Denied: its border is closed. */
  isClosed?: boolean;
}

function CountryRowComponent({ country, onPress, isCurrent, isVisited, isClosed }: CountryRowProps) {
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
      {/* Territories say whose they are, so nobody wonders why Gibraltar is
          listed among countries -- and why it is never a destination. */}
      {isClosed ? (
        <Text style={styles.closed} numberOfLines={1}>
          Visa denied
        </Text>
      ) : country.territory ? (
        <Text style={styles.territory} numberOfLines={1}>
          {country.sovereign ? `${countryName(country.sovereign)} territory` : 'Territory'}
        </Text>
      ) : null}
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
  closed: { color: colors.danger, fontFamily: fonts.body, fontSize: 12.5, fontWeight: '700' },
  territory: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12.5, maxWidth: '45%' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(61, 189, 248, 0.18)',
  },
  badgeText: { color: colors.current, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
});
