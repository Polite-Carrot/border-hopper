import { useMemo, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CAMPAIGN_LENGTH, campaignLevel, completedCount, isLevelComplete, isLevelUnlocked, nextLevel,
  type CampaignProgress,
} from '../../core/campaign';
import { countryFlag } from '../../core/world';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { useLayout } from '../hooks/useLayoutMode';

export interface CampaignScreenProps {
  progress: CampaignProgress;
  onPlayLevel: (level: number) => void;
  onBack: () => void;
}

const COLUMNS = 5;
const TILE_GAP = spacing.sm;

/**
 * The campaign ladder. Levels open one at a time, and a finished one can be
 * replayed to improve on it.
 */
export function CampaignScreen({ progress, onPlayLevel, onBack }: CampaignScreenProps) {
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const listRef = useRef<FlatList<number>>(null);

  const levels = useMemo(() => Array.from({ length: CAMPAIGN_LENGTH }, (_, i) => i + 1), []);
  const current = nextLevel(progress);
  const done = completedCount(progress);

  const contentWidth = Math.min(560, layout.width) - spacing.lg * 2;
  const tileSize = Math.floor((contentWidth - TILE_GAP * (COLUMNS - 1)) / COLUMNS);
  const rowHeight = tileSize + TILE_GAP;
  // Open on the level the player is up to rather than back at level one.
  const initialRow = Math.max(0, Math.floor(((current ?? CAMPAIGN_LENGTH) - 1) / COLUMNS) - 2);

  return (
    <View style={styles.root} onLayout={layout.onLayout}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <ScreenHeader title="Campaign" onBack={onBack} />
        <View style={styles.summary}>
          <Text style={styles.progress}>
            {done} <Text style={styles.progressTotal}>/ {CAMPAIGN_LENGTH}</Text>
          </Text>
          <Text style={styles.summaryLabel}>
            {current === null ? 'Campaign complete' : `Up to level ${current}`}
          </Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${(done / CAMPAIGN_LENGTH) * 100}%` }]} />
          </View>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={levels}
        keyExtractor={(level) => String(level)}
        numColumns={COLUMNS}
        initialScrollIndex={initialRow * COLUMNS}
        getItemLayout={(_, index) => ({
          length: rowHeight,
          offset: rowHeight * Math.floor(index / COLUMNS),
          index,
        })}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + spacing.xl }]}
        renderItem={({ item: level }) => (
          <LevelTile
            level={level}
            size={tileSize}
            complete={isLevelComplete(progress, level)}
            unlocked={isLevelUnlocked(progress, level)}
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
  size: number;
  complete: boolean;
  unlocked: boolean;
  isNext: boolean;
  optimal: boolean;
  onPress: () => void;
}

function LevelTile({ level, size, complete, unlocked, isNext, optimal, onPress }: LevelTileProps) {
  const entry = campaignLevel(level);
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
