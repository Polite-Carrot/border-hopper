import { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { dailyGame, dateKey } from '../core/daily';
import {
  CAMPAIGN_LENGTH, campaignGame, nextLevel, recordLevel, type CampaignProgress,
} from '../core/campaign';
import { generateGame } from '../core/generate';
import { EMPTY_STATS, recordGameAbandoned, recordGameCompleted, recordGameStarted, type Stats } from '../core/stats';
import type { GameConfig, GameResult } from '../core/types';
import {
  DEFAULT_SETTINGS, loadCampaign, loadDailyResults, loadOnboarded, loadSettings, loadStats,
  loadConsentAsked, resetEverything, saveCampaign, saveConsentAsked, saveDailyResults,
  saveOnboarded, saveSettings, saveStats,
  type DailyResults, type Settings,
} from '../storage/storage';
import { setSoundEnabled } from '../audio/sounds';
import { setAnalyticsEnabled, track } from '../core/analytics';
import { colors } from '../theme';
import { setHapticsEnabled } from './hooks/useHaptics';
import { GameScreen } from './screens/GameScreen';
import { MenuScreen } from './screens/MenuScreen';
import { StatsScreen } from './screens/StatsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { OnboardingOverlay } from './screens/OnboardingOverlay';
import { DailyDoneScreen } from './screens/DailyDoneScreen';
import { CampaignScreen } from './screens/CampaignScreen';
import { RandomGamePicker, type RandomMode } from './screens/RandomGamePicker';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { ConsentPrompt } from './screens/ConsentPrompt';
import { BootScreen } from './screens/BootScreen';

type Screen = 'menu' | 'game' | 'campaign' | 'stats' | 'settings' | 'privacy' | 'daily-done';

/**
 * The whole app. Screens are a single piece of state rather than a navigation
 * library: there are seven of them and none of them nest.
 */
export function BorderHopperApp() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [dailyResults, setDailyResults] = useState<DailyResults>({});
  const [campaign, setCampaign] = useState<CampaignProgress>({});
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  /** Which mode the new-game sheet is open on, or null when it is closed. */
  const [picking, setPicking] = useState<RandomMode | null>(null);
  const [ready, setReady] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    void (async () => {
      const [savedStats, savedSettings, savedDaily, savedCampaign, onboarded, consentAsked] =
        await Promise.all([
          loadStats(), loadSettings(), loadDailyResults(), loadCampaign(), loadOnboarded(),
          loadConsentAsked(),
        ]);
      setStats(savedStats);
      setSettings(savedSettings);
      setDailyResults(savedDaily);
      setCampaign(savedCampaign);
      setNeedsOnboarding(!onboarded);
      setNeedsConsent(!consentAsked);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    setHapticsEnabled(settings.haptics);
    setSoundEnabled(settings.sound);
    // The player's own switch is the only thing that turns collection on.
    setAnalyticsEnabled(settings.analytics);
  }, [settings.haptics, settings.sound, settings.analytics]);

  /**
   * One game_start per game, keyed on the config itself. Every way into a game
   * -- campaign, daily, either sheet mode, "new game" -- ends with a fresh
   * config object, so this is the one place that catches all of them.
   */
  useEffect(() => {
    if (!config) return;
    track('game_start', {
      mode: config.mode,
      difficulty: config.difficulty,
      optimal_moves: config.optimalMoves,
      level: config.level,
      start: config.start,
      destination: config.destination,
    });
  }, [config]);

  const finishBoot = useCallback(() => setBooting(false), []);

  const persistStats = useCallback((next: Stats) => {
    setStats(next);
    void saveStats(next);
  }, []);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    void saveSettings(next);
  }, []);

  const startLevel = useCallback(
    (level: number) => {
      setConfig(campaignGame(level));
      setScreen('game');
      persistStats(recordGameStarted(stats));
    },
    [stats, persistStats]
  );

  /**
   * Starts a one-off game in an explicitly chosen mode and difficulty, and
   * remembers the difficulty so the sheet opens on it next time. The sheet is
   * the only place difficulty is chosen.
   */
  const startRandom = useCallback(
    (mode: RandomMode, choice: Settings['difficulty']) => {
      if (choice !== settings.difficulty) updateSettings({ ...settings, difficulty: choice });
      setPicking(null);
      setConfig(generateGame({ mode, difficulty: choice === 'mixed' ? undefined : choice }));
      setScreen('game');
      persistStats(recordGameStarted(stats));
    },
    [settings, updateSettings, stats, persistStats]
  );

  /**
   * Another game on the same terms as the one just finished -- what "New game"
   * means, since the player chose those terms on the way in and should not
   * have to choose again. Both take no arguments, so they are safe to hand
   * straight to a press handler.
   */
  const startClassic = useCallback(() => {
    startRandom('classic', settings.difficulty);
  }, [startRandom, settings.difficulty]);

  const startFlight = useCallback(() => {
    startRandom('flight', settings.difficulty);
  }, [startRandom, settings.difficulty]);

  const startDaily = useCallback(() => {
    const key = dateKey();
    if (dailyResults[key]) {
      setScreen('daily-done');
      return;
    }
    setConfig(dailyGame(key));
    setScreen('game');
    persistStats(recordGameStarted(stats));
  }, [dailyResults, stats, persistStats]);

  const handleComplete = useCallback(
    (result: GameResult) => {
      persistStats(recordGameCompleted(stats, result));
      track('game_complete', {
        mode: result.mode,
        difficulty: result.difficulty,
        level: result.level,
        moves: result.moves,
        optimal_moves: result.optimalMoves,
        // Never negative: the optimal route is the floor.
        over_par: Math.max(0, result.moves - result.optimalMoves),
        seconds: result.seconds,
        wrong_guesses: result.wrongGuesses,
        optimal: result.optimal,
      });
      if (result.mode === 'campaign') {
        const next = recordLevel(campaign, result);
        setCampaign(next);
        void saveCampaign(next);
        // The last level, fired once, the moment the last gap closes.
        if (nextLevel(campaign) !== null && nextLevel(next) === null) {
          const levels = Object.values(next);
          track('campaign_complete', {
            seconds_total: levels.reduce((total, level) => total + level.seconds, 0),
            perfect_levels: levels.filter((level) => level.optimal).length,
          });
        }
      }
      if (result.mode === 'daily' && result.dailyKey) {
        const next = { ...dailyResults, [result.dailyKey]: result };
        setDailyResults(next);
        void saveDailyResults(next);
      }
    },
    [stats, dailyResults, campaign, persistStats]
  );

  const leaveGame = useCallback(
    (unfinished: boolean) => {
      if (unfinished) persistStats(recordGameAbandoned(stats));
      const wasCampaign = config?.mode === 'campaign';
      setConfig(null);
      setScreen(wasCampaign ? 'campaign' : 'menu');
    },
    [stats, config, persistStats]
  );

  const finishOnboarding = useCallback(() => {
    setNeedsOnboarding(false);
    track('onboarding_complete', {});
    void saveOnboarded();
  }, []);

  const finishConsent = useCallback(() => {
    setNeedsConsent(false);
    void saveConsentAsked();
  }, []);

  /**
   * Settings changes, but only the two that are consent. Recording which
   * switches people turn back off is the only honest measure of whether the
   * asking is reasonable -- and it is itself consented, so a player who has
   * said no is not reported as having said no.
   */
  const changeSettings = useCallback(
    (next: Settings) => {
      if (next.analytics !== settings.analytics) {
        track('consent_changed', { setting: 'analytics', enabled: next.analytics });
      }
      if (next.personalisedAds !== settings.personalisedAds) {
        track('consent_changed', { setting: 'personalised_ads', enabled: next.personalisedAds });
      }
      updateSettings(next);
    },
    [settings, updateSettings]
  );

  const todayKey = dateKey();
  const campaignNext = nextLevel(campaign);

  /** After a campaign level, go straight on to the next one. */
  const advanceCampaign = useCallback(() => {
    const level = config?.level;
    const following = level !== undefined ? level + 1 : campaignNext;
    if (following && following <= CAMPAIGN_LENGTH) startLevel(following);
    else setScreen('campaign');
  }, [config, campaignNext, startLevel]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.root}>
        {!ready ? null : screen === 'game' && config ? (
          <GameScreen
            // A fresh game must not inherit the previous game's state.
            key={`${config.mode}:${config.start}:${config.destination}:${config.dailyKey ?? ''}`}
            config={config}
            reduceMotion={settings.reduceMotion}
            // The screen knows whether the game was finished; it is the only
            // thing that does.
            onExit={leaveGame}
            onNewGame={
              config.mode === 'campaign'
                ? advanceCampaign
                : config.mode === 'daily'
                  ? () => leaveGame(false)
                  : config.mode === 'flight'
                    ? startFlight
                    : startClassic
            }
            onComplete={handleComplete}
          />
        ) : screen === 'campaign' ? (
          <CampaignScreen
            progress={campaign}
            onPlayLevel={startLevel}
            onBack={() => setScreen('menu')}
          />
        ) : screen === 'stats' ? (
          <StatsScreen stats={stats} onBack={() => setScreen('menu')} />
        ) : screen === 'settings' ? (
          <SettingsScreen
            settings={settings}
            onChange={changeSettings}
            onReset={() => {
              void resetEverything();
              setStats(EMPTY_STATS);
              setSettings(DEFAULT_SETTINGS);
              setDailyResults({});
              setCampaign({});
              // Erasing everything includes the answer: the card comes back
              // rather than a stale yes surviving a reset.
              setNeedsConsent(true);
            }}
            onBack={() => setScreen('menu')}
            onPrivacy={() => setScreen('privacy')}
          />
        ) : screen === 'privacy' ? (
          <PrivacyScreen
            settings={settings}
            onChange={changeSettings}
            // Back to Settings, which is where it was opened from.
            onBack={() => setScreen('settings')}
          />
        ) : screen === 'daily-done' ? (
          <DailyDoneScreen
            result={dailyResults[todayKey]}
            dailyStreak={stats.dailyStreak}
            onBack={() => setScreen('menu')}
            onPlayClassic={startClassic}
          />
        ) : (
          <MenuScreen
            onCampaign={() => setScreen('campaign')}
            onRandom={() => setPicking('classic')}
            onFlight={() => setPicking('flight')}
            onDaily={startDaily}
            onStats={() => setScreen('stats')}
            onSettings={() => setScreen('settings')}
            dailyDone={Boolean(dailyResults[todayKey])}
            dailyStreak={stats.dailyStreak}
            campaignLevel={campaignNext}
            campaignDone={Object.keys(campaign).length}
            reduceMotion={settings.reduceMotion}
          />
        )}

        {ready && !booting && needsOnboarding ? <OnboardingOverlay onStart={finishOnboarding} /> : null}

        {/*
          After the intro, not before it: the first thing a stranger sees
          should be what the game is, not a question about data. Both still
          come before any game starts, which is what consent requires.
        */}
        {ready && !booting && !needsOnboarding && needsConsent ? (
          <ConsentPrompt settings={settings} onChange={changeSettings} onContinue={finishConsent} />
        ) : null}

        {ready && !booting && !needsOnboarding && !needsConsent && picking && screen === 'menu' ? (
          <RandomGamePicker
            mode={picking}
            difficulty={settings.difficulty}
            onStart={startRandom}
            onCancel={() => setPicking(null)}
          />
        ) : null}

        {booting ? <BootScreen onDone={finishBoot} reduceMotion={settings.reduceMotion} /> : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
