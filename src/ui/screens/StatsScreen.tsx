import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deriveStats, type Stats } from '../../core/stats';
import { formatDuration } from '../../core/format';
import { colors, fonts, spacing } from '../../theme';
import { Button } from '../components/Button';
import { StatTile } from '../components/StatTile';
import { ScreenHeader } from '../components/ScreenHeader';

export interface StatsScreenProps {
  stats: Stats;
  onBack: () => void;
}

export function StatsScreen({ stats, onBack }: StatsScreenProps) {
  const insets = useSafeAreaInsets();
  const derived = deriveStats(stats);
  const never = '—';

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <ScreenHeader title="Statistics" onBack={onBack} />

        <Text style={styles.section}>OVERALL</Text>
        <View style={styles.grid}>
          <StatTile label="PLAYED" value={String(stats.gamesPlayed)} />
          <StatTile label="COMPLETED" value={String(stats.gamesCompleted)} />
          <StatTile label="COMPLETION" value={`${derived.completionPercent}%`} />
        </View>

        <Text style={styles.section}>STREAKS</Text>
        <View style={styles.grid}>
          <StatTile label="CURRENT" value={String(stats.currentStreak)} accent={stats.currentStreak > 0} />
          <StatTile label="LONGEST" value={String(stats.longestStreak)} />
          <StatTile label="DAILY STREAK" value={String(stats.dailyStreak)} />
        </View>

        <Text style={styles.section}>ROUTES</Text>
        <View style={styles.grid}>
          <StatTile
            label="AVG MOVES"
            value={derived.averageMoves === null ? never : derived.averageMoves.toFixed(1)}
          />
          <StatTile label="PERFECT ROUTES" value={String(stats.optimalCompletions)} />
          <StatTile label="PERFECT %" value={`${derived.optimalPercent}%`} />
        </View>

        <Text style={styles.section}>TIME</Text>
        <View style={styles.grid}>
          <StatTile
            label="BEST"
            value={stats.bestSeconds === null ? never : formatDuration(stats.bestSeconds)}
            accent={stats.bestSeconds !== null}
          />
          <StatTile
            label="AVERAGE"
            value={derived.averageSeconds === null ? never : formatDuration(derived.averageSeconds)}
          />
          <StatTile label="WRONG TURNS" value={String(stats.totalWrongGuesses)} />
        </View>

        {stats.gamesPlayed === 0 ? (
          <Text style={styles.empty}>Play a game and your numbers will show up here.</Text>
        ) : null}

        <Button label="Back" onPress={onBack} style={styles.back} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm, maxWidth: 640, width: '100%', alignSelf: 'center' },
  section: {
    color: colors.textMuted,
    fontFamily: fonts.display,
    fontSize: 10.5,
    letterSpacing: 2,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginLeft: spacing.xs,
  },
  grid: { flexDirection: 'row', gap: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: spacing.xl },
  back: { marginTop: spacing.xl },
});
