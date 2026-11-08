import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  TOURS, badgeCount, isTourLevelUnlocked, tourById, tourDone, tourNextLevel, type Tour, type ToursProgress,
} from '../../core/tours';
import { countryFlag } from '../../core/world';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { TourBadge } from '../components/TourBadge';
import { useLayout } from '../hooks/useLayoutMode';

export interface ToursScreenProps {
  progress: ToursProgress;
  /** The tour whose levels are showing, or null for the list of tours. */
  selected: string | null;
  onSelect: (id: string | null) => void;
  onPlayLevel: (id: string, level: number) => void;
  /** Back to the main menu. */
  onClose: () => void;
}

const COLUMNS = 5;
const MAX_WIDTH = 560;

/**
 * Continent tours: short themed runs of levels, each ending in a passport
 * badge. The list first; pick a tour to see its levels, which open one at a
 * time like the campaign's.
 */
export function ToursScreen({ progress, selected, onSelect, onPlayLevel, onClose }: ToursScreenProps) {
  const insets = useSafeAreaInsets();
  const tour = selected ? tourById(selected) : undefined;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        {tour ? (
          <TourLevels tour={tour} progress={progress} onBack={() => onSelect(null)} onClose={onClose} onPlay={onPlayLevel} />
        ) : (
          <>
            <ScreenHeader title="Continent tours" onBack={onClose} />
            <View style={styles.collection}>
              <Text style={styles.count}>
                <Text style={styles.countNumber}>{badgeCount(progress)}</Text>
                <Text style={styles.countOf}> of {TOURS.length} badges</Text>
              </Text>
              <View style={styles.badges}>
                {TOURS.map((item) => (
                  <TourBadge key={item.id} tour={item} earned={progress.badges[item.id]} size={46} label={false} />
                ))}
              </View>
            </View>
            {TOURS.map((item) => (
              <TourCard key={item.id} tour={item} progress={progress} onPress={() => onSelect(item.id)} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TourCard({ tour, progress, onPress }: { tour: Tour; progress: ToursProgress; onPress: () => void }) {
  const done = tourDone(progress, tour.id);
  const total = tour.levels.length;
  const earned = progress.badges[tour.id];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tour.name}: ${done} of ${total} levels${earned ? ', badge earned' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, earned && styles.cardEarned, pressed && styles.pressed]}
    >
      <TourBadge tour={tour} earned={earned} size={50} label={false} />
      <View style={styles.cardText}>
        <Text style={styles.cardName}>{tour.name}</Text>
        <Text style={styles.cardBlurb}>{tour.blurb}</Text>
        <View style={styles.cardProgress}>
          <View style={styles.bar}>
            <View style={[styles.barFill, earned && styles.barEarned, { width: `${(done / total) * 100}%` }]} />
          </View>
          <Text style={styles.cardCount}>
            {done}/{total}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function TourLevels({
  tour, progress, onBack, onClose, onPlay,
}: {
  tour: Tour;
  progress: ToursProgress;
  onBack: () => void;
  onClose: () => void;
  onPlay: (id: string, level: number) => void;
}) {
  const layout = useLayout();
  const done = tourDone(progress, tour.id);
  const next = tourNextLevel(progress, tour.id);
  const earned = progress.badges[tour.id];
  // The measured width of this view, already inside the screen's padding.
  const width = Math.min(layout.width, MAX_WIDTH - spacing.lg * 2);
  const tile = Math.floor((width - spacing.sm * (COLUMNS - 1)) / COLUMNS);

  return (
    <View onLayout={layout.onLayout}>
      <ScreenHeader title={tour.name} onBack={onBack} onClose={onClose} />
      <View style={styles.hero}>
        <TourBadge tour={tour} earned={earned} size={84} label={false} />
        <Text style={styles.heroCount}>
          {done} <Text style={styles.heroTotal}>/ {tour.levels.length}</Text>
        </Text>
        <Text style={styles.heroBlurb}>
          {earned
            ? `Badge earned ${earned}. Replay any level to beat your score.`
            : `${tour.blurb} Finish every level to earn the badge.`}
        </Text>
      </View>
      <View style={[styles.grid, { gap: spacing.sm }]}>
        {tour.levels.map((entry) => {
          const record = progress.levels[tour.id]?.[entry.level];
          const unlocked = isTourLevelUnlocked(progress, tour.id, entry.level);
          return (
            <Pressable
              key={entry.level}
              accessibilityRole="button"
              accessibilityLabel={
                record ? `Level ${entry.level}, complete` : unlocked ? `Level ${entry.level}, ${entry.moves} moves` : `Level ${entry.level}, locked`
              }
              accessibilityState={{ disabled: !unlocked }}
              disabled={!unlocked}
              onPress={() => onPlay(tour.id, entry.level)}
              style={({ pressed }) => [
                styles.tile,
                { width: tile, height: tile },
                record && styles.tileDone,
                entry.level === next && styles.tileNext,
                !unlocked && styles.tileLocked,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.tileNumber, record && styles.tileNumberDone]}>{entry.level}</Text>
              {record ? (
                <Text style={styles.tileStar}>{record.optimal ? '★' : '·'}</Text>
              ) : unlocked ? (
                <Text style={styles.tileFlag}>{countryFlag(entry.destination)}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center', gap: spacing.md },
  pressed: { opacity: 0.65 },
  collection: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  count: { marginTop: spacing.xs },
  countNumber: { color: colors.gold, fontFamily: fonts.display, fontSize: 26, fontWeight: '800' },
  countOf: { color: colors.textMuted, fontSize: 14 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cardEarned: { borderColor: 'rgba(255, 206, 106, 0.45)' },
  cardText: { flex: 1, gap: 3 },
  cardName: { color: colors.text, fontFamily: fonts.body, fontSize: 16, fontWeight: '700' },
  cardBlurb: { color: colors.textMuted, fontSize: 12.5, lineHeight: 17 },
  cardProgress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  bar: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.hairline, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: radius.pill, backgroundColor: colors.current },
  barEarned: { backgroundColor: colors.gold },
  cardCount: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'], minWidth: 38, textAlign: 'right' },
  hero: { alignItems: 'center', gap: spacing.xs, marginVertical: spacing.sm },
  heroCount: { color: colors.current, fontFamily: fonts.display, fontSize: 28, fontWeight: '800', marginTop: spacing.sm },
  heroTotal: { color: colors.textMuted, fontSize: 17, fontWeight: '600' },
  heroBlurb: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 360 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 1,
  },
  tileDone: { backgroundColor: 'rgba(61, 189, 248, 0.16)', borderColor: 'rgba(61, 189, 248, 0.35)' },
  tileNext: { borderColor: colors.current, borderWidth: 2 },
  tileLocked: { opacity: 0.4 },
  tileNumber: { color: colors.text, fontFamily: fonts.display, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tileNumberDone: { color: colors.current },
  tileStar: { color: colors.gold, fontSize: 11, lineHeight: 13 },
  tileFlag: { fontSize: 10, lineHeight: 13 },
});
