import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import type { Country } from '../../core/types';
import { COUNTRY_ROW_HEIGHT, CountryRow } from './CountryRow';
import { SearchField } from './SearchField';
import { OnScreenKeyboard } from './OnScreenKeyboard';

export interface ControlPanelProps {
  query: string;
  results: readonly Country[];
  onSelect: (iso2: string) => void;
  /** Opens the game's own keyboard. */
  onFocusSearch: () => void;
  onClearSearch: () => void;
  onKey: (character: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  onHideKeyboard: () => void;
  currentIso: string;
  visited: readonly string[];
  /** Height of the results list while it is showing. */
  listHeight: number;
  /**
   * The slot below the search field. It is exactly the keyboard's height and
   * holds the country list until the keyboard takes its place.
   */
  reservedHeight: number;
  /** True while the game's keyboard is up. */
  keyboardUp: boolean;
  /** Width the keyboard lays its keys out across. */
  keyboardWidth: number;
  /** Docks to the side instead of the bottom on wide screens. */
  docked: boolean;
  bottomInset: number;
}

/**
 * The bottom (or side) control panel: a search field over the country list.
 *
 * The slot below the search field is exactly as tall as the game's keyboard,
 * so the field already sits on the keyboard's top edge before it opens. When
 * it does, the keyboard takes the list's place and nothing else moves by a
 * single pixel -- which is only possible because the game owns the keyboard
 * and therefore knows its height up front.
 *
 * The list always shows the current search results, and an empty query means
 * "every country", so it simply narrows as the player types.
 */
export function ControlPanel({
  query, results, onSelect, onFocusSearch, onClearSearch, onKey, onBackspace, onSubmit,
  onHideKeyboard, currentIso, visited, listHeight, reservedHeight, keyboardUp,
  keyboardWidth, docked, bottomInset,
}: ControlPanelProps) {
  const visitedSet = new Set(visited);

  const list = (
    <View style={{ height: listHeight }}>
      {results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No country matches “{query.trim()}”</Text>
        </View>
      ) : (
        <FlatList
          data={results as Country[]}
          keyExtractor={(item) => item.iso2}
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
      )}
    </View>
  );

  return (
    <View style={[styles.panel, docked ? styles.docked : styles.bottom]}>
      {!docked ? <View style={styles.grabber} /> : null}

      <View style={styles.searchWrap}>
        <SearchField value={query} focused={keyboardUp} onPress={onFocusSearch} onClear={onClearSearch} />
      </View>

      <View style={{ height: reservedHeight }}>
        {keyboardUp ? (
          <OnScreenKeyboard
            width={keyboardWidth}
            suggestions={results.slice(0, 3)}
            onKey={onKey}
            onBackspace={onBackspace}
            onSubmit={onSubmit}
            onHide={onHideKeyboard}
            onPickSuggestion={onSelect}
          />
        ) : (
          list
        )}
      </View>
    </View>
  );
}

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
