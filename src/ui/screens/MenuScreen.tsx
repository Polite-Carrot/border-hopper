import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { requireCountry } from '../../core/world';
import { dateKey } from '../../core/daily';
import { colors, fonts, radius, spacing } from '../../theme';
import { WorldMap } from '../map/WorldMap';
import { frameBoxes, makeStage } from '../map/camera';
import { Button } from '../components/Button';

export interface MenuScreenProps {
  onCampaign: () => void;
  onRandom: () => void;
  onFlight: () => void;
  onDaily: () => void;
  onStats: () => void;
  onSettings: () => void;
  /** True once today's daily challenge has been finished. */
  dailyDone: boolean;
  /** Level the player is up to, or null once the campaign is finished. */
  campaignLevel: number | null;
  campaignDone: number;
  dailyStreak: number;
  reduceMotion: boolean;
}

/** Regions the title-screen camera drifts between, so the map is the branding. */
const BACKDROP_TOUR = ['IT', 'ID', 'BR', 'KE', 'JP', 'NO'];

export function MenuScreen({
  onCampaign, onRandom, onFlight, onDaily, onStats, onSettings, dailyDone, dailyStreak,
  campaignLevel, campaignDone, reduceMotion,
}: MenuScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState(0);

  const stage = useMemo(() => makeStage(width, height), [width, height]);
  const iso = BACKDROP_TOUR[step % BACKDROP_TOUR.length];
  const camera = useMemo(() => frameBoxes([requireCountry(iso).bbox], stage), [iso, stage]);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [fade]);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => setStep((value) => value + 1), 6000);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  return (
    <View style={styles.root}>
      <WorldMap
        stage={stage}
        camera={camera}
        duration={reduceMotion ? 0 : 5200}
        currentIso={iso}
        destinationIso=""
        visited={[]}
      />
      <View style={styles.scrim} pointerEvents="none" />

      <Animated.View
        style={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl, opacity: fade },
        ]}
      >
        <View style={styles.brand}>
          {/* Broken deliberately, so the wordmark stacks the same way on a
              phone and on a desktop browser rather than reflowing. */}
          <Text style={styles.wordmark}>{'BORDER\nHOPPER'}</Text>
          <View style={styles.rule} />
          <Text style={styles.tagline}>Cross the world, one border at a time</Text>
        </View>

        <View style={styles.actions}>
          <Button
            label={campaignLevel === null ? 'Campaign · complete' : `Campaign · level ${campaignLevel}`}
            variant="primary"
            icon="play"
            onPress={onCampaign}
          />
          <View style={styles.row}>
            <Button label="Random" icon="again" onPress={onRandom} style={styles.half} />
            <Button label="Flight" icon="plane" onPress={onFlight} style={styles.half} />
          </View>
          <Button
            label={dailyDone ? 'Daily challenge · done' : 'Daily challenge'}
            icon="calendar"
            onPress={onDaily}
          />
          <View style={styles.row}>
            <Button label="Statistics" icon="stats" onPress={onStats} style={styles.half} />
            <Button label="Settings" icon="settings" onPress={onSettings} style={styles.half} />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {campaignDone > 0 ? `${campaignDone} levels cleared · ` : ''}
            {dateKey()}
          </Text>
          {dailyStreak > 0 ? (
            <View style={styles.streak}>
              <Text style={styles.streakText}>{dailyStreak} day streak</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 10, 18, 0.62)' },
  content: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'space-between' },
  brand: { alignItems: 'center', marginTop: '18%' },
  wordmark: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 6.5,
    lineHeight: 46,
    textAlign: 'center',
  },
  rule: {
    width: 58,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.current,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  tagline: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, letterSpacing: 0.4, textAlign: 'center' },
  actions: { gap: spacing.sm, maxWidth: 440, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  footer: { alignItems: 'center', gap: spacing.sm },
  footerText: { color: colors.textFaint, fontSize: 11.5, letterSpacing: 1.4, fontVariant: ['tabular-nums'] },
  streak: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 206, 106, 0.14)',
  },
  streakText: { color: colors.gold, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6 },
});
