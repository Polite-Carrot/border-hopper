import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '../../theme';
import type { Settings } from '../../storage/storage';
import { Button } from '../components/Button';
import { DIFFICULTY_OPTIONS } from '../components/difficulty';
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

        <Text style={styles.section}>DIFFICULTY</Text>
        <View style={styles.card}>
          {DIFFICULTY_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              // See DifficultyPicker: web needs `aria-checked`, native needs
              // `accessibilityState`, so both are set.
              accessibilityState={{ checked: settings.difficulty === option.value }}
              aria-checked={settings.difficulty === option.value}
              onPress={() => onChange({ ...settings, difficulty: option.value })}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionHint}>{option.hint}</Text>
              </View>
              <View style={[styles.radio, settings.difficulty === option.value && styles.radioOn]}>
                {settings.difficulty === option.value ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          ))}
        </View>

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
            hint="No sounds ship with this build yet"
            value={settings.sound}
            onChange={(sound) => onChange({ ...settings, sound })}
          />
          <SettingRow
            label="Reduce motion"
            hint="Skip the camera travel animation"
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
          label={confirmingReset ? 'Tap again to erase everything' : 'Reset statistics'}
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
          Your statistics, settings and campaign progress are stored on this device. There is
          no account.
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    gap: spacing.md,
  },
  pressed: { backgroundColor: 'rgba(61, 189, 248, 0.1)' },
  optionText: { flex: 1 },
  optionLabel: { color: colors.text, fontFamily: fonts.body, fontSize: 15.5, fontWeight: '600' },
  optionHint: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.current },
  radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.current },
  note: { color: colors.textMuted, fontSize: 12.5, marginTop: spacing.md, textAlign: 'center', lineHeight: 18 },
});
