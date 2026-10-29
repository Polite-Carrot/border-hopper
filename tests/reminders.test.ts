import { describe, expect, it, vi } from 'vitest';
import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import { dateKey } from '../src/core/daily';
import {
  REMINDER_KEY, createReminders, plan, type DailyProgress, type NotificationsPlugin, type ReminderPrefs,
} from '../src/reminders/reminders';

/**
 * Daily reminders, against a stand-in for the local notifications plugin
 * that records every call, so what reaches the phone can be checked.
 */
function setup({
  permission = 'prompt' as string,
  answer = 'granted' as string,
  platform = 'ios',
  stored = null as Partial<ReminderPrefs> | null,
} = {}) {
  const calls: [string, unknown?][] = [];
  const storage = new Map<string, string>(stored ? [[REMINDER_KEY, JSON.stringify(stored)]] : []);
  let display = permission;
  let tap: ((action: unknown) => void) | null = null;
  const plugin = {
    async checkPermissions() {
      return { display };
    },
    async requestPermissions() {
      calls.push(['requestPermissions']);
      display = answer;
      return { display };
    },
    async cancel(options: { notifications: { id: number }[] }) {
      calls.push(['cancel', options.notifications.map((n) => n.id)]);
    },
    async schedule(options: { notifications: LocalNotificationSchema[] }) {
      calls.push(['schedule', options.notifications]);
      return { notifications: [] };
    },
    async createChannel(channel: { id: string }) {
      calls.push(['createChannel', channel.id]);
    },
    async addListener(name: string, fn: (action: unknown) => void) {
      calls.push(['addListener', name]);
      tap = fn;
      return { remove: async () => {} };
    },
  } as unknown as NotificationsPlugin;
  const reminders = createReminders({
    plugin,
    platform: () => platform,
    storage: {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => void storage.set(key, value),
    },
  });
  return {
    reminders,
    calls,
    storage,
    tap: (action: unknown) => tap?.(action),
    scheduled: () =>
      (calls.filter((c) => c[0] === 'schedule').pop()?.[1] as LocalNotificationSchema[] | undefined) ?? [],
  };
}

const NONE: DailyProgress = { played: {}, dailyStreak: 0, lastDailyKey: null };
const daysAgo = (n: number, hour = 0) => {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};
const at = (n: LocalNotificationSchema) => n.schedule!.at as Date;

