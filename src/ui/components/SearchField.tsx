import { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { Icon } from './Icon';

export interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmit?: () => void;
  placeholder?: string;
  /**
   * The country the go key would travel to, shown inside the field while the
   * keyboard is hiding the list. Inline so the field keeps its height and
   * nothing in the panel shifts.
   */
  hint?: { flag: string; name: string; onPress: () => void } | null;
}

/**
 * A plain TextInput, so the platform's own keyboard is the only keyboard.
 * `returnKeyType="go"` lets the player travel straight from the keyboard.
 */
export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
  { value, onChangeText, onFocus, onBlur, onSubmit, placeholder = 'Search country…', hint },
  ref
) {
  return (
    <View style={styles.wrapper}>
      <Icon name="search" size={18} color={colors.textMuted} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        returnKeyType="go"
        blurOnSubmit={false}
        accessibilityLabel="Search for a country"
        selectionColor={colors.current}
      />
      {hint ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Travel to ${hint.name}`}
          onPress={hint.onPress}
          hitSlop={6}
          style={({ pressed }) => [styles.hint, pressed && styles.hintPressed]}
        >
          <Text style={styles.hintFlag}>{hint.flag}</Text>
          <Text style={styles.hintName} numberOfLines={1}>
            {hint.name}
          </Text>
          <Text style={styles.hintKey}>↵</Text>
        </Pressable>
      ) : null}

      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={10}
        >
          <Icon name="close" size={17} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
});

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
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '52%',
    paddingLeft: 9,
    paddingRight: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(61, 189, 248, 0.16)',
  },
  hintPressed: { opacity: 0.6 },
  hintFlag: { fontSize: 13 },
  hintName: { color: colors.current, fontFamily: fonts.body, fontSize: 13.5, fontWeight: '600', flexShrink: 1 },
  hintKey: { color: colors.current, fontSize: 12, opacity: 0.7 },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16.5,
    padding: 0,
    // Removes the focus ring react-native-web adds to inputs.
    outlineStyle: 'none',
  } as never,
});
