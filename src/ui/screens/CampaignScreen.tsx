import { useMemo, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAMPAIGN_LENGTH, campaignLevel, type CampaignProgress } from '../../core/campaign';
import { countryFlag } from '../../core/world';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { useLayout } from '../hooks/useLayoutMode';

export interface CampaignScreenProps {
  progress: CampaignProgress;
  onPlayLevel: (level: number) => void;
  onBack: () => void;
  /** Which ladder: the campaign unless told otherwise (Visa Denied). */
  title?: string;
  /** One line under the progress bar: the ladder's rule, if it has one. */
  note?: string;
  length?: number;
  /** The level's destination and best possible moves. */
  entry?: (level: number) => { destination: string; moves: number } | undefined;
}

const COLUMNS = 5;
const TILE_GAP = spacing.sm;

/**
 * A ladder of levels: the campaign, or the Visa Denied campaign. Levels open
 * one at a time, and a finished one can be replayed to improve on it.
 */
export function CampaignScreen({
  progress, onPlayLevel, onBack, title = 'Campaign', note, length = CAMPAIGN_LENGTH, entry = campaignLevel,
}: CampaignScreenProps) {
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const listRef = useRef<FlatList<number>>(null);

  const levels = useMemo(() => Array.from({ length }, (_, i) => i + 1), [length]);
  const complete = (level: number) => progress[level] !== undefined;
  const current = levels.find((level) => !complete(level)) ?? null;
  const done = levels.filter(complete).length;

  const contentWidth = Math.min(560, layout.width) - spacing.lg * 2;
  const tileSize = Math.floor((contentWidth - TILE_GAP * (COLUMNS - 1)) / COLUMNS);
  const rowHeight = tileSize + TILE_GAP;
  // Open on the level the player is up to rather than back at level one.
  const initialRow = Math.max(0, Math.floor(((current ?? length) - 1) / COLUMNS) - 2);

  return (
    <View style={styles.root} onLayout={layout.onLayout}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <ScreenHeader title={title} onBack={onBack} />
        <View style={styles.summary}>
          <Text style={styles.progress}>
            {done} <Text style={styles.progressTotal}>/ {length}</Text>
          </Text>
          <Text style={styles.summaryLabel}>
            {current === null ? `${title} complete` : `Up to level ${current}`}
          </Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${(done / length) * 100}%` }]} />
          </View>
          {note ? <Text style={styles.note}>{note}</Text> : null}
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={levels}
        keyExtractor={(level) => String(level)}
        numColumns={COLUMNS}
        // With numColumns the list virtualises *rows*, so both of these take a
        // row index, not a tile index. Treating them as tiles made every row
        // look a fifth of its height, and the list rendered 800 of the 1000
        // tiles to fill one screen -- harmless at 250 levels, heavy in a
        // phone's WebView at 1000.
        initialScrollIndex={initialRow}
        getItemLayout={(_, row) => ({ length: rowHeight, offset: rowHeight * row, index: row })}
        // Rows again: about two screens' worth to start, then a window of five
        // screens as the player scrolls.
        initialNumToRender={20}
        windowSize={5}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + spacing.xl }]}
        renderItem={({ item: level }) => (
          <LevelTile
            level={level}
            entry={entry(level)}
            size={tileSize}
            complete={complete(level)}
            unlocked={level === 1 || complete(level - 1)}
            isNext={level === current}
            optimal={progress[level]?.optimal ?? false}
            onPress={() => onPlayLevel(level)}
          />
        )}
      />
    </View>
  );
}

interface LevelTileProps {
  level: number;
  entry: { destination: string; moves: number } | undefined;
  size: number;
  complete: boolean;
  unlocked: boolean;
  isNext: boolean;
  optimal: boolean;
  onPress: () => void;
}

function LevelTile({ level, entry, size, complete, unlocked, isNext, optimal, onPress }: LevelTileProps) {
  const label = complete
    ? `Level ${level}, complete`
    : unlocked
      ? `Level ${level}, ${entry?.moves} moves`
      : `Level ${level}, locked`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !unlocked }}
      disabled={!unlocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { width: size, height: size },
        complete && styles.tileComplete,
        isNext && styles.tileNext,
        !unlocked && styles.tileLocked,
        pressed && styles.tilePressed,
      ]}
    >
      <Text style={[styles.tileNumber, complete && styles.tileNumberComplete, !unlocked && styles.tileNumberLocked]}>
        {level}
      </Text>
      {complete ? (
        <Text style={styles.tileStar}>{optimal ? '★' : '·'}</Text>
      ) : unlocked && entry ? (
        <Text style={styles.tileFlag}>{countryFlag(entry.destination)}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  summary: { alignItems: 'center', paddingVertical: spacing.md },
  progress: {
    color: colors.current,
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progressTotal: { color: colors.textMuted, fontSize: 18, fontWeight: '600' },
  summaryLabel: { color: colors.textMuted, fontSize: 12.5, letterSpacing: 0.6, marginTop: 2 },
  note: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: spacing.md },
  bar: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    alignSelf: 'stretch',
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  barFill: { height: 4, borderRadius: radius.pill, backgroundColor: colors.current },
  grid: { paddingHorizontal: spacing.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  row: { gap: TILE_GAP, marginBottom: TILE_GAP },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 1,
  },
  tileComplete: { backgroundColor: 'rgba(61, 189, 248, 0.16)', borderColor: 'rgba(61, 189, 248, 0.35)' },
  tileNext: { borderColor: colors.current, borderWidth: 2 },
  tileLocked: { opacity: 0.4 },
  tilePressed: { opacity: 0.6 },
  tileNumber: { color: colors.text, fontFamily: fonts.display, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tileNumberComplete: { color: colors.current },
  tileNumberLocked: { color: colors.textMuted },
  tileStar: { color: colors.gold, fontSize: 11, lineHeight: 13 },
  tileFlag: { fontSize: 10, lineHeight: 13 },
});
