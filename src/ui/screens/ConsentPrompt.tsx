import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import type { Settings } from '../../storage/storage';
import { Button } from '../components/Button';
import { SettingRow, settingCard } from '../components/SettingRow';

export interface ConsentPromptProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onContinue: () => void;
}

/**
 * The one question asked on the way in.
 *
 * Only usage data: personalised ads live in Privacy & data, because there are
 * no ads yet and asking about something the player cannot encounter would be
 * noise. One question is also the most a first run can carry without becoming
 * a form -- which is how consent turns into something people tap through
 * without reading, and a tapped-through yes is not consent.
 *
 * The switch starts off and continuing without touching it leaves it off, so
 * the path of least resistance is the private one rather than the profitable
 * one.
 */
export function ConsentPrompt({ settings, onChange, onContinue }: ConsentPromptProps) {
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entry]);

  return (
    <View style={styles.backdrop}>
      <Animated.View
        style={[
          styles.card,
          {
            opacity: entry,
            transform: [{ translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          },
        ]}
      >
        <Text style={styles.title}>BEFORE YOU START</Text>
        <Text style={styles.line}>
          One thing you can switch on if you want to. It stays off unless you turn it on, and
          you can change it whenever you like in Privacy &amp; data.
        </Text>

        <View style={settingCard}>
          <SettingRow
            label="Send usage data"
            hint="Which countries people get stuck on, so we can fix the levels that are too hard."
            value={settings.analytics}
            onChange={(analytics) => onChange({ ...settings, analytics })}
          />
        </View>

        <Text style={styles.note}>
          Nothing is sent anywhere in this build. Your answer is recorded now so it is already
          in place if that changes.
        </Text>

        <Button label="Continue" variant="primary" onPress={onContinue} style={styles.button} />
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
  line: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  note: {
    color: colors.textFaint,
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
  },
  button: { marginTop: spacing.xs },
});
