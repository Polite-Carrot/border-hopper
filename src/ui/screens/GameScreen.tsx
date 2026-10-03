import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  allowsFlights, applyMove, createGame, currentCountry, elapsedSeconds, moveCount,
  recordWrongGuess, toResult, wasFlown,
} from '../../core/game';
import { flightsOf } from '../../core/graph';
import { bestMatch, searchCountries } from '../../core/search';
import { track } from '../../core/analytics';
import { newStamps, type Passport } from '../../core/passport';
import { MAP_HEIGHT, MAP_WIDTH, requireCountry } from '../../core/world';
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
/** The flight departures strip, shown in flight mode only. */
const FLIGHT_STRIP = 46;
/** How long the opening shot holds both start and destination in view. */
const ESTABLISH_HOLD = 1300;

export interface GameScreenProps {
  config: GameConfig;
  reduceMotion: boolean;
  /** `unfinished` is false when the player is leaving a game they have won. */
  onExit: (unfinished: boolean) => void;
  onNewGame: () => void;
  /** Called once, when the destination is reached. */
  onComplete: (result: GameResult) => void;
  /** The passport as it stood when this game began, to tell which stamps are new. */
  passport: Passport;
  /** Stamps countries into the passport the moment the explorer stands in them. */
  onStamp: (isos: string[]) => void;
}

export function GameScreen({
  config, reduceMotion, onExit, onNewGame, onComplete, passport, onStamp,
}: GameScreenProps) {
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
  // Kept from the moment the game began: the passport prop updates with every
  // stamp, and against that nothing would ever look new.
  const [passportAtStart] = useState(passport);

  // Standing in the start country counts. Stamped on arrival rather than at the
  // end, so walking out half way keeps everything already crossed.
  useEffect(() => {
    onStamp([config.start]);
    // Once per game: the screen is remounted for every new one.
  }, []);

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
    layout.height - topInset - SEARCH_BLOCK - GRABBER_BLOCK - (allowsFlights(config) ? FLIGHT_STRIP : 0)
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
  /** The departures strip only shows in flight mode, and only with the keyboard down. */
  const flightStrip = allowsFlights(config) ? FLIGHT_STRIP : 0;
  const panelHeight = GRABBER_BLOCK + SEARCH_BLOCK + flightStrip + reserved;

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

  /**
   * Pan and pinch, told how big a copy of the world currently is on screen so
   * it can wrap a westward drag round the back of the map.
   */
  const gestures = useMapGestures(
    { width: layout.width, height: layout.height },
    { width: MAP_WIDTH * camera.k, height: MAP_HEIGHT * camera.k }
  );

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
        // Where people believe in a border that is not there. Enough of these
        // is the answer to "which countries do players get stuck on".
        track('wrong_guess', {
          mode: config.mode,
          level: config.level,
          from: iso,
          guess: target,
          reason: result.reason,
          moves_in: state.route.length - 1,
        });
        setToast({ message: result.message, token: Date.now() });
        haptic('error');
        play('invalid');
        return;
      }

      setState(result.state);
      onStamp([target]);
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

      if (wasFlown(config, iso, target)) {
        const leg = flightsOf(iso).find((flight) => flight.iso2 === target);
        track('flight_taken', {
          from: iso,
          to: target,
          km: leg?.km ?? 0,
          moves_in: state.route.length - 1,
        });
      }

      if (result.won) {
        const summary = toResult(result.state);
        onComplete(summary);
        // Let the map finish arriving before the result takes over the screen.
        setTimeout(() => setShowResult(true), travelDuration + 250);
      }
    },
    [state, onComplete, onStamp, travelDuration, gestures, config, iso]
  );

  /**
   * Leaving, by whichever door.
   *
   * Whether the game was abandoned is read off its own status rather than from
   * which button was pressed: the same handler serves the HUD's back arrow and
   * the result screen's Menu, and for the second of those the game is already
   * won. Reporting that as abandoned reset the win streak the win had just
   * incremented, so a streak could never reach two.
   */
  const handleExit = useCallback(() => {
    const unfinished = state.status === 'playing';
    if (unfinished) {
      track('game_abandoned', {
        mode: config.mode,
        difficulty: config.difficulty,
        level: config.level,
        moves_made: moveCount(state),
        optimal_moves: config.optimalMoves,
        seconds: elapsedSeconds(state, Date.now()),
        wrong_guesses: state.wrongGuesses.length,
        stuck_at: currentCountry(state),
      });
    }
    onExit(unfinished);
  }, [state, config, onExit]);

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
  const previous = state.route[state.route.length - 2];
  const lastMoveFlown = previous !== undefined && wasFlown(config, previous, iso);
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
        flown={lastMoveFlown}
        skin={passport.skin}
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
                : config.mode === 'flight'
                  ? 'FLIGHT · TRAVEL TO'
                  : 'TRAVEL TO'
          }
          onExit={handleExit}
        />
        <View style={styles.trail}>
          <RouteTrail route={state.route} destination={config.destination} flights={allowsFlights(config)} />
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
          flights={allowsFlights(config) ? flightsOf(iso) : null}
          docked={docked}
          bottomInset={safeBottom}
        />
      </View>

      {showResult ? (
        <ResultOverlay
          result={toResult(state)}
          newStamps={newStamps(passportAtStart, state.route)}
          onNewGame={onNewGame}
          onExit={handleExit}
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