describe('daily reminders', () => {
  it('asks and schedules nothing until the player says yes', async () => {
    const f = setup();
    await f.reminders.sync(NONE);
    expect(f.calls.some((c) => c[0] === 'requestPermissions')).toBe(false);
    expect(f.calls.some((c) => c[0] === 'schedule')).toBe(false);
  });

  it('"Remind me" asks the system once and schedules the next week at the chosen hour', async () => {
    const f = setup();
    expect(await f.reminders.enable(NONE)).toBe('on');
    expect(f.calls.filter((c) => c[0] === 'requestPermissions')).toHaveLength(1);
    const list = f.scheduled();
    expect(list.length).toBeGreaterThanOrEqual(6);
    expect(list.length).toBeLessThanOrEqual(7);
    for (const n of list) {
      expect(at(n).getHours()).toBe(18);
      expect(at(n).getTime()).toBeGreaterThan(Date.now());
      // Never sends Android players to the exact-alarm settings page.
      expect(n.isExactNotification).toBe(false);
      expect(n.extra).toMatchObject({ kind: 'daily' });
      expect(n.title).toBe('Daily challenge');
    }
    expect(new Set(list.map((n) => n.id)).size).toBe(list.length);
    expect(JSON.parse(f.storage.get(REMINDER_KEY)!)).toEqual({ on: true, asked: true, hour: 18 });
  });

  it('skips today once today’s daily is finished', () => {
    const morning = daysAgo(0, 9);
    const today = dateKey(morning);
    const unplayed = plan(NONE, 23, morning);
    const played = plan({ played: { [today]: {} }, dailyStreak: 1, lastDailyKey: today }, 23, morning);
    expect(dateKey(at(unplayed[0]))).toBe(today);
    expect(dateKey(at(played[0]))).not.toBe(today);
    expect(played).toHaveLength(unplayed.length - 1);
  });

  it('leaves out a reminder whose time has already passed today', () => {
    const evening = daysAgo(0, 20);
    const list = plan(NONE, 18, evening);
    expect(list).toHaveLength(6);
    expect(dateKey(at(list[0]))).not.toBe(dateKey(evening));
  });

  it('quotes the streak only on the next reminder, where it is still true', () => {
    const morning = daysAgo(0, 9);
    const today = dateKey(morning);
    // Five days running, today included: tomorrow's reminder quotes it.
    const done = plan({ played: { [today]: {} }, dailyStreak: 5, lastDailyKey: today }, 23, morning);
    expect(done[0].body).toBe('Your daily challenge is ready. Keep your 5-day streak alive! 🔥');
    expect(done.slice(1).every((n) => !/streak/.test(n.body))).toBe(true);
    // Played up to yesterday: today's reminder is the one that keeps it.
    const yesterday = dateKey(daysAgo(1));
    const pending = plan({ played: { [yesterday]: {} }, dailyStreak: 4, lastDailyKey: yesterday }, 23, morning);
    expect(dateKey(at(pending[0]))).toBe(today);
    expect(pending[0].body).toMatch(/Keep your 4-day streak alive/);
    expect(pending.slice(1).every((n) => n.body === 'A new daily challenge is ready.')).toBe(true);
  });

  it('never quotes a streak that is already broken, or a single day', () => {
    const morning = daysAgo(0, 9);
    const old = dateKey(daysAgo(3));
    const broken = plan({ played: { [old]: {} }, dailyStreak: 9, lastDailyKey: old }, 23, morning);
    expect(broken.every((n) => n.body === 'A new daily challenge is ready.')).toBe(true);
    const yesterday = dateKey(daysAgo(1));
    const one = plan({ played: { [yesterday]: {} }, dailyStreak: 1, lastDailyKey: yesterday }, 23, morning);
    expect(one[0].body).toBe('A new daily challenge is ready.');
  });

  it('declining at the system prompt leaves reminders off', async () => {
    const f = setup({ answer: 'denied' });
    expect(await f.reminders.enable(NONE)).toBe('denied');
    expect(f.reminders.state().on).toBe(false);
    expect(f.calls.some((c) => c[0] === 'schedule')).toBe(false);
  });

  it('offers once, and never where the system has already said no', async () => {
    const f = setup();
    expect(await f.reminders.shouldOffer()).toBe(true);
    await f.reminders.markOffered();
    expect(await f.reminders.shouldOffer()).toBe(false);
    expect(await setup({ permission: 'denied' }).reminders.shouldOffer()).toBe(false);
    // Android 12 and older report granted with no prompt at all.
    expect(await setup({ permission: 'granted', platform: 'android' }).reminders.shouldOffer()).toBe(true);
    // Remembered across launches.
    expect(await setup({ stored: { asked: true } }).reminders.shouldOffer()).toBe(false);
  });

  it('turning it off cancels everything', async () => {
    const f = setup();
    await f.reminders.enable(NONE);
    await f.reminders.disable();
    expect(f.calls[f.calls.length - 1][0]).toBe('cancel');
    expect(f.calls[f.calls.length - 1][1]).toEqual([7100, 7101, 7102, 7103, 7104, 7105, 7106]);
    expect(f.reminders.state().on).toBe(false);
  });

  it('changing the hour reschedules at the new time and remembers it', async () => {
    const f = setup();
    await f.reminders.enable(NONE);
    await f.reminders.setHour(8, NONE);
    expect(f.scheduled().every((n) => at(n).getHours() === 8)).toBe(true);
    expect(JSON.parse(f.storage.get(REMINDER_KEY)!).hour).toBe(8);
  });

  it('a saved yes reschedules on launch without asking again', async () => {
    const f = setup({ permission: 'granted', stored: { on: true, asked: true, hour: 21 } });
    await f.reminders.load();
    await f.reminders.sync(NONE);
    expect(f.calls.some((c) => c[0] === 'requestPermissions')).toBe(false);
    expect(f.scheduled().every((n) => at(n).getHours() === 21)).toBe(true);
  });

  it('schedules nothing once notifications are switched off in the phone’s settings', async () => {
    const f = setup({ permission: 'denied', stored: { on: true, asked: true, hour: 18 } });
    await f.reminders.sync(NONE);
    expect(f.calls.some((c) => c[0] === 'cancel')).toBe(true);
    expect(f.calls.some((c) => c[0] === 'schedule')).toBe(false);
  });

  it('Android gets its channel before the first schedule', async () => {
    const f = setup({ platform: 'android' });
    await f.reminders.enable(NONE);
    const names = f.calls.map((c) => c[0]);
    expect(names).toContain('createChannel');
    expect(names.indexOf('createChannel')).toBeLessThan(names.indexOf('schedule'));
  });

  it('tapping a reminder reaches the game; other notifications do not', async () => {
    const f = setup();
    const opened: string[] = [];
    f.reminders.onOpen((day) => opened.push(day));
    await f.reminders.enable(NONE);
    await Promise.resolve();
    const n = f.scheduled()[0];
    f.tap({ actionId: 'tap', notification: n });
    f.tap({ actionId: 'tap', notification: { extra: { kind: 'something-else' } } });
    expect(opened).toEqual([(n.extra as { day: string }).day]);
  });

  it('web: nothing to schedule and nothing touched', async () => {
    const f = setup({ platform: 'web' });
    expect(f.reminders.available()).toBe(false);
    expect(await f.reminders.enable(NONE)).toBe('unavailable');
    await f.reminders.sync(NONE);
    f.reminders.onOpen(() => {});
    expect(await f.reminders.shouldOffer()).toBe(false);
    expect(f.calls).toHaveLength(0);
  });
});

describe('reset all progress', () => {
  it('keeps the reminder choice', async () => {
    const removed: string[] = [];
    vi.doMock('../src/storage/backend', () => ({
      store: () => ({
        getItem: async () => null,
        setItem: async () => {},
        multiRemove: async (keys: readonly string[]) => void removed.push(...keys),
      }),
    }));
    const { resetEverything } = await import('../src/storage/storage');
    await resetEverything();
    expect(removed).toContain('borderbound:stats:v1');
    expect(removed).not.toContain(REMINDER_KEY);
    vi.doUnmock('../src/storage/backend');
  });
});
