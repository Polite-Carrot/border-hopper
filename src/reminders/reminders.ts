import type { LocalNotificationSchema, LocalNotificationsPlugin } from '@capacitor/local-notifications';
import { dateKey, previousDateKey } from '../core/daily';

/**
 * Daily challenge reminders, as LOCAL notifications.
 *
 * The daily challenge is built on the phone from the date, so the phone can
 * also schedule its own reminder: no push server, no Firebase Cloud
 * Messaging, no APNs keys, and nothing leaves the device.
 *
 * How it schedules: not one repeating alarm, because a repeating alarm cannot
 * skip a day. Instead the next DAYS_AHEAD days are scheduled one by one, and
 * every time the game opens, comes back to the foreground or a daily is
 * finished, all of them are cancelled and rescheduled from scratch. So:
 *   - today's reminder is dropped as soon as today's challenge is finished;
 *   - the wording can mention the streak, and is always true when it fires;
 *   - someone who stops playing hears from us for a week and then not again.
 *
 * The player is asked for notification permission only after tapping
 * "Remind me" (offered after their first daily, or from Settings), never at
 * launch: iOS lets an app show that system prompt once, ever.
 */

/**
 * Outside the storage module's KEYS on purpose: "Reset all progress" erases
 * those, and whether someone wants a reminder is not progress.
 */
export const REMINDER_KEY = 'borderbound:reminders:v1';
const CHANNEL = 'daily';
/** Ids FIRST_ID .. FIRST_ID + DAYS_AHEAD - 1 belong to this module. */
const FIRST_ID = 7100;
const DAYS_AHEAD = 7;
export const DEFAULT_HOUR = 18;
/** The hours Settings offers: 7am to 10pm. */
export const EARLIEST_HOUR = 7;
export const LATEST_HOUR = 22;

export interface ReminderPrefs {
  /** True once the player has said yes; false if they turned it off. */
  on: boolean;
  /** The one-time offer has been shown, or answered in Settings. */
  asked: boolean;
  /** 0-23, local time. */
  hour: number;
}

/** What the wording and the skipped day are worked out from. */
export interface DailyProgress {
  /** Finished dailies, by date key. */
  played: Readonly<Record<string, unknown>>;
  dailyStreak: number;
  lastDailyKey: string | null;
}

export type ReminderPermission = 'granted' | 'denied' | 'prompt' | 'unavailable';
export type EnableResult = 'on' | 'denied' | 'unavailable';

export type NotificationsPlugin = Pick<
  LocalNotificationsPlugin,
  'checkPermissions' | 'requestPermissions' | 'schedule' | 'cancel' | 'createChannel' | 'addListener'
>;

export interface ReminderDeps {
  plugin: NotificationsPlugin;
  /** 'ios', 'android' or 'web'. Asked per call, never fixed at import. */
  platform: () => string;
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
  };
  clock?: () => Date;
}

export interface Reminders {
  /** True inside the iOS or Android app; on the web nothing here does anything. */
  available(): boolean;
  /** Reads the saved choice. Every other call waits for it. */
  load(): Promise<ReminderPrefs>;
  state(): ReminderPrefs;
  permission(): Promise<ReminderPermission>;
  /** Turns reminders on, showing the system prompt if it has never been shown. */
  enable(progress: DailyProgress): Promise<EnableResult>;
  disable(): Promise<void>;
  setHour(hour: number, progress?: DailyProgress): Promise<void>;
  /** Cancels and reschedules from the current progress. Safe to call often. */
  sync(progress?: DailyProgress): Promise<void>;
  shouldOffer(): Promise<boolean>;
  markOffered(): Promise<void>;
  /** `fn(dayKey)` runs when the player taps a reminder. */
  onOpen(fn: (day: string) => void): void;
}

export const DEFAULT_PREFS: ReminderPrefs = { on: false, asked: false, hour: DEFAULT_HOUR };

/** "6pm", "12pm", "7am". */
export function hourLabel(hour: number): string {
  const n = hour % 12 === 0 ? 12 : hour % 12;
  return `${n}${hour < 12 ? 'am' : 'pm'}`;
}

/**
 * The daily streak still alive on `todayKey`: kept if today or yesterday was
 * played, broken otherwise. The stats keep the last count until the next
 * daily, so a missed day has to be read from the date, not the number.
 */
export function liveStreak(progress: DailyProgress, todayKey: string): number {
  const last = progress.lastDailyKey;
  return last === todayKey || last === previousDateKey(todayKey) ? progress.dailyStreak : 0;
}

export const REMINDER_TITLE = 'Daily challenge';
export const reminderBody = (streak: number): string =>
  streak >= 2
    ? `Your daily challenge is ready. Keep your ${streak}-day streak alive! 🔥`
    : 'A new daily challenge is ready.';

/**
 * The notifications to schedule. Pure, so it can be tested without a phone.
 */
export function plan(progress: DailyProgress, hour: number, now: Date): LocalNotificationSchema[] {
  const todayKey = dateKey(now);
  const todayDone = Boolean(progress.played[todayKey]) || progress.lastDailyKey === todayKey;
  const streak = liveStreak(progress, todayKey);
  const out: LocalNotificationSchema[] = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    if (i === 0 && todayDone) continue;
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, 0, 0);
    if (at <= now) continue;
    // The streak can only be quoted on the next reminder to fire: by the one
    // after, the player may have missed a day in between. That is today's if
    // today is still to play, tomorrow's if it is done.
    const next = todayDone ? i === 1 : i === 0;
    out.push({
      id: FIRST_ID + i,
      title: REMINDER_TITLE,
      body: reminderBody(next ? streak : 0),
      schedule: { at, allowWhileIdle: true },
      // Inexact: a reminder a few minutes late is fine, and asking for exact
      // alarms sends Android 12+ players to a system settings page.
      isExactNotification: false,
      channelId: CHANNEL,
      smallIcon: 'ic_stat_daily',
      iconColor: '#3DBDF8',
      extra: { kind: 'daily', day: dateKey(at) },
    });
  }
  return out;
}

