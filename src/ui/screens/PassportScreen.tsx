import { useEffect, useMemo, useRef } from 'react';
import {
  Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse, G } from 'react-native-svg';
import { COUNTRIES, countryName } from '../../core/world';
import { CONTINENTS, continentProgress, hasStamp, stampCount, type Passport } from '../../core/passport';
import type { Continent, Country } from '../../core/types';
import { colors, fonts, radius, spacing } from '../../theme';
import { Explorer } from '../map/Explorer';
import { Flag } from '../components/Flag';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';

const AnimatedG = Animated.createAnimatedComponent(G);

export interface PassportScreenProps {
  passport: Passport;
  /** Puts a stamped country's flag on the explorer, or null for his own jumper. */
  onWear: (skin: string | null) => void;
  onBack: () => void;
  reduceMotion: boolean;
}

/** The preview explorer, drawn this many times his size on the map. */
const PREVIEW_ZOOM = 3.4;
const PREVIEW = { width: 150, height: 150, feetY: 138 };
const MAX_CONTENT = 640;

const PAGES: { continent: Continent; countries: Country[] }[] = CONTINENTS.map((continent) => ({
  continent,
  countries: COUNTRIES.filter((country) => country.continent === continent).sort((a, b) =>
    a.name.localeCompare(b.name)
  ),
}));

/**
 * The passport: every country the explorer has stood in, page by continent,
 * and the flag he is wearing.
 *
 * Stamps are earned by playing, never bought: any country on any route counts,
 * the start and everything passed through included. Tap a stamp to put its
 * flag on his jumper.
 */
export function PassportScreen({ passport, onWear, onBack, reduceMotion }: PassportScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columns = width >= 560 ? 6 : 4;
  const contentWidth = Math.min(width, MAX_CONTENT) - spacing.lg * 2;
  const gap = spacing.sm;
  const tileWidth = Math.floor((contentWidth - gap * (columns - 1)) / columns);

  // A little jump whenever he changes his jumper, so the change is seen.
  const jump = useRef(new Animated.Value(0)).current;
  const skin = passport.skin;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduceMotion) return;
    jump.setValue(0);
    const animation = Animated.timing(jump, {
      toValue: 1,
      duration: 420,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [skin, jump, reduceMotion]);
  const lift = jump.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -22, 0] });

  const total = stampCount(passport);
  const progress = useMemo(
    () => Object.fromEntries(CONTINENTS.map((continent) => [continent, continentProgress(passport, continent)])),
    [passport]
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <ScreenHeader title="Passport" onBack={onBack} />

        <View style={styles.hero}>
          <Svg width={PREVIEW.width} height={PREVIEW.height}>
            <Ellipse cx={PREVIEW.width / 2} cy={PREVIEW.feetY} rx={34} ry={8} fill="#000" opacity={0.45} />
            <AnimatedG translateY={lift as unknown as number}>
              <G transform={`translate(${PREVIEW.width / 2} ${PREVIEW.feetY}) scale(${PREVIEW_ZOOM})`}>
                <Explorer skin={skin} />
              </G>
            </AnimatedG>
          </Svg>
          <Text style={styles.count}>
            <Text style={styles.countNumber}>{total}</Text>
            <Text style={styles.countOf}> of {COUNTRIES.length} stamps</Text>
          </Text>
          <Text style={styles.wearing}>
            {skin ? `Wearing: ${countryName(skin)}` : 'Wearing: his own red jumper'}
          </Text>
          {skin ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onWear(null)}
              style={({ pressed }) => [styles.own, pressed && styles.pressed]}
            >
              <Text style={styles.ownText}>Back to the red jumper</Text>
            </Pressable>
          ) : null}
          <Text style={styles.hint}>
            {total === 0
              ? 'Every country you travel through earns a stamp. Wear any stamp’s flag.'
              : 'Every country you travel through earns a stamp. Tap one to wear its flag.'}
          </Text>
        </View>

        {PAGES.map(({ continent, countries }) => (
          <View key={continent}>
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>{continent.toUpperCase()}</Text>
              <Text style={styles.pageCount}>
                {progress[continent].stamped}/{progress[continent].total}
              </Text>
            </View>
            <View style={[styles.grid, { gap }]}>
              {countries.map((country) => (
                <Stamp
                  key={country.iso2}
                  country={country}
                  width={tileWidth}
                  stamped={hasStamp(passport, country.iso2)}
                  date={passport.stamps[country.iso2]}
                  worn={skin === country.iso2}
                  onWear={onWear}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

interface StampProps {
  country: Country;
  width: number;
  stamped: boolean;
  date: string | undefined;
  worn: boolean;
  onWear: (skin: string | null) => void;
}

/** One country's page in the passport: its flag once visited, an empty frame before. */
function Stamp({ country, width, stamped, date, worn, onWear }: StampProps) {
  const flagWidth = Math.min(width - 16, 56);
  const label = stamped
    ? `${country.name}, stamped ${date}${worn ? ', wearing' : ''}`
    : `${country.name}, not visited yet`;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      // Web reads `aria-*`, native reads `accessibilityState`, so both are set.
      accessibilityState={{ checked: worn, disabled: !stamped }}
      aria-checked={worn}
      aria-disabled={!stamped}
      disabled={!stamped}
      onPress={() => onWear(worn ? null : country.iso2)}
      style={({ pressed }) => [
        styles.stamp,
        { width },
        stamped && styles.stamped,
        worn && styles.worn,
        pressed && styles.pressed,
      ]}
    >
      {stamped ? (
        <Flag iso={country.iso2} width={flagWidth} />
      ) : (
        <View style={[styles.empty, { width: flagWidth, height: Math.round((flagWidth * 2) / 3) }]} />
      )}
      <Text style={[styles.stampName, !stamped && styles.stampNameLocked]} numberOfLines={1}>
        {country.name}
      </Text>
      {worn ? (
        <View style={styles.check}>
          <Icon name="check" size={11} color={colors.background} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, maxWidth: MAX_CONTENT, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.md, gap: 6 },
  count: { marginTop: spacing.xs },
  countNumber: { color: colors.text, fontFamily: fonts.display, fontSize: 28, fontWeight: '800' },
  countOf: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 15 },
  wearing: { color: colors.text, fontFamily: fonts.body, fontSize: 14.5, fontWeight: '600' },
  own: {
    marginTop: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  ownText: { color: colors.textMuted, fontSize: 12.5, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 12.5, textAlign: 'center', marginTop: spacing.xs, lineHeight: 18 },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.xs,
  },
  pageTitle: { color: colors.textMuted, fontFamily: fonts.display, fontSize: 10.5, letterSpacing: 2, fontWeight: '700' },
  pageCount: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  stamp: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: 'rgba(22, 35, 52, 0.35)',
  },
  stamped: { backgroundColor: colors.surfaceRaised, borderColor: colors.hairlineStrong },
  worn: { borderColor: colors.current, borderWidth: 2, backgroundColor: 'rgba(61, 189, 248, 0.12)' },
  pressed: { opacity: 0.7 },
  empty: {
    borderRadius: 3,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairlineStrong,
  },
  stampName: { color: colors.text, fontSize: 11, fontWeight: '600', maxWidth: '100%' },
  stampNameLocked: { color: colors.textFaint, fontWeight: '500' },
  check: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 17,
    height: 17,
    borderRadius: radius.pill,
    backgroundColor: colors.current,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
