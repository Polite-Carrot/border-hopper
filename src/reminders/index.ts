import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { store } from '../storage/backend';
import { createReminders, type Reminders } from './reminders';

let instance: Reminders | null = null;

/** The app's own Android plugin (NotificationSettingsPlugin.java). */
const NotificationSettings = registerPlugin<{ open(): Promise<void> }>('NotificationSettings');

/**
 * After a refusal the system stops asking, so its settings page is the only
 * place left to allow notifications. iOS: Capacitor hands a non-app
 * navigation to the system, and `app-settings:` is the game's own page;
 * window.open would be blocked this long after the tap. Android: the app's
 * plugin opens its notification settings.
 */
function openSettings() {
  if (Capacitor.getPlatform() === 'ios') {
    globalThis.location.href = 'app-settings:';
    return;
  }
  NotificationSettings.open().catch((error: { message?: string }) =>
    console.warn('Reminders: could not open settings:', error?.message ?? error)
  );
}

/** The app's one reminders client: there is one set of scheduled notifications. */
export function getReminders(): Reminders {
  instance ??= createReminders({
    plugin: LocalNotifications,
    platform: () => (Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web'),
    storage: {
      getItem: (key) => store().getItem(key),
      setItem: (key, value) => store().setItem(key, value),
    },
    openSettings,
  });
  return instance;
}

export { EARLIEST_HOUR, LATEST_HOUR, hourLabel, type DailyProgress, type ReminderPrefs } from './reminders';
