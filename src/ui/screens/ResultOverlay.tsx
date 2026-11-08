import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { countryFlag, countryName } from '../../core/world';
import { formatDuration, pluralise } from '../../core/format';
import { shareText } from '../../core/share';
import { track } from '../../core/analytics';
import { CAMPAIGN_LENGTH } from '../../core/campaign';
import { bestRoute } from '../../core/game';
import { tourById } from '../../core/tours';
import { dateKey } from '../../core/daily';
import { TourBadge } from '../components/TourBadge';
import { areNeighbours } from '../../core/graph';
import type { GameResult } from '../../core/types';
import { colors, fonts, radius, spacing } from '../../theme';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { StatTile } from '../components/StatTile';
import { Flag } from '../components/Flag';

export interface ResultOverlayProps {
  result: GameResult;
  /** Countries this game stamped into the passport for the first time. */
  newStamps?: readonly string[];
  onNewGame: () => void;
  onExit: () => void;
  /** A tour badge this game just earned. */
  badgeEarned?: string | null;
}

/**
 * The finish. It rises over the map rather than replacing it, so the last
 * country the player reached is still visible behind the numbers.
 */
export function ResultOverlay({ result, newStamps = [], onNewGame, onExit, badgeEarned = null }: ResultOverlayProps) {
  const insets = useSafeAreaInsets();
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entry]);

  const hints = result.hints ?? 0;
  const tour = result.mode === 'tour' && result.tour ? tourById(result.tour) : undefined;
  const earnedTour = badgeEarned ? tourById(badgeEarned) : undefined;
  const lastTourLevel = tour !== undefined && result.level !== undefined && result.level >= tour.levels.length;
  // One shortest way there, when the player's was longer: the geography the
  // game is really about. A hinted route that was already shortest is shown
  // as the player's own.
  const best = result.moves > result.optimalMoves ? bestRoute(result) : null;

  const onShare = async () => {
    const message = shareText(result);
    track('result_shared', { mode: result.mode, level: result.level, optimal: result.optimal });
    try {
      if (Platform.OS === 'web') {
        const navigatorWithShare = globalThis.navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
        if (navigatorWithShare?.share) await navigatorWithShare.share({ text: message });
        else await globalThis.navigator?.clipboard?.writeText(message);
      } else {
        await Share.share({ message });
      }
    } catch {
      // The player dismissed the share sheet.
    }
  };

  return (
    <Animated.View
      style={[
        styles.backdrop,
        { opacity: entry, transform: [{ translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>
          {result.mode === 'campaign'
            ? `LEVEL ${result.level} OF ${CAMPAIGN_LENGTH}`
            : tour
              ? `${tour.name.toUpperCase()} · LEVEL ${result.level} OF ${tour.levels.length}`
            : result.mode === 'daily'
              ? `DAILY · ${result.dailyKey}`
              : result.mode === 'visa'
                ? 'VISA DENIED · ROUTE COMPLETE'
                : 'ROUTE COMPLETE'}
        </Text>
        <Text style={styles.title}>MADE IT</Text>

        {result.optimal ? (
          <View style={styles.perfect}>
            <Icon name="check" size={14} color={colors.gold} />
            <Text style={styles.perfectText}>PERFECT ROUTE</Text>
          </View>
        ) : (
          <Text style={styles.subtitle}>
            {result.moves <= result.optimalMoves
              ? `Shortest route, with ${pluralise(hints, 'hint')}`
              : `The shortest way there was ${pluralise(result.optimalMoves, 'move')}`}
          </Text>
        )}

        <RouteChips route={result.route} flights={result.mode === 'flight'} />

        {result.closed?.length ? (
          <Text style={styles.closedLine}>
            ⛔ Got round {result.closed.map((iso) => `${countryFlag(iso)} ${countryName(iso)}`).join(', ')}
          </Text>
        ) : null}

        {best ? (
          <View style={styles.best} accessibilityLabel={`A best route: ${best.map(countryName).join(', ')}`}>
            <Text style={styles.bestTitle}>A BEST ROUTE · {pluralise(result.optimalMoves, 'MOVE', 'MOVES')}</Text>
            <RouteChips route={best} flights={result.mode === 'flight'} tone="best" />
          </View>
        ) : null}

        <View style={styles.tiles}>
          <StatTile label="MOVES" value={String(result.moves)} accent={result.optimal} />
          <StatTile label="TIME" value={formatDuration(result.seconds)} />
          <StatTile label="WRONG TURNS" value={String(result.wrongGuesses)} />
        </View>

        <Text style={styles.footnote}>
          {pluralise(result.route.length, 'country', 'countries')} visited · best possible{' '}
          {pluralise(result.optimalMoves, 'move')}
          {hints > 0 ? ` · 💡 ${pluralise(hints, 'hint')}` : ''}
        </Text>

        {earnedTour ? (
          <View style={styles.badge} accessibilityLabel={`${earnedTour.name} tour complete: badge earned`}>
            <Text style={styles.stampsTitle}>TOUR COMPLETE</Text>
            <TourBadge tour={earnedTour} earned={dateKey()} size={88} />
            <Text style={styles.stampsHint}>{earnedTour.name} badge added to your passport.</Text>
          </View>
        ) : null}

        {newStamps.length > 0 ? (
          <View style={styles.stamps} accessibilityLabel={`New passport stamps: ${newStamps.map(countryName).join(', ')}`}>
            <Text style={styles.stampsTitle}>
              {newStamps.length === 1 ? 'NEW PASSPORT STAMP' : `${newStamps.length} NEW PASSPORT STAMPS`}
            </Text>
            <View style={styles.stampRow}>
              {newStamps.map((iso) => (
                <View key={iso} style={styles.stamp}>
                  <Flag iso={iso} width={34} />
                  <Text style={styles.stampName} numberOfLines={1}>
                    {countryName(iso)}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.stampsHint}>Your explorer can wear these flags. Find them in your passport.</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={
              result.mode === 'campaign'
                ? result.level !== undefined && result.level < CAMPAIGN_LENGTH
                  ? `Level ${result.level + 1}`
                  : 'Back to campaign'
                : tour
                  ? lastTourLevel
                    ? 'Back to tours'
                    : `Level ${(result.level ?? 0) + 1}`
                  : 'New game'
            }
            variant="primary"
            icon={result.mode === 'campaign' || tour ? 'play' : 'again'}
            onPress={onNewGame}
          />
          <View style={styles.secondaryRow}>
            <Button label="Share" icon="share" onPress={onShare} style={styles.half} />
            <Button
              label={result.mode === 'campaign' || tour ? 'Levels' : 'Menu'}
              onPress={onExit}
              style={styles.half}
            />
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

/** A route as flag chips, with a plane between two countries that were flown. */
function RouteChips({
  route, flights, tone = 'own',
}: { route: readonly string[]; flights: boolean; tone?: 'own' | 'best' }) {
  return (
    <View style={styles.route}>
      {route.map((iso, index) => {
        const next = route[index + 1];
        const flown = flights && next !== undefined && !areNeighbours(iso, next);
        return (
          <View key={`${iso}-${index}`} style={styles.routeStep}>
            <View style={[styles.routeChip, tone === 'best' && styles.bestChip]}>
              <Text style={styles.routeFlag}>{countryFlag(iso)}</Text>
              <Text style={styles.routeName}>{countryName(iso)}</Text>
            </View>
            {next !== undefined ? (
              flown ? (
                <View style={styles.routeArrow}>
                  <Icon name="plane" size={13} color={colors.destination} />
                </View>
              ) : (
                <Text style={styles.routeArrow}>→</Text>
              )
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 206, 106, 0.55)',
    backgroundColor: 'rgba(255, 206, 106, 0.1)',
  },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 10, 18, 0.95)' },
  content: { paddingHorizontal: spacing.xl, alignItems: 'center', gap: spacing.md, flexGrow: 1, justifyContent: 'center' },
  eyebrow: { color: colors.textMuted, fontFamily: fonts.display, fontSize: 10.5, letterSpacing: 2.4, fontWeight: '700' },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: 4,
    marginTop: 2,
  },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14.5 },
  perfect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 206, 106, 0.14)',
  },
  perfectText: { color: colors.gold, fontSize: 11, letterSpacing: 1.6, fontWeight: '700' },
  route: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginVertical: spacing.md,
  },
  routeStep: { flexDirection: 'row', alignItems: 'center' },
  routeArrow: { color: colors.textMuted, fontSize: 13, marginHorizontal: 4 },
  routeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  routeFlag: { fontSize: 15 },
  bestChip: { borderColor: 'rgba(255, 206, 106, 0.4)', backgroundColor: 'rgba(255, 206, 106, 0.08)' },
  best: { alignSelf: 'stretch', alignItems: 'center', marginTop: -spacing.sm },
  closedLine: { color: '#FFB3B5', fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginTop: -spacing.sm },
  bestTitle: { color: colors.gold, fontSize: 11, letterSpacing: 1.6, fontWeight: '700' },
  routeName: { color: colors.text, fontFamily: fonts.body, fontSize: 13.5, fontWeight: '600' },
  tiles: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.xs },
  footnote: { color: colors.textMuted, fontSize: 12.5, marginTop: spacing.xs, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.lg },
  stamps: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 206, 106, 0.45)',
    backgroundColor: 'rgba(255, 206, 106, 0.06)',
  },
  stampsTitle: { color: colors.gold, fontSize: 11, letterSpacing: 1.6, fontWeight: '700' },
  stampRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  stamp: { alignItems: 'center', gap: 4, maxWidth: 76 },
  stampName: { color: colors.text, fontSize: 11, fontWeight: '600' },
  stampsHint: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  secondaryRow: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
});
