import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { applyMove, createGame, currentCountry, elapsedSeconds, moveCount, recordWrongGuess, toResult } from '../../core/game';
import { bestMatch, searchCountries } from '../../core/search';
import { requireCountry } from '../../core/world';
import type { GameConfig, GameResult, GameState } from '../../core/types';
import { colors, radius, timing } from '../../theme';
import { Icon } from '../components/Icon';
import { play } from '../../audio/sounds';
import { WorldMap } from '../map/WorldMap';
import { useMapGestures } from '../map/useMapGestures';
import { frameBoxes, makeStage } from '../map/camera';
import { ControlPanel } from '../components/ControlPanel';
import { GameHud } from '../components/GameHud';
import { OffscreenTarget } from '../components/OffscreenTarget';
import { RouteTrail } from '../components/RouteTrail';
import { Toast } from '../components/Toast';
import { COUNTRY_ROW_HEIGHT } from '../components/CountryRow';
import { ResultOverlay } from './ResultOverlay';
import { useKeyboardHeight } from '../hooks/useKeyboard';
import { useLayout } from '../hooks/useLayoutMode';
import { haptic } from '../hooks/useHaptics';

const HUD_HEIGHT = 46;
const TRAIL_HEIGHT = 40;
/** The search field plus the padding above it. Safe-area inset is separate. */
const SEARCH_BLOCK = 58;
/** The drag handle strip at the top of the bottom panel. */
const GRABBER_BLOCK = 12;
/** Padding above the list when the panel is docked to the side. */
const SIDEBAR_TOP_PAD = 16;
/** How long the opening shot holds both start and destination in view. */
const ESTABLISH_HOLD = 1300;

export interface GameScreenProps {
  config: GameConfig;
  reduceMotion: boolean;
  onExit: () => void;
  onNewGame: () => void;
  /** Called once, when the destination is reached. */
  onComplete: (result: GameResult) => void;
}

