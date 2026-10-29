import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { dailyGame, dateKey } from '../core/daily';
import {
  CAMPAIGN_LENGTH, campaignGame, nextLevel, recordLevel, type CampaignProgress,
} from '../core/campaign';
import { generateGame } from '../core/generate';
import { EMPTY_STATS, recordGameAbandoned, recordGameCompleted, recordGameStarted, type Stats } from '../core/stats';
import type { GameConfig, GameResult } from '../core/types';
import { EMPTY_PASSPORT, chooseSkin, stamp, stampCount, type Passport } from '../core/passport';
import {
  DEFAULT_SETTINGS, loadCampaign, loadDailyResults, loadOnboarded, loadPassport, loadSettings, loadStats,
  loadConsentAsked, resetEverything, saveCampaign, saveConsentAsked, saveDailyResults,
  saveOnboarded, savePassport, saveSettings, saveStats,
  type DailyResults, type Settings,
} from '../storage/storage';
import { setSoundEnabled } from '../audio/sounds';
import { setAnalyticsEnabled, track } from '../core/analytics';
import { colors } from '../theme';
import { setHapticsEnabled } from './hooks/useHaptics';
import { getAds } from '../ads';
import { installFirebaseSink, setFirebaseConsent } from '../analytics/firebase';
import { getReminders, type DailyProgress, type ReminderPrefs } from '../reminders';
import { GameScreen } from './screens/GameScreen';
import { MenuScreen } from './screens/MenuScreen';
import { StatsScreen } from './screens/StatsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { OnboardingOverlay } from './screens/OnboardingOverlay';
import { DailyDoneScreen } from './screens/DailyDoneScreen';
import { CampaignScreen } from './screens/CampaignScreen';
import { RandomGamePicker, type RandomMode } from './screens/RandomGamePicker';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { PassportScreen } from './screens/PassportScreen';
import { ConsentPrompt } from './screens/ConsentPrompt';
import { BootScreen } from './screens/BootScreen';
import { ReminderOffer } from './screens/ReminderOffer';

/** Finished games, in any mode, after which the reminder is offered anyway. */
const REMINDER_AFTER_GAMES = 10;

type Screen = 'menu' | 'game' | 'campaign' | 'stats' | 'settings' | 'privacy' | 'passport' | 'daily-done';

/**
 * The whole app. Screens are a single piece of state rather than a navigation
 * library: there are eight of them and none of them nest.
 */
