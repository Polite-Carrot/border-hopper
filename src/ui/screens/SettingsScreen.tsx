import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '../../theme';
import type { Settings } from '../../storage/storage';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { SettingRow } from '../components/SettingRow';

export interface SettingsScreenProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onReset: () => void;
  onBack: () => void;
  /** Opens Privacy & data, which is a screen of its own. */
  onPrivacy: () => void;
}

export function SettingsScreen({ settings, onChange, onReset, onBack, onPrivacy }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <ScreenHeader title="Settings" onBack={onBack} />

        <Text style={styles.section}>GAME</Text>
        <View style={styles.card}>
          <SettingRow
            label="Haptics"
            hint="Vibrate on moves and mistakes"
            value={settings.haptics}
            onChange={(haptics) => onChange({ ...settings, haptics })}
          />
          <SettingRow
            label="Sound"
            hint="A hop at each border, a jingle when you arrive"
            value={settings.sound}
            onChange={(sound) => onChange({ ...settings, sound })}
          />
          <SettingRow
            label="Reduce motion"
            hint="No camera travel, and no jumping about"
            value={settings.reduceMotion}
            onChange={(reduceMotion) => onChange({ ...settings, reduceMotion })}
          />
        </View>

        <Text style={styles.section}>PRIVACY &amp; DATA</Text>
        <Button label="Usage data and ads" icon="settings" onPress={onPrivacy} />
        <Text style={styles.note}>
          {settings.analytics || settings.personalisedAds
            ? 'Some sharing is switched on.'
            : 'Nothing is being shared.'}
        </Text>

        <Text style={styles.section}>RESET</Text>
        <Button
          label={confirmingReset ? 'Tap again to erase everything' : 'Reset all progress'}
          onPress={() => {
            if (confirmingReset) {
              onReset();
              setConfirmingReset(false);
            } else {
              setConfirmingReset(true);
            }
          }}
        />
        <Text style={styles.note}>
          Your statistics, settings, campaign progress and passport are stored on this device.
          There is no account, so a reset cannot be undone.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
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
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  note: { color: colors.textMuted, fontSize: 12.5, marginTop: spacing.md, textAlign: 'center', lineHeight: 18 },
});
