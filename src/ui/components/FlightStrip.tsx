import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { countryFlag, countryName } from '../../core/world';
import { Icon } from './Icon';

/** "47 km", "12,343 km" -- a departures board, not a rounding exercise. */
const distance = (km: number) => `${km.toLocaleString('en-GB')} km`;

export interface FlightStripProps {
  /** Flights available from the country the player is standing in. */
  flights: readonly { iso2: string; km: number }[];
  /** Whether the player is standing in a hub airport. */
  hub: boolean;
  onSelect: (iso2: string) => void;
}

/**
 * The departures board.
 *
 * Flight mode is only fair if the player can see where the flights go. The
 * rule is short -- any hub flies to any other hub, and the nearest sea
 * crossing always counts -- and the board says which of the two applies
 * where they stand. Land borders stay hidden: working those out is still the
 * game.
 */
export function FlightStrip({ flights, hub, onSelect }: FlightStripProps) {
  if (flights.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="plane" size={13} color={colors.textFaint} />
        <Text style={styles.emptyText}>No airport here. Walk to a hub to fly.</Text>
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
      {hub ? (
        <View style={styles.hubBadge} accessibilityLabel="Hub airport: fly to any other hub">
          <Icon name="plane" size={12} color={colors.background} />
          <Text style={styles.hubText}>HUB</Text>
        </View>
      ) : (
        <View style={styles.label}>
          <Icon name="plane" size={13} color={colors.destination} />
        </View>
      )}
      {flights.map((flight) => (
        <Pressable
          key={flight.iso2}
          accessibilityRole="button"
          accessibilityLabel={`Fly to ${countryName(flight.iso2)}, ${flight.km} kilometres`}
          onPress={() => onSelect(flight.iso2)}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        >
          <Text style={styles.flag}>{countryFlag(flight.iso2)}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {countryName(flight.iso2)}
          </Text>
          <Text style={styles.km}>{distance(flight.km)}</Text>
        </Pressable>
      ))}
      {hub ? null : <Text style={styles.more}>Walk to a hub to fly further</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { flexGrow: 0 },
  content: { alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  label: { paddingRight: 2 },
  hubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.destination,
  },
  hubText: { color: colors.background, fontFamily: fonts.display, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2 },
  more: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12, paddingLeft: 4 },
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
