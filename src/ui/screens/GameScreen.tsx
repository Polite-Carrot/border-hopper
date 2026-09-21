import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
import { onScreenKeyboardHeight } from '../components/OnScreenKeyboard';
import { ResultOverlay } from './ResultOverlay';
import { usePhysicalKeys } from '../hooks/usePhysicalKeys';
import { useLayout } from '../hooks/useLayoutMode';
import { haptic } from '../hooks/useHaptics';

const HUD_HEIGHT = 46;
const TRAIL_HEIGHT = 40;
/** The search field row plus the padding above it. */
const SEARCH_BLOCK = 58;
/** The panel's top padding plus the drag handle and its margin. */
const GRABBER_BLOCK = 20;
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
  const [keyboardUp, setKeyboardUp] = useState(false);

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
  const panelInnerWidth = docked ? layout.panelWidth : layout.width;

  /**
   * Room set aside below the search field: exactly the height of the game's
   * own keyboard. The country list lives there until the keyboard takes its
   * place, so the search field never moves. Owning the keyboard is what makes
   * this an exact number rather than a guess.
   */
  const reserved = Math.min(
    onScreenKeyboardHeight(panelInnerWidth),
    layout.height - topInset - SEARCH_BLOCK - GRABBER_BLOCK
  );

  const listHeight = useMemo(() => {
    if (docked) {
      return Math.max(COUNTRY_ROW_HEIGHT * 3, layout.height - (SIDEBAR_TOP_PAD + SEARCH_BLOCK + safeBottom));
    }
    return reserved;
  }, [docked, layout.height, safeBottom, reserved]);

  /**
   * How much of the screen the panel occupies. Identical whether the keyboard
   * is up or not, so the map never resizes and the camera never moves.
   */
  const panelHeight = GRABBER_BLOCK + SEARCH_BLOCK + reserved;

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
      height: layout.height - topInset - panelHeight,
    });
  }, [docked, layout.width, layout.height, layout.panelWidth, topInset, panelHeight, insets.bottom]);

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
      // Travelling leaves the keyboard wherever the player put it, so a run of
      // moves can be typed straight through. Arriving is the exception: the
      // result screen is about to take over.
      if (result.won) setKeyboardUp(false);
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

  // Desktop players just type; there is no on-screen keyboard to open.
  usePhysicalKeys(state.status === 'playing' && !showResult, {
    onKey: (character) => setQuery((current) => current + character),
    onBackspace: () => setQuery((current) => current.slice(0, -1)),
    onSubmit: handleSubmit,
    onEscape: () => {
      setQuery('');
      setKeyboardUp(false);
    },
  });

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
    <View style={styles.root} onLayout={layout.onLayout}>
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
          caption={
            config.mode === 'campaign'
              ? `LEVEL ${config.level} · TRAVEL TO`
              : config.mode === 'daily'
                ? 'DAILY · TRAVEL TO'
                : 'TRAVEL TO'
          }
          onExit={onExit}
        />
        <View style={styles.trail}>
          <RouteTrail route={state.route} destination={config.destination} />
        </View>
      </View>

      <View
        style={[styles.toastSlot, { bottom: (docked ? 0 : panelHeight) + 16 }]}
        pointerEvents="none"
      >
        <Toast message={toast?.message ?? null} token={toast?.token ?? 0} />
      </View>

      <View
        style={[
          // Both layouts sit on top of the keyboard, so the search field at
          // the foot of the panel lands flush against it.
          // The bottom panel stays put: the space below the search field is
          // already the keyboard's size, so the keyboard covers it exactly.
          docked ? [styles.sidebar, { width: layout.panelWidth }] : styles.bottomPanel,
          showResult && styles.hidden,
        ]}
        pointerEvents={showResult ? 'none' : 'auto'}
      >
        <ControlPanel
          query={query}
          results={results}
          onSelect={handleSelect}
          onFocusSearch={() => {
            setToast(null);
            setKeyboardUp(true);
          }}
          onClearSearch={() => setQuery('')}
          onKey={(character) => setQuery((current) => current + character)}
          onBackspace={() => setQuery((current) => current.slice(0, -1))}
          onSubmit={handleSubmit}
          onHideKeyboard={() => setKeyboardUp(false)}
          currentIso={iso}
          visited={visited}
          listHeight={renderedListHeight}
          reservedHeight={reserved}
          keyboardUp={keyboardUp}
          keyboardWidth={panelInnerWidth}
          docked={docked}
          bottomInset={safeBottom}
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
  bottomPanel: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sidebar: { position: 'absolute', top: 0, right: 0, bottom: 0 },
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
