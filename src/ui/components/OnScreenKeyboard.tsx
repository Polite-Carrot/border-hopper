import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import type { Country } from '../../core/types';
import { haptic } from '../hooks/useHaptics';
import { play } from '../../audio/sounds';
import { Icon } from './Icon';

const ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const GAP = 6;
const PAD = 5;
const COLUMNS = 10;
const SUGGESTION_STRIP = 46;

/** Key size for a given panel width, so the keyboard fills it edge to edge. */
function keyMetrics(width: number) {
  const keyWidth = (width - PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const keyHeight = Math.max(40, Math.min(54, keyWidth * 1.38));
  return { keyWidth, keyHeight };
}

/**
 * Exact height the keyboard will occupy. The control panel reserves this much
 * room, which is the whole point of owning the keyboard: the height is known
 * before it is ever shown, so nothing has to move when it appears.
 */
export function onScreenKeyboardHeight(width: number): number {
  const { keyHeight } = keyMetrics(width);
  return Math.round(SUGGESTION_STRIP + (keyHeight + GAP) * 4 + PAD);
}

export interface OnScreenKeyboardProps {
  width: number;
  /** Top matches for the current query, offered above the keys. */
  suggestions: readonly Country[];
  onKey: (character: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  onHide: () => void;
  onPickSuggestion: (iso2: string) => void;
}

function KeyboardComponent({
  width, suggestions, onKey, onBackspace, onSubmit, onHide, onPickSuggestion,
}: OnScreenKeyboardProps) {
  const { keyWidth, keyHeight } = keyMetrics(width);

  const tap = (action: () => void) => () => {
    haptic('light');
    play('tap');
    action();
  };

  const renderKey = (label: string, onPress: () => void, span = 1, tone?: 'accent' | 'muted') => (
    <Pressable
      key={label + span}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={tap(onPress)}
      style={({ pressed }) => [
        styles.key,
        {
          width: keyWidth * span + GAP * (span - 1),
          height: keyHeight,
        },
        tone === 'accent' && styles.keyAccent,
        tone === 'muted' && styles.keyMuted,
        pressed && styles.keyPressed,
      ]}
    >
      <Text style={[styles.keyLabel, tone === 'accent' && styles.keyLabelAccent]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.keyboard, { height: onScreenKeyboardHeight(width) }]}>
      <View style={styles.strip}>
        {suggestions.length === 0 ? (
          <Text style={styles.stripHint}>Type a country name</Text>
        ) : (
          suggestions.map((country) => (
            <Pressable
              key={country.iso2}
              accessibilityRole="button"
              accessibilityLabel={`Travel to ${country.name}`}
              onPress={tap(() => onPickSuggestion(country.iso2))}
              style={({ pressed }) => [styles.suggestion, pressed && styles.keyPressed]}
            >
              <Text style={styles.suggestionFlag}>{country.flag}</Text>
              <Text style={styles.suggestionName} numberOfLines={1}>
                {country.name}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      {ROWS.map((row, index) => (
        <View key={index} style={styles.row}>
          {index === 2 ? <View style={{ width: keyWidth * 1.5 + GAP * 0.5 }} /> : null}
          {row.map((letter) => renderKey(letter, () => onKey(letter)))}
          {index === 2 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete"
              onPress={tap(onBackspace)}
              style={({ pressed }) => [
                styles.key,
                styles.keyMuted,
                { width: keyWidth * 1.5 + GAP * 0.5, height: keyHeight },
                pressed && styles.keyPressed,
              ]}
            >
              <Icon name="back" size={20} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      ))}

      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hide keyboard"
          onPress={tap(onHide)}
          style={({ pressed }) => [
            styles.key,
            styles.keyMuted,
            { width: keyWidth * 1.5 + GAP * 0.5, height: keyHeight },
            pressed && styles.keyPressed,
          ]}
        >
          <Text style={styles.keyLabel}>⌄</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Space"
          onPress={tap(() => onKey(' '))}
          style={({ pressed }) => [styles.key, styles.space, { height: keyHeight }, pressed && styles.keyPressed]}
        >
          <Text style={styles.spaceLabel}>space</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Travel"
          onPress={tap(onSubmit)}
          style={({ pressed }) => [
            styles.key,
            styles.keyAccent,
            { width: keyWidth * 2 + GAP, height: keyHeight },
            pressed && styles.keyPressed,
          ]}
        >
          <Text style={[styles.keyLabel, styles.keyLabelAccent]}>GO</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const OnScreenKeyboard = memo(KeyboardComponent);

const styles = StyleSheet.create({
  keyboard: { paddingHorizontal: PAD, paddingBottom: PAD },
  strip: {
    height: SUGGESTION_STRIP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingHorizontal: 2,
  },
  stripHint: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, paddingLeft: 4 },
  suggestion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: 'rgba(61, 189, 248, 0.14)',
  },
  suggestionFlag: { fontSize: 14 },
  suggestionName: { color: colors.current, fontFamily: fonts.body, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: GAP, marginTop: GAP },
  key: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: '#263449',
  },
  keyMuted: { backgroundColor: '#1A2536' },
  keyAccent: { backgroundColor: colors.current },
  keyPressed: { opacity: 0.55 },
  keyLabel: { color: colors.text, fontFamily: fonts.body, fontSize: 19, fontWeight: '500' },
  keyLabelAccent: { color: '#04121C', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  space: { flex: 1 },
  spaceLabel: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, letterSpacing: 0.5 },
});
