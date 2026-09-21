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
  /** Height of the results list, wherever it currently sits. */
  listHeight: number;
  /**
   * The slot below the search field, sized to what the keyboard covers. It
   * holds the country list while the keyboard is closed and is simply left
   * empty -- and hidden behind the keyboard -- while it is open. Keeping it
   * there either way is what stops the search field moving.
   */
  reservedHeight: number;
  /**
   * True while the keyboard is covering the space below the search field. The
   * country list is simply not drawn: the keyboard is standing in its place,
   * and putting the results anywhere else would move the search field.
   */
  keyboardUp: boolean;
  /** Best match for the current query, for the inline go hint. */
  hint?: { flag: string; name: string; onPress: () => void } | null;
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
 * The bottom (or side) control panel: a search field over a scrolling list of
 * countries.
 *
 * The panel is anchored to the bottom of the screen and the list below the
 * search field is given exactly the height the keyboard will cover. So the
 * search field already sits on the keyboard's top edge before one opens, and
 * when it does the keyboard simply takes the list's place -- the field itself
 * does not move at all.
 *
 * While the keyboard is up the list is not drawn at all -- the keyboard is
 * standing exactly where it would be. Typing then narrows to a best match that
 * the keyboard's go key travels to, and dismissing the keyboard brings the
 * list back already filtered.
 *
 * The list always shows the current search results, and an empty query means
 * "every country", so tapping into the field never leaves a blank space where
 * the browsing list used to be -- it just narrows as the player types.
 */
export const ControlPanel = forwardRef<TextInput, ControlPanelProps>(function ControlPanel(
  {
    query, onQueryChange, results, onSelect, onFocus, onBlur, onSubmit,
    currentIso, visited, listHeight, reservedHeight, keyboardUp, hint, docked, bottomInset,
  },
  inputRef
) {
  const visitedSet = new Set(visited);

  const list =
    results.length === 0 ? (
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
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset + spacing.xs }]}
        renderItem={({ item }) => (
          <CountryRow
            country={item}
            onPress={onSelect}
            isCurrent={item.iso2 === currentIso}
            isVisited={visitedSet.has(item.iso2)}
          />
        )}
      />
    );

  return (
    <View style={[styles.panel, docked ? styles.docked : styles.bottom]}>
      {!docked ? <View style={styles.grabber} /> : null}

      <View style={styles.searchWrap}>
        <SearchField
          ref={inputRef}
          value={query}
          onChangeText={onQueryChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onSubmit={onSubmit}
          hint={keyboardUp ? hint : null}
        />
      </View>

      <View style={{ height: docked ? listHeight : reservedHeight }}>
        {keyboardUp && !docked ? null : list}
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
  // No bottom padding: the field's lower edge is the keyboard's top edge.
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  listContent: { paddingTop: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14.5, textAlign: 'center' },
});
