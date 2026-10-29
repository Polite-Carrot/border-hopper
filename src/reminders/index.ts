import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { store } from '../storage/backend';
import { createReminders, type Reminders } from './reminders';

let instance: Reminders | null = null;

/** The app's one reminders client: there is one set of scheduled notifications. */
export function getReminders(): Reminders {
  instance ??= createReminders({
    plugin: LocalNotifications,
    platform: () => (Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web'),
    storage: {
      getItem: (key) => store().getItem(key),
      setItem: (key, value) => store().setItem(key, value),
    },
  });
  return instance;
}

export { EARLIEST_HOUR, LATEST_HOUR, hourLabel, type DailyProgress, type ReminderPrefs } from './reminders';
