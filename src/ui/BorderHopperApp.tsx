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
  resetEverything, saveCampaign, saveDailyResults, saveOnboarded, saveSettings, saveStats,
  type DailyResults, type Settings,
} from '../storage/storage';
import { setSoundEnabled } from '../audio/sounds';
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
import { BootScreen } from './screens/BootScreen';

type Screen = 'menu' | 'game' | 'campaign' | 'stats' | 'settings' | 'daily-done';

/**
 * The whole app. Screens are a single piece of state rather than a navigation
 * library: there are five of them and none of them nest.
 */
export function BorderHopperApp() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [dailyResults, setDailyResults] = useState<DailyResults>({});
  const [campaign, setCampaign] = useState<CampaignProgress>({});
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  /** Which mode the new-game sheet is open on, or null when it is closed. */
  const [picking, setPicking] = useState<RandomMode | null>(null);
  const [ready, setReady] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    void (async () => {
      const [savedStats, savedSettings, savedDaily, savedCampaign, onboarded] = await Promise.all([
        loadStats(), loadSettings(), loadDailyResults(), loadCampaign(), loadOnboarded(),
      ]);
      setStats(savedStats);
      setSettings(savedSettings);
      setDailyResults(savedDaily);
      setCampaign(savedCampaign);
      setNeedsOnboarding(!onboarded);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    setHapticsEnabled(settings.haptics);
    setSoundEnabled(settings.sound);
  }, [settings.haptics, settings.sound]);

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
   * remembers the difficulty. The sheet and the Settings screen are the same
   * setting seen from two places, rather than two that can disagree.
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
      if (result.mode === 'campaign') {
        const next = recordLevel(campaign, result);
        setCampaign(next);
        void saveCampaign(next);
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
    void saveOnboarded();
  }, []);

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
            onExit={() => leaveGame(true)}
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
            onChange={updateSettings}
            onReset={() => {
              void resetEverything();
              setStats(EMPTY_STATS);
              setSettings(DEFAULT_SETTINGS);
              setDailyResults({});
              setCampaign({});
            }}
            onBack={() => setScreen('menu')}
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

        {ready && !booting && !needsOnboarding && picking && screen === 'menu' ? (
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
