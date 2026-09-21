import { forwardRef } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import type { Country } from '../../core/types';
import { COUNTRY_ROW_HEIGHT, CountryRow } from './CountryRow';
import { SearchField } from './SearchField';

export interface ControlPanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  results: readonly Country[];
  onSelect: (iso2: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: () => void;
  currentIso: string;
  visited: readonly string[];
  /** Height available to the scrolling list, worked out by the screen. */
  listHeight: number;
  /** Docks to the side instead of the bottom on wide screens. */
  docked: boolean;
  /**
   * Padding below the search field. This is the safe-area inset normally, and
   * zero while the keyboard is up -- the keyboard already covers that space,
   * and dropping it is what lets the field sit flush against the keyboard.
   */
  bottomInset: number;
}

/**
 * The bottom (or side) control panel: a scrolling list of countries above a
 * search field.
 *
 * The search field is deliberately the last thing in the panel. The panel is
 * anchored to the top of the keyboard, so keeping the field at the bottom puts
 * it right against the keyboard when one opens, with the results directly
 * above it -- and nothing has to reorder or move relative to anything else.
 *
 * The list always shows the current search results, and an empty query means
 * "every country", so tapping into the field never leaves a blank space where
 * the browsing list used to be -- it just narrows as the player types.
 */
export const ControlPanel = forwardRef<TextInput, ControlPanelProps>(function ControlPanel(
  {
    query, onQueryChange, results, onSelect, onFocus, onBlur, onSubmit,
    currentIso, visited, listHeight, docked, bottomInset,
  },
  inputRef
) {
  const visitedSet = new Set(visited);

  return (
    <View style={[styles.panel, docked ? styles.docked : styles.bottom]}>
      {!docked ? <View style={styles.grabber} /> : null}

      <View style={{ height: listHeight }}>
        {results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No country matches “{query.trim()}”</Text>
          </View>
        ) : (
          <FlatList
            data={results as Country[]}
            keyExtractor={(item) => item.iso2}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            initialNumToRender={12}
            windowSize={7}
            removeClippedSubviews
            getItemLayout={(_, index) => ({
              length: COUNTRY_ROW_HEIGHT,
              offset: COUNTRY_ROW_HEIGHT * index,
              index,
            })}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <CountryRow
                country={item}
                onPress={onSelect}
                isCurrent={item.iso2 === currentIso}
                isVisited={visitedSet.has(item.iso2)}
              />
            )}
          />
        )}
      </View>

      <View style={[styles.searchWrap, { paddingBottom: bottomInset }]}>
        <SearchField
          ref={inputRef}
          value={query}
          onChangeText={onQueryChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onSubmit={onSubmit}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.hairlineStrong,
  },
  bottom: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  docked: {
    borderLeftWidth: 1,
    paddingTop: spacing.lg,
    height: '100%',
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.hairlineStrong,
    marginBottom: spacing.sm,
  },
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  listContent: { paddingVertical: spacing.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14.5, textAlign: 'center' },
});
