import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '../../theme';
import type { Settings } from '../../storage/storage';
import { Button } from '../components/Button';
import { DIFFICULTY_OPTIONS } from '../components/difficulty';
import { ScreenHeader } from '../components/ScreenHeader';

export interface SettingsScreenProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onReset: () => void;
  onBack: () => void;
}

export function SettingsScreen({ settings, onChange, onReset, onBack }: SettingsScreenProps) {
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
          <Row
            label="Haptics"
            hint="Vibrate on moves and mistakes"
            value={settings.haptics}
            onChange={(haptics) => onChange({ ...settings, haptics })}
          />
          <Row
            label="Sound"
            hint="No sounds ship with this build yet"
            value={settings.sound}
            onChange={(sound) => onChange({ ...settings, sound })}
          />
          <Row
            label="Reduce motion"
            hint="Skip the camera travel animation"
            value={settings.reduceMotion}
            onChange={(reduceMotion) => onChange({ ...settings, reduceMotion })}
          />
        </View>

        <Text style={styles.section}>DATA</Text>
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
          Everything is stored on this device. There is no account and nothing is uploaded.
        </Text>
      </ScrollView>
    </View>
  );
}

interface RowProps {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function Row({ label, hint, value, onChange }: RowProps) {
  return (
    <View style={styles.option}>
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: 'rgba(120,160,205,0.2)', true: 'rgba(61,189,248,0.5)' }}
        thumbColor={value ? colors.current : '#8098B4'}
      />
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
