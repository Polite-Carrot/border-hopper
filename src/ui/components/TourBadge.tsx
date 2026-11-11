import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import type { Tour } from '../../core/tours';

export interface TourBadgeProps {
  /** A tour, or anything else drawn as a passport badge: a name and an emblem. */
  tour: Pick<Tour, 'name' | 'emoji'>;
  /** The day it was earned, or undefined while it is still to win. */
  earned?: string;
  size?: number;
  /** Show the tour's name under the stamp. */
  label?: boolean;
}

/**
 * A tour's badge, drawn as a passport stamp: a ring of ink, a little crooked,
 * with the tour's emblem in the middle. Faded until it is earned.
 */
export function TourBadge({ tour, earned, size = 64, label = true }: TourBadgeProps) {
  const ink = earned ? colors.gold : colors.textFaint;
  return (
    <View
      style={[styles.wrap, { width: size + 16 }]}
      accessibilityLabel={
        earned
          ? `${tour.name} badge, earned${earned === 'earned' ? '' : ` ${earned}`}`
          : `${tour.name} badge, not earned yet`
      }
    >
      <View
        style={[
          styles.stamp,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: ink,
            transform: [{ rotate: earned ? '-8deg' : '0deg' }],
            opacity: earned ? 1 : 0.4,
          },
        ]}
      >
        <View style={[styles.inner, { borderRadius: size / 2, borderColor: ink }]}>
          <Text style={{ fontSize: size * 0.42 }}>{tour.emoji}</Text>
        </View>
      </View>
      {label ? (
        <>
          <Text style={[styles.name, !earned && styles.faint]} numberOfLines={2}>
            {tour.name}
          </Text>
          {earned ? <Text style={styles.date}>{earned === 'earned' ? 'Earned' : earned}</Text> : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 5 },
  stamp: { borderWidth: 2.5, padding: 3, backgroundColor: 'rgba(255, 206, 106, 0.06)' },
  inner: { flex: 1, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontFamily: fonts.body, fontSize: 11.5, fontWeight: '700', textAlign: 'center' },
  faint: { color: colors.textFaint },
  date: { color: colors.gold, fontSize: 10, fontVariant: ['tabular-nums'] },
});
