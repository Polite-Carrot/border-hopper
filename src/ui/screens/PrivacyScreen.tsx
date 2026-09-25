import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../../theme';
import type { Settings } from '../../storage/storage';
import { SettingRow, settingCard } from '../components/SettingRow';
import { ScreenHeader } from '../components/ScreenHeader';

export interface PrivacyScreenProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onBack: () => void;
}

/**
 * Privacy & data, on its own screen rather than buried among the game
 * settings.
 *
 * Consent is the one thing in here a player might come looking for
 * deliberately, perhaps months later and in a hurry, so it gets its own door
 * and room to explain itself instead of two switches in a list.
 */
export function PrivacyScreen({ settings, onChange, onBack }: PrivacyScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <ScreenHeader title="Privacy & data" onBack={onBack} />

        <Text style={styles.intro}>
          Both of these stay off unless you turn them on, and you can change them whenever you
          like.
        </Text>

        <View style={settingCard}>
          <SettingRow
            label="Send usage data"
            hint="Which countries people get stuck on, so we can fix the levels that are too hard."
            value={settings.analytics}
            onChange={(analytics) => onChange({ ...settings, analytics })}
          />
          <SettingRow
            label="Personalised ads"
            hint="Ads matched to your interests. Left off, ads still appear but are generic."
            value={settings.personalisedAds}
            onChange={(personalisedAds) => onChange({ ...settings, personalisedAds })}
          />
        </View>

        <Text style={styles.section}>WHAT THIS BUILD ACTUALLY DOES</Text>
        <View style={settingCard}>
          <Note text="No ads are shown, and nothing is sent anywhere." />
          <Note text="Your statistics, settings and campaign progress are stored on this device. There is no account and no backend." />
          <Note text="The switches above are here so your answer is already recorded, and already no, if that ever changes." />
        </View>
      </ScrollView>
    </View>
  );
}

/** A plain line of explanation, laid out like a row so the card reads evenly. */
function Note({ text }: { text: string }) {
  return (
    <View style={styles.note}>
      <View style={styles.bullet} />
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  intro: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.xs,
  },
  section: {
    color: colors.textMuted,
    fontFamily: fonts.display,
    fontSize: 10.5,
    letterSpacing: 2,
    fontWeight: '700',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 5,
    marginTop: 7,
    backgroundColor: colors.current,
  },
  noteText: { flex: 1, color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
});
