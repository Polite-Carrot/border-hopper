import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { hourLabel } from '../../reminders';
import { Button } from '../components/Button';

export interface ReminderOfferProps {
  /** What earned the offer: a finished daily, or ten finished games. */
  from: 'daily' | 'games';
  gamesCompleted: number;
  hour: number;
  onYes: () => void;
  onNo: () => void;
}

/**
 * "Daily reminder?", asked once per install.
 *
 * Only this card's "Remind me" brings up the system's notification prompt,
 * which iOS shows an app once, ever: spending it at launch, before the
 * player cares about the daily, would waste it.
 */
export function ReminderOffer({ from, gamesCompleted, hour, onYes, onNo }: ReminderOfferProps) {
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entry]);

  return (
    <View style={styles.backdrop}>
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.card,
          {
            opacity: entry,
            transform: [{ translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          },
        ]}
      >
        <Text style={styles.title} accessibilityRole="header">DAILY REMINDER?</Text>
        {from === 'games' ? (
          <Text style={styles.lead}>
            {gamesCompleted} routes finished, nice travelling! There is also a new daily challenge every day.
          </Text>
        ) : null}
        <Text style={styles.line}>
          One notification a day when the new daily challenge is ready, at {hourLabel(hour)}. None on
          days you have already finished it. Change it or turn it off any time in Settings.
        </Text>
        <View style={styles.actions}>
          <Button label="Remind me" variant="primary" onPress={onYes} />
          <Button label="Not now" variant="ghost" onPress={onNo} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5, 10, 18, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSolid,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    gap: spacing.lg,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2.6,
    textAlign: 'center',
  },
  lead: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  line: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
});
