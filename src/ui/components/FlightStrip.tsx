import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { countryFlag, countryName } from '../../core/world';
import { Icon } from './Icon';

/** "47 km", "12,343 km" -- a departures board, not a rounding exercise. */
const distance = (km: number) => `${km.toLocaleString('en-GB')} km`;

export interface FlightStripProps {
  /** Flights available from the country the player is standing in. */
  flights: readonly { iso2: string; km: number }[];
  onSelect: (iso2: string) => void;
}

/**
 * The departures board.
 *
 * Flight mode is only fair if the player can see where the routes go: the
 * network is deliberately part sea crossing and part long haul, and nobody is
 * expected to memorise it. Land borders stay hidden -- working those out is
 * still the game.
 */
export function FlightStrip({ flights, onSelect }: FlightStripProps) {
  if (flights.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="plane" size={13} color={colors.textFaint} />
        <Text style={styles.emptyText}>No flights from here</Text>
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