export function GameScreen({ config, reduceMotion, onExit, onNewGame, onComplete }: GameScreenProps) {
  const layout = useLayout();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const inputRef = useRef<TextInput>(null);

  const [state, setState] = useState<GameState>(() => createGame(config));
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; token: number } | null>(null);
  const [invalidIso, setInvalidIso] = useState<string | null>(null);
  const [arrivalToken, setArrivalToken] = useState(0);
  const [phase, setPhase] = useState<'establishing' | 'playing'>('establishing');
  const [showResult, setShowResult] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const gestures = useMapGestures({ width: layout.width, height: layout.height });

  const iso = currentCountry(state);
  const docked = layout.mode === 'sidebar';
  const travelDuration = reduceMotion ? 0 : timing.travel;

  // ---- layout ------------------------------------------------------------
  const topInset = insets.top + HUD_HEIGHT + TRAIL_HEIGHT + 18;
  const safeBottom = docked ? insets.bottom : Math.max(insets.bottom, 10);
  /**
   * The keyboard already covers the home-indicator area, so the panel drops
   * its safe-area padding while one is open. That is what puts the bottom edge
   * of the search field exactly on the top edge of the keyboard.
   */
  const bottomInset = keyboardHeight > 0 ? 0 : safeBottom;

  /**
   * The height the list is allowed to take.
   *
   * This deliberately asks for the same height whether or not the keyboard is
   * open, and only gives ground when there genuinely is not room. The panel is
   * anchored above the keyboard, so on most phones opening one slides the
   * panel up without resizing anything inside it.
   *
   * The map is laid out against this rather than against the list's actual
   * content, so narrowing the results while typing never moves the camera.
   */
  const listHeight = useMemo(() => {
    const chrome = docked
      ? SIDEBAR_TOP_PAD + SEARCH_BLOCK + bottomInset
      : topInset + GRABBER_BLOCK + SEARCH_BLOCK + bottomInset;
    const available = layout.height - keyboardHeight - chrome;
    if (docked) return Math.max(COUNTRY_ROW_HEIGHT * 3, available);
    const preferred = Math.min(layout.height * 0.34, COUNTRY_ROW_HEIGHT * 8);
    return Math.max(COUNTRY_ROW_HEIGHT * 2.5, Math.min(preferred, available));
  }, [layout.height, keyboardHeight, topInset, bottomInset, docked]);

  const panelHeight = GRABBER_BLOCK + listHeight + SEARCH_BLOCK + bottomInset;

  const stage = useMemo(() => {
    if (docked) {
      return makeStage(layout.width, layout.height, {
        x: 0,
        y: topInset,
        width: layout.width - layout.panelWidth,
        height: layout.height - topInset - insets.bottom,
      });
    }
    return makeStage(layout.width, layout.height, {
      x: 0,
      y: topInset,
      width: layout.width,
      height: layout.height - topInset - panelHeight - keyboardHeight,
    });
  }, [docked, layout.width, layout.height, layout.panelWidth, topInset, panelHeight, keyboardHeight, insets.bottom]);

  // ---- camera ------------------------------------------------------------
  const camera = useMemo(() => {
    const target = requireCountry(config.destination).bbox;
    if (phase === 'establishing') return frameBoxes([requireCountry(config.start).bbox, target], stage);
    return frameBoxes([requireCountry(iso).bbox], stage);
  }, [phase, iso, config.start, config.destination, stage]);

  // Travelling to a new country earns the full camera move. Everything else
  // that nudges the camera -- the keyboard opening, a rotation -- should just
  // settle quickly, not replay a journey.
  const lastView = useRef<string | null>(null);
  const viewKey = `${phase}:${iso}`;
  let duration = travelDuration;
  if (lastView.current === null) duration = 0;
  else if (lastView.current === viewKey) duration = reduceMotion ? 0 : timing.medium;
  lastView.current = viewKey;

  useEffect(() => {
    const timer = setTimeout(() => setPhase('playing'), reduceMotion ? 250 : ESTABLISH_HOLD);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  // ---- clock -------------------------------------------------------------
  useEffect(() => {
    if (state.status !== 'playing') return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [state.status]);

  // ---- moves -------------------------------------------------------------
  const results = useMemo(() => searchCountries(query), [query]);

  const handleSelect = useCallback(
    (target: string) => {
      const result = applyMove(state, target);

      if (!result.ok) {
        if (result.reason === 'not-adjacent') {
          setState((previous) => recordWrongGuess(previous, target));
          setInvalidIso(target);
          setTimeout(() => setInvalidIso((value) => (value === target ? null : value)), 750);
        }
        setToast({ message: result.message, token: Date.now() });
        haptic('error');
        play('invalid');
        return;
      }

      setState(result.state);
      setQuery('');
      setToast(null);
      setArrivalToken((token) => token + 1);
      // The camera is about to re-frame, so let go of any manual zoom.
      gestures.reset();
      Keyboard.dismiss();
      haptic(result.won ? 'success' : 'light');
      play(result.won ? 'win' : 'move');

      if (result.won) {
        const summary = toResult(result.state);
        onComplete(summary);
        // Let the map finish arriving before the result takes over the screen.
        setTimeout(() => setShowResult(true), travelDuration + 250);
      }
    },
    [state, onComplete, travelDuration, gestures]
  );

  const handleSubmit = useCallback(() => {
    const match = bestMatch(query);
    if (match) handleSelect(match.iso2);
  }, [query, handleSelect]);

  const visited = state.route.slice(0, -1);
  const seconds = elapsedSeconds(state, now);
  // A short result list shrinks the panel instead of leaving dead space below it.
  const renderedListHeight = docked
    ? listHeight
    : Math.min(
        listHeight,
        // The "no match" message needs more room than a single row.
        Math.max(COUNTRY_ROW_HEIGHT * 1.6, results.length * COUNTRY_ROW_HEIGHT + 8)
      );

  return (
    <View style={styles.root}>
      <WorldMap
        stage={stage}
        camera={camera}
        duration={duration}
        currentIso={iso}
        destinationIso={config.destination}
        visited={visited}
        invalidIso={invalidIso}
        arrivalToken={arrivalToken}
        userTransform={gestures.transform}
        panHandlers={gestures.panHandlers}
        containerRef={gestures.containerRef}
      />

      {/* The edge marker is worked out from the camera, so it would point in
          the wrong direction once the player has moved the map themselves. */}
      {!gestures.adjusted ? (
        <OffscreenTarget
          destination={config.destination}
          destinationCentroid={requireCountry(config.destination).centroid}
          camera={camera}
          stage={stage}
        />
      ) : null}

      {gestures.adjusted ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Recentre the map"
          onPress={() => gestures.reset()}
          style={({ pressed }) => [
            styles.recentre,
            { top: insets.top + HUD_HEIGHT + TRAIL_HEIGHT + 22, right: (docked ? layout.panelWidth : 0) + 16 },
            pressed && styles.recentrePressed,
          ]}
        >
          <Icon name="target" size={18} color={colors.current} />
        </Pressable>
      ) : null}

      <View
        style={[styles.top, { paddingTop: insets.top + 6, right: docked ? layout.panelWidth : 0 }]}
        pointerEvents="box-none"
      >
        <GameHud
          destination={config.destination}
          moves={moveCount(state)}
          seconds={seconds}
          isDaily={config.mode === 'daily'}
          onExit={onExit}
        />
        <View style={styles.trail}>
          <RouteTrail route={state.route} destination={config.destination} />
        </View>
      </View>

      <View
        style={[styles.toastSlot, { bottom: (docked ? 0 : panelHeight) + keyboardHeight + 16 }]}
        pointerEvents="none"
      >
        <Toast message={toast?.message ?? null} token={toast?.token ?? 0} />
      </View>

      <View
        style={[
          // Both layouts sit on top of the keyboard, so the search field at
          // the foot of the panel lands flush against it.
          docked
            ? [styles.sidebar, { width: layout.panelWidth, bottom: keyboardHeight }]
            : [styles.bottomPanel, { bottom: keyboardHeight }],
          showResult && styles.hidden,
        ]}
        pointerEvents={showResult ? 'none' : 'auto'}
      >
        <ControlPanel
          ref={inputRef}
          query={query}
          onQueryChange={setQuery}
          results={results}
          onSelect={handleSelect}
          onFocus={() => setToast(null)}
          onBlur={() => undefined}
          onSubmit={handleSubmit}
          currentIso={iso}
          visited={visited}
          listHeight={renderedListHeight}
          docked={docked}
          bottomInset={bottomInset}
        />
      </View>

      {showResult ? (
        <ResultOverlay
          result={toResult(state)}
          onNewGame={onNewGame}
          onExit={onExit}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  trail: { marginTop: 10, height: TRAIL_HEIGHT, justifyContent: 'center' },
  toastSlot: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bottomPanel: { position: 'absolute', left: 0, right: 0 },
  sidebar: { position: 'absolute', top: 0, right: 0 },
  hidden: { opacity: 0 },
  recentre: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSolid,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  recentrePressed: { opacity: 0.6 },
});
