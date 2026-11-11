import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import type { Settings } from '../../storage/storage';
import { difficultyOptions } from '../components/difficulty';
import { Button } from '../components/Button';
import { Icon, type IconName } from '../components/Icon';
import { VISA_NOTES } from '../components/visaNotes';

export type RandomMode = 'classic' | 'flight' | 'visa';

export interface RandomGamePickerProps {
  /** Which mode the sheet opens on -- whichever menu button was pressed. */
  mode: RandomMode;
  /** The difficulty already saved, shown as the current choice. */
  difficulty: Settings['difficulty'];
  onStart: (mode: RandomMode, difficulty: Settings['difficulty']) => void;
  onCancel: () => void;
}

const MODES: { value: RandomMode; label: string; icon: IconName }[] = [
  { value: 'classic', label: 'Land borders', icon: 'again' },
  { value: 'flight', label: 'Flight', icon: 'plane' },
  { value: 'visa', label: 'Visa Denied', icon: 'noentry' },
];

/**
 * How flight mode works, in three lines. The rule fits in one sentence --
 * walk, take a short sea crossing, or fly between hubs -- and the planes on
 * the map show where the hubs are, so nobody has to memorise anything.
 */
const FLIGHT_NOTES = [
  { icon: '✈️', text: 'Hub airports are marked with a plane. From any hub you can fly to any other hub.' },
  { icon: '🌊', text: 'Short hops across water count too: Dover to Calais is 47km, Alaska to Russia 113km.' },
  { icon: '🚶', text: 'Everywhere else you cross borders on foot, so the trick is walking to the right hub.' },
];


/**
 * Sets up a one-off game: how you travel, and how far.
 *
 * Both the Flight and Random buttons on the menu open this, differing only in
 * which mode it starts on -- they are the same game with a different rule, and
 * two sheets that drifted apart would be worse than one.
 */
export function RandomGamePicker({ mode, difficulty, onStart, onCancel }: RandomGamePickerProps) {
  const entry = useRef(new Animated.Value(0)).current;
  const [chosenMode, setChosenMode] = useState<RandomMode>(mode);
  const [chosenDifficulty, setChosenDifficulty] = useState<Settings['difficulty']>(difficulty);

  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entry]);

  const flights = chosenMode === 'flight';
  const notes = flights ? FLIGHT_NOTES : chosenMode === 'visa' ? VISA_NOTES : null;

  return (
    <View style={styles.backdrop}>
      {/* Tapping the darkened map behind the card backs out, as a sheet should. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={StyleSheet.absoluteFill}
        onPress={onCancel}
      />
      <Animated.View
        style={[
          styles.card,
          {
            opacity: entry,
            transform: [{ translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          },
        ]}
      >
        <View>
          <Text style={styles.title}>NEW GAME</Text>
          <Text style={styles.subtitle}>How do you want to travel?</Text>
        </View>

        <View style={styles.modes}>
          {MODES.map((option) => {
            const selected = option.value === chosenMode;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                // Both, deliberately: `accessibilityState` is what iOS and
                // Android read, and `aria-checked` is the only one of the two
                // that reaches the DOM on web.
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                onPress={() => setChosenMode(option.value)}
                style={({ pressed }) => [
                  styles.mode,
                  selected && styles.modeOn,
                  pressed && styles.pressed,
                ]}
              >
                <Icon
                  name={option.icon}
                  size={16}
                  color={selected ? colors.current : colors.textMuted}
                />
                <Text style={[styles.modeLabel, selected && styles.modeLabelOn]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {notes ? (
          <View style={styles.notes}>
            {notes.map((note) => (
              <View key={note.text} style={styles.note}>
                <Text style={styles.noteIcon}>{note.icon}</Text>
                <Text style={styles.noteText}>{note.text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View>
          <Text style={styles.section}>DIFFICULTY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {difficultyOptions(chosenMode).map((option) => {
              const selected = option.value === chosenDifficulty;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.label}, ${option.hint}`}
                  accessibilityState={{ checked: selected }}
                  aria-checked={selected}
                  onPress={() => setChosenDifficulty(option.value)}
                  style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>{option.label}</Text>
                  <Text style={[styles.chipHint, selected && styles.chipHintOn]}>{option.hint}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.footer}>
          <Button
            label={flights ? 'Take off' : 'Start travelling'}
            variant="primary"
            icon={flights ? 'plane' : 'play'}
            onPress={() => onStart(chosenMode, chosenDifficulty)}
          />
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
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
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  pressed: { opacity: 0.7 },

  modes: { flexDirection: 'row', gap: spacing.sm },
  // Icon over label, so three modes fit across a phone.
  mode: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  modeOn: { borderColor: colors.current, backgroundColor: 'rgba(61, 189, 248, 0.14)' },
  modeLabel: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  modeLabelOn: { color: colors.text },

  notes: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  note: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  noteIcon: { fontSize: 15, lineHeight: 20 },
  noteText: { flex: 1, color: colors.textMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },

  section: {
    color: colors.textMuted,
    fontFamily: fonts.display,
    fontSize: 10.5,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  chips: { gap: spacing.sm, paddingRight: spacing.xs, paddingVertical: 2 },
  chip: {
    minWidth: 104,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipOn: { borderColor: colors.current, backgroundColor: 'rgba(61, 189, 248, 0.14)' },
  chipLabel: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14.5, fontWeight: '700' },
  chipLabelOn: { color: colors.text },
  chipHint: { color: colors.textFaint, fontSize: 11.5, marginTop: 2 },
  chipHintOn: { color: colors.textMuted },

  footer: { gap: spacing.sm },
});
