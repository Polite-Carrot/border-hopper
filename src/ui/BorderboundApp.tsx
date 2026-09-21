import { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { dailyGame, dateKey } from '../core/daily';
import { generateGame } from '../core/generate';
import { EMPTY_STATS, recordGameAbandoned, recordGameCompleted, recordGameStarted, type Stats } from '../core/stats';
import type { GameConfig, GameResult } from '../core/types';
import {
  DEFAULT_SETTINGS, loadDailyResults, loadOnboarded, loadSettings, loadStats,
  resetEverything, saveDailyResults, saveOnboarded, saveSettings, saveStats,
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

type Screen = 'menu' | 'game' | 'stats' | 'settings' | 'daily-done';

/**
 * The whole app. Screens are a single piece of state rather than a navigation
 * library: there are five of them and none of them nest.
 */
export function BorderboundApp() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [dailyResults, setDailyResults] = useState<DailyResults>({});
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const [savedStats, savedSettings, savedDaily, onboarded] = await Promise.all([
        loadStats(), loadSettings(), loadDailyResults(), loadOnboarded(),
      ]);
      setStats(savedStats);
      setSettings(savedSettings);
      setDailyResults(savedDaily);
      setNeedsOnboarding(!onboarded);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    setHapticsEnabled(settings.haptics);
    setSoundEnabled(settings.sound);
  }, [settings.haptics, settings.sound]);

  const persistStats = useCallback((next: Stats) => {
    setStats(next);
    void saveStats(next);
  }, []);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    void saveSettings(next);
  }, []);

  const startClassic = useCallback(() => {
    const difficulty = settings.difficulty === 'mixed' ? undefined : settings.difficulty;
    setConfig(generateGame({ difficulty }));
    setScreen('game');
    persistStats(recordGameStarted(stats));
  }, [settings.difficulty, stats, persistStats]);

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
      if (result.mode === 'daily' && result.dailyKey) {
        const next = { ...dailyResults, [result.dailyKey]: result };
        setDailyResults(next);
        void saveDailyResults(next);
      }
    },
    [stats, dailyResults, persistStats]
  );

  const leaveGame = useCallback(
    (unfinished: boolean) => {
      if (unfinished) persistStats(recordGameAbandoned(stats));
      setConfig(null);
      setScreen('menu');
    },
    [stats, persistStats]
  );

  const finishOnboarding = useCallback(() => {
    setNeedsOnboarding(false);
    void saveOnboarded();
  }, []);

  const todayKey = dateKey();

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
            onNewGame={config.mode === 'daily' ? () => leaveGame(false) : startClassic}
            onComplete={handleComplete}
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
            onPlay={startClassic}
            onDaily={startDaily}
            onStats={() => setScreen('stats')}
            onSettings={() => setScreen('settings')}
            dailyDone={Boolean(dailyResults[todayKey])}
            dailyStreak={stats.dailyStreak}
            reduceMotion={settings.reduceMotion}
          />
        )}

        {ready && needsOnboarding ? <OnboardingOverlay onStart={finishOnboarding} /> : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
