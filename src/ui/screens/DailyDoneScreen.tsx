import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { countryFlag, countryName } from '../../core/world';
import { formatDuration, pluralise } from '../../core/format';
import type { GameResult } from '../../core/types';
import { colors, fonts, spacing } from '../../theme';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatTile } from '../components/StatTile';

export interface DailyDoneScreenProps {
  result: GameResult;
  dailyStreak: number;
  onBack: () => void;
  onPlayClassic: () => void;
}

/** Shown when the player opens a daily challenge they have already finished. */
export function DailyDoneScreen({ result, dailyStreak, onBack, onPlayClassic }: DailyDoneScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <ScreenHeader title="Daily challenge" onBack={onBack} />
        <Text style={styles.done}>TODAY IS DONE</Text>
        <Text style={styles.sub}>Come back tomorrow for a new pair of countries.</Text>

        <View style={styles.route}>
          {result.route.map((iso, index) => (
            <Text key={`${iso}-${index}`} style={styles.routeText}>
              {index > 0 ? ' → ' : ''}
              {countryFlag(iso)} {countryName(iso)}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          <StatTile label="MOVES" value={String(result.moves)} accent={result.optimal} />
          <StatTile label="TIME" value={formatDuration(result.seconds)} />
          <StatTile label="DAY STREAK" value={String(dailyStreak)} />
        </View>

        <Text style={styles.footnote}>Best possible was {pluralise(result.optimalMoves, 'move')}.</Text>
        <Button label="Play a random game" variant="primary" icon="play" onPress={onPlayClassic} style={styles.button} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  done: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  sub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: spacing.sm },
  route: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginVertical: spacing.xl },
  routeText: { color: colors.text, fontSize: 14.5, fontWeight: '600' },
  grid: { flexDirection: 'row', gap: spacing.sm },
  footnote: { color: colors.textMuted, fontSize: 12.5, textAlign: 'center', marginTop: spacing.lg },
  button: { marginTop: spacing.xl },
});
