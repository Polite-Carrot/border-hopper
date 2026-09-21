import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { countryFlag, countryName } from '../../core/world';
import { areNeighbours, isFlightRoute } from '../../core/graph';

export interface RouteTrailProps {
  route: readonly string[];
  destination: string;
  /** True when this game allows sea crossings, so steps can be flights. */
  flights?: boolean;
}

/**
 * The journey so far, as compact flag chips. Scrolls sideways so a ten-country
 * route takes no more room than a two-country one.
 */
export function RouteTrail({ route, destination, flights = false }: RouteTrailProps) {
  const wasFlown = (from: string, to: string) =>
    flights && !areNeighbours(from, to) && isFlightRoute(from, to);

  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    // Keep the newest country in view as the route grows.
    const timer = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [route.length]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.scroller}
    >
      {route.map((iso, index) => (
        <View key={`${iso}-${index}`} style={styles.step}>
          {index > 0 ? (
            <Text style={[styles.arrow, wasFlown(route[index - 1], iso) && styles.flown]}>
              {wasFlown(route[index - 1], iso) ? '✈' : '→'}
            </Text>
          ) : null}
          <View style={[styles.chip, index === route.length - 1 && styles.chipCurrent]}>
            <Text style={styles.flag}>{countryFlag(iso)}</Text>
            <Text
              style={[styles.label, index === route.length - 1 && styles.labelCurrent]}
              numberOfLines={1}
            >
              {countryName(iso)}
            </Text>
          </View>
        </View>
      ))}
      {route[route.length - 1] !== destination ? (
        <View style={styles.step}>
          <Text style={styles.arrow}>→</Text>
          <View style={styles.chipTarget}>
            <Text style={styles.flag}>{countryFlag(destination)}</Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  content: { alignItems: 'center', paddingHorizontal: spacing.lg, gap: 2 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  arrow: { color: colors.textMuted, fontSize: 13, marginHorizontal: 3 },
  flown: { color: colors.destination },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(49, 86, 126, 0.35)',
  },
  chipCurrent: { backgroundColor: 'rgba(61, 189, 248, 0.2)' },
  chipTarget: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 123, 168, 0.55)',
  },
  flag: { fontSize: 14 },
  label: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12.5, fontWeight: '600' },
  labelCurrent: { color: colors.current },
});
