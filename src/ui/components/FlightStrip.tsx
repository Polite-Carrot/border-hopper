import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { countryFlag, countryName } from '../../core/world';
import { Icon } from './Icon';

export interface FlightStripProps {
  /** Sea crossings available from the country the player is standing in. */
  crossings: readonly { iso2: string; km: number }[];
  onSelect: (iso2: string) => void;
}

/**
 * The departures board.
 *
 * Flight mode is only fair if the player can see where the water goes: nobody
 * knows off-hand that the United States can reach Russia across the Bering
 * Strait. Land borders stay hidden -- working those out is still the game.
 */
export function FlightStrip({ crossings, onSelect }: FlightStripProps) {
  if (crossings.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="plane" size={13} color={colors.textFaint} />
        <Text style={styles.emptyText}>No sea crossings from here</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.strip}
    >
      <View style={styles.label}>
        <Icon name="plane" size={13} color={colors.destination} />
      </View>
      {crossings.map((crossing) => (
        <Pressable
          key={crossing.iso2}
          accessibilityRole="button"
          accessibilityLabel={`Fly to ${countryName(crossing.iso2)}, ${crossing.km} kilometres`}
          onPress={() => onSelect(crossing.iso2)}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        >
          <Text style={styles.flag}>{countryFlag(crossing.iso2)}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {countryName(crossing.iso2)}
          </Text>
          <Text style={styles.km}>{crossing.km}km</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { flexGrow: 0 },
  content: { alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  label: { paddingRight: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 9,
    paddingRight: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 123, 168, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 123, 168, 0.3)',
  },
  chipPressed: { opacity: 0.6 },
  flag: { fontSize: 13 },
  name: { color: colors.destination, fontFamily: fonts.body, fontSize: 13, fontWeight: '600' },
  km: { color: colors.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  emptyText: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12.5 },
});