export function BorderHopperApp() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [dailyResults, setDailyResults] = useState<DailyResults>({});
  const [campaign, setCampaign] = useState<CampaignProgress>({});
  const [passport, setPassport] = useState<Passport>(EMPTY_PASSPORT);
  // The latest passport, for stamping. Two moves can land before React
  // re-renders, and stamping from a stale copy would drop the first.
  const passportRef = useRef<Passport>(EMPTY_PASSPORT);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  /** Which mode the new-game sheet is open on, or null when it is closed. */
  const [picking, setPicking] = useState<RandomMode | null>(null);
  const [ready, setReady] = useState(false);
  // The latest settings, for code that resumes after the tracking prompt and
  // must not write back the settings as they were before it opened.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // Set while leaving a result card, so a double tap cannot start two games.
  const leaving = useRef(false);
  const [booting, setBooting] = useState(true);
  const [reminder, setReminder] = useState<ReminderPrefs>(() => getReminders().state());
  /** Notifications are switched off for the game in the phone's settings. */
  const [reminderBlocked, setReminderBlocked] = useState(false);
  /** The one-time offer has been earned and waits for a calm screen. */
  const [offerDue, setOfferDue] = useState<'daily' | 'games' | null>(null);
  /** A reminder was tapped; acted on once the saved progress is loaded. */
  const [openedFromReminder, setOpenedFromReminder] = useState(false);

  useEffect(() => {
    void (async () => {
      const [savedStats, savedSettings, savedDaily, savedCampaign, onboarded, consentAsked, savedPassport] =
        await Promise.all([
          loadStats(), loadSettings(), loadDailyResults(), loadCampaign(), loadOnboarded(),
          loadConsentAsked(), loadPassport(dateKey()), getReminders().load(),
        ]);
      passportRef.current = savedPassport;
      setPassport(savedPassport);
      setStats(savedStats);
      setSettings(savedSettings);
      setDailyResults(savedDaily);
      setCampaign(savedCampaign);
      setNeedsOnboarding(!onboarded);
      setNeedsConsent(!consentAsked);
      setReminder(getReminders().state());
      setReady(true);
      // The player's saved choice goes to Unity before anything else does.
      // Someone who has already answered the consent card is not asked about
      // tracking again here; this only reads what they said last time.
      const ads = getAds();
      await ads.start(savedSettings.personalisedAds);
      if (consentAsked) await ads.tracking(false);
    })();
  }, []);

  // Personalised ads follow the switch, whichever screen moved it.
  useEffect(() => {
    if (ready) void getAds().setPersonalised(settings.personalisedAds);
  }, [ready, settings.personalisedAds]);

  useEffect(() => installFirebaseSink(), []);

  useEffect(() => {
    if (ready) void setFirebaseConsent(settings.analytics, settings.personalisedAds);
  }, [ready, settings.analytics, settings.personalisedAds]);

  /**
   * What the reminders are worked out from. Any change -- a finished daily,
   * a reset, the first load -- reschedules the week, so today's reminder is
   * dropped once today is done and the streak in the wording is always true.
   */
  const dailyProgress = useMemo<DailyProgress>(
    () => ({ played: dailyResults, dailyStreak: stats.dailyStreak, lastDailyKey: stats.lastDailyKey }),
    [dailyResults, stats.dailyStreak, stats.lastDailyKey]
  );
  const dailyProgressRef = useRef(dailyProgress);
  dailyProgressRef.current = dailyProgress;

  useEffect(() => {
    if (ready) void getReminders().sync(dailyProgress);
  }, [ready, dailyProgress]);

  // Coming back to the foreground: a new day may have started, and the
  // player may have changed the notification setting while away.
  const readyRef = useRef(ready);
  readyRef.current = ready;
  useEffect(() => {
    const reminders = getReminders();
    if (!reminders.available()) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !readyRef.current) return;
      void reminders.sync(dailyProgressRef.current);
      void reminders.permission().then((answer) => setReminderBlocked(answer === 'denied'));
    });
    return () => subscription.remove();
  }, []);

  // Attached at once: the plugin holds a tap that launched the app until
  // somebody is listening.
  useEffect(() => getReminders().onOpen(() => setOpenedFromReminder(true)), []);

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

  const updatePassport = useCallback((next: Passport) => {
    passportRef.current = next;
    setPassport(next);
    void savePassport(next);
  }, []);

  const stampCountries = useCallback(
    (isos: string[]) => {
      const next = stamp(passportRef.current, isos, dateKey());
      if (next !== passportRef.current) updatePassport(next);
    },
    [updatePassport]
  );

  const wearSkin = useCallback(
    (skin: string | null) => {
      const next = chooseSkin(passportRef.current, skin);
      if (next === passportRef.current) return;
      updatePassport(next);
      track('skin_changed', { skin: skin ?? 'default', stamps: stampCount(next) });
    },
    [updatePassport]
  );

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
      const nextStats = recordGameCompleted(stats, result);
      persistStats(nextStats);
      getAds().noteGameFinished();
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
      // The reminder is about the daily, so the first one finished is when it
      // means most; ten games anywhere catches a player who has stuck around
      // without finding it. Shown later, off the game screen.
      const earned = result.mode === 'daily' ? 'daily' : nextStats.gamesCompleted >= REMINDER_AFTER_GAMES ? 'games' : null;
      if (earned) {
        void getReminders()
          .shouldOffer()
          .then((ok) => {
            if (ok) setOfferDue((due) => due ?? earned);
          });
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

  /**
   * After the consent card, iPhone asks about tracking -- Apple's prompt,
   * shown once, at the moment the player has just been told what it is for.
   * Allowing it turns personalised ads on, as in the studio's other games;
   * it can be turned off again in Privacy & data. Android has no such prompt,
   * so personalised ads stay off there until the player turns them on.
   */
  const finishConsent = useCallback(() => {
    setNeedsConsent(false);
    void saveConsentAsked();
    void (async () => {
      const status = await getAds().tracking(true);
      const current = settingsRef.current;
      if (status === 'authorized' && !current.personalisedAds) {
        track('consent_changed', { setting: 'personalised_ads', enabled: true });
        updateSettings({ ...current, personalisedAds: true });
      }
    })();
  }, [updateSettings]);

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
        // On iPhone, personalised ads also need Apple's permission. Asks only
        // if the player has never been asked; otherwise the answer stands.
        if (next.personalisedAds) void getAds().tracking(true);
      }
      updateSettings(next);
    },
    [settings, updateSettings]
  );

  /**
   * Leaving a finished game is the only time an ad may appear: the result is
   * on screen, the player has chosen to move on, and nothing is interrupted.
   * Whether one actually shows is the pacing's call (see src/ads/policy.ts);
   * most of the time it resolves at once and the game simply carries on.
   */
  const afterAd = useCallback((next: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    void getAds()
      .maybeShowInterstitial()
      .finally(() => {
        leaving.current = false;
        next();
      });
  }, []);

  const refreshReminder = useCallback(async () => {
    const reminders = getReminders();
    setReminder(reminders.state());
    setReminderBlocked((await reminders.permission()) === 'denied');
  }, []);

  /** "Remind me" on the offer, or the Settings switch turned on. */
  const enableReminder = useCallback(
    async (from: 'offer' | 'settings') => {
      const reminders = getReminders();
      const result = await reminders.enable(dailyProgressRef.current);
      if (result === 'on') track('reminder_changed', { enabled: true, hour: reminders.state().hour, from });
      await refreshReminder();
    },
    [refreshReminder]
  );

  const toggleReminder = useCallback(
    (on: boolean) => {
      if (on) {
        void enableReminder('settings');
        return;
      }
      void (async () => {
        const reminders = getReminders();
        await reminders.disable();
        track('reminder_changed', { enabled: false, hour: reminders.state().hour, from: 'settings' });
        await refreshReminder();
      })();
    },
    [enableReminder, refreshReminder]
  );

  const setReminderHour = useCallback(
    (hour: number) => {
      const reminders = getReminders();
      void reminders.setHour(hour, dailyProgressRef.current).then(() => setReminder(reminders.state()));
      // Shown at once rather than after the reschedule, so the stepper keeps up with taps.
      setReminder((current) => ({ ...current, hour }));
    },
    []
  );

  // Opening Settings checks the phone's setting, which can change while the
  // game is closed: "On" next to reminders that cannot arrive would be a lie.
  useEffect(() => {
    if (screen === 'settings' && getReminders().available()) void refreshReminder();
  }, [screen, refreshReminder]);

  const calm = ready && !booting && !needsOnboarding && !needsConsent && !picking && screen !== 'game';
  const showOffer = calm && offerDue !== null;

  useEffect(() => {
    if (!showOffer || !offerDue) return;
    void getReminders().markOffered();
    track('reminder_offer', { from: offerDue });
  }, [showOffer, offerDue]);

  /**
   * A tapped reminder opens today's daily -- or, once it is done, the daily's
   * done screen. A game in progress is left alone rather than thrown away, and
   * so is the first-run intro and consent card.
   */
  useEffect(() => {
    if (!openedFromReminder || !ready) return;
    setOpenedFromReminder(false);
    if (screen === 'game' || needsOnboarding || needsConsent) return;
    setOfferDue(null);
    setPicking(null);
    startDaily();
  }, [openedFromReminder, ready, screen, needsOnboarding, needsConsent, startDaily]);

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
            onExit={(unfinished) => (unfinished ? leaveGame(true) : afterAd(() => leaveGame(false)))}
            onNewGame={() =>
              afterAd(
                config.mode === 'campaign'
                  ? advanceCampaign
                  : config.mode === 'daily'
                    ? () => leaveGame(false)
                    : config.mode === 'flight'
                      ? startFlight
                      : startClassic
              )
            }
            onComplete={handleComplete}
            passport={passport}
            onStamp={stampCountries}
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
              passportRef.current = EMPTY_PASSPORT;
              setPassport(EMPTY_PASSPORT);
              // Erasing everything includes the answer: the card comes back
              // rather than a stale yes surviving a reset.
              setNeedsConsent(true);
            }}
            onBack={() => setScreen('menu')}
            onPrivacy={() => setScreen('privacy')}
            reminder={
              getReminders().available()
                ? {
                    on: reminder.on,
                    hour: reminder.hour,
                    blocked: reminderBlocked,
                    onToggle: toggleReminder,
                    onHour: setReminderHour,
                  }
                : null
            }
          />
        ) : screen === 'privacy' ? (
          <PrivacyScreen
            settings={settings}
            onChange={changeSettings}
            // Back to Settings, which is where it was opened from.
            onBack={() => setScreen('settings')}
          />
        ) : screen === 'passport' ? (
          <PassportScreen
            passport={passport}
            onWear={wearSkin}
            onBack={() => setScreen('menu')}
            reduceMotion={settings.reduceMotion}
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
            onPassport={() => setScreen('passport')}
            stamps={stampCount(passport)}
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

        {showOffer && offerDue ? (
          <ReminderOffer
            from={offerDue}
            gamesCompleted={stats.gamesCompleted}
            hour={reminder.hour}
            onYes={() => {
              setOfferDue(null);
              void enableReminder('offer');
            }}
            onNo={() => setOfferDue(null)}
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
