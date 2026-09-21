import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { Icon } from './Icon';

export interface SearchFieldProps {
  value: string;
  onPress: () => void;
  onClear: () => void;
  focused: boolean;
  placeholder?: string;
}

/**
 * The query display.
 *
 * Deliberately not a TextInput: a focused TextInput summons the platform
 * keyboard, whose height the game cannot know in advance and which mobile
 * browsers respond to by moving the viewport. The game brings its own
 * keyboard, so this only has to render the text and a caret.
 */
export function SearchField({ value, onPress, onClear, focused, placeholder = 'Search country…' }: SearchFieldProps) {
  const caret = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!focused) return;
    caret.setValue(1);
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(caret, { toValue: 0, duration: 450, delay: 350, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(caret, { toValue: 1, duration: 450, delay: 100, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [focused, caret]);

  return (
    <Pressable
      accessibilityRole="search"
      accessibilityLabel={value ? `Search: ${value}` : 'Search for a country'}
      onPress={onPress}
      style={[styles.wrapper, focused && styles.wrapperFocused]}
    >
      <Icon name="search" size={18} color={focused ? colors.current : colors.textMuted} />

      <View style={styles.textRow}>
        <Text style={[styles.text, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        {focused ? <Animated.View style={[styles.caret, { opacity: caret }]} /> : null}
      </View>

      {value.length > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={onClear} hitSlop={10}>
          <Icon name="close" size={17} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  wrapperFocused: { borderColor: 'rgba(61, 189, 248, 0.5)' },
  textRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  text: { color: colors.text, fontFamily: fonts.body, fontSize: 16.5, flexShrink: 1 },
  placeholder: { color: colors.textMuted },
  caret: { width: 2, height: 21, marginLeft: 2, borderRadius: 1, backgroundColor: colors.current },
});