const warn = (what: string, error: unknown) =>
  console.warn(`Reminders: ${what}:`, (error as { message?: string } | null)?.message ?? error);

export function createReminders({ plugin, platform, storage, clock = () => new Date() }: ReminderDeps): Reminders {
  let prefs: ReminderPrefs = { ...DEFAULT_PREFS };
  let loading: Promise<ReminderPrefs> | null = null;
  let channelMade = false;
  let lastProgress: DailyProgress = { played: {}, dailyStreak: 0, lastDailyKey: null };
  let queue: Promise<void> = Promise.resolve();

  const available = () => platform() === 'ios' || platform() === 'android';

  function load(): Promise<ReminderPrefs> {
    loading ??= (async () => {
      try {
        const raw = await storage.getItem(REMINDER_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<ReminderPrefs>;
          prefs = {
            on: saved.on === true,
            asked: saved.asked === true,
            hour: typeof saved.hour === 'number' && saved.hour >= 0 && saved.hour <= 23 ? saved.hour : DEFAULT_HOUR,
          };
        }
      } catch {
        // Unreadable: start from off, which is never wrong.
      }
      return prefs;
    })();
    return loading;
  }

  async function save(): Promise<void> {
    try {
      await storage.setItem(REMINDER_KEY, JSON.stringify(prefs));
    } catch {
      // Worst case the choice is asked again next launch.
    }
  }

  async function permission(): Promise<ReminderPermission> {
    if (!available()) return 'unavailable';
    try {
      const { display } = await plugin.checkPermissions();
      if (display === 'granted') return 'granted';
      if (display === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'unavailable';
    }
  }

  async function ensureChannel(): Promise<void> {
    if (channelMade || platform() !== 'android') return;
    try {
      await plugin.createChannel({
        id: CHANNEL,
        name: 'Daily challenge',
        description: 'A reminder when the daily challenge is ready',
        importance: 3,
      });
      channelMade = true;
    } catch (error) {
      warn('channel failed', error);
    }
  }

  async function cancelAll(): Promise<void> {
    const notifications = Array.from({ length: DAYS_AHEAD }, (_, i) => ({ id: FIRST_ID + i }));
    try {
      await plugin.cancel({ notifications });
    } catch {
      // Nothing scheduled is the same as nothing cancelled.
    }
  }

  function sync(progress?: DailyProgress): Promise<void> {
    if (progress) lastProgress = progress;
    if (!available()) return Promise.resolve();
    // Calls queue rather than overlap, so two quick syncs cannot interleave
    // a cancel between the other's cancel and schedule.
    queue = queue
      .then(async () => {
        await load();
        await cancelAll();
        if (!prefs.on || (await permission()) !== 'granted') return;
        await ensureChannel();
        const notifications = plan(lastProgress, prefs.hour, clock());
        if (!notifications.length) return;
        try {
          await plugin.schedule({ notifications });
        } catch (error) {
          warn('schedule failed', error);
        }
      })
      .catch(() => {});
    return queue;
  }

  return {
    available,
    load,
    state: () => ({ ...prefs }),
    permission,

    async enable(progress) {
      if (!available()) return 'unavailable';
      await load();
      prefs.asked = true;
      let answer = await permission();
      if (answer === 'prompt') {
        try {
          answer = (await plugin.requestPermissions()).display === 'granted' ? 'granted' : 'denied';
        } catch {
          answer = 'denied';
        }
      }
      prefs.on = answer === 'granted';
      await save();
      await sync(progress);
      return prefs.on ? 'on' : answer === 'unavailable' ? 'unavailable' : 'denied';
    },

    async disable() {
      await load();
      prefs.on = false;
      prefs.asked = true;
      await save();
      await sync();
    },

    async setHour(hour, progress) {
      if (!(Number.isInteger(hour) && hour >= 0 && hour <= 23)) return;
      await load();
      prefs.hour = hour;
      await save();
      await sync(progress);
    },

    sync,

    // Only where notifications exist, once per install, and only if the
    // system has not already said no: a prompt that cannot appear is a
    // broken button. 'granted' counts too, because Android 12 and older have
    // no runtime prompt and report granted from the start.
    async shouldOffer() {
      if (!available()) return false;
      await load();
      if (prefs.asked || prefs.on) return false;
      const answer = await permission();
      return answer === 'prompt' || answer === 'granted';
    },

    async markOffered() {
      await load();
      prefs.asked = true;
      await save();
    },

    // Taps that cold-start the app are held by the plugin until a listener
    // is attached, so attaching early is enough to catch them.
    onOpen(fn) {
      if (!available()) return;
      plugin
        .addListener('localNotificationActionPerformed', (action) => {
          const extra = action?.notification?.extra as { kind?: string; day?: string } | undefined;
          if (extra?.kind === 'daily') fn(extra.day ?? '');
        })
        .catch((error) => warn('listener failed', error));
    },
  };
}
