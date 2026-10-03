import AsyncStorage from '@react-native-async-storage/async-storage';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/** The handful of key/value calls the game's storage needs. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

/**
 * The web view's own storage, left behind by builds that saved there. Only
 * read so it can be moved across, and cleared once it has been.
 */
function legacyWebStorage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Saves on the phone itself: UserDefaults on iOS, SharedPreferences on
 * Android, through Capacitor's Preferences plugin.
 *
 * The apps are a web view, and a web view's localStorage is not the device's
 * storage. iOS treats it as a cache it may clear when space runs low, and it
 * goes with the web view's data rather than the app's. Stats, campaign
 * progress and the passport are worth more than that.
 *
 * Anything an earlier build saved in localStorage is moved across the first
 * time it is asked for, then removed there, so updating the app keeps
 * everything and a later reset cannot bring the old copy back.
 */
export const deviceStore: KeyValueStore = {
  async getItem(key) {
    const { value } = await Preferences.get({ key });
    if (value !== null) return value;
    const legacy = legacyWebStorage();
    const old = legacy?.getItem(key) ?? null;
    if (old === null) return null;
    await Preferences.set({ key, value: old });
    legacy?.removeItem(key);
    return old;
  },
  async setItem(key, value) {
    await Preferences.set({ key, value });
  },
  async multiRemove(keys) {
    const legacy = legacyWebStorage();
    for (const key of keys) {
      await Preferences.remove({ key });
      legacy?.removeItem(key);
    }
  },
};

/** Browsers -- the website -- and React Native proper, through AsyncStorage. */
const asyncStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  multiRemove: (keys) => AsyncStorage.multiRemove([...keys]),
};

/**
 * Where the game saves. Decided per call rather than once at import, so it can
 * never be fixed before Capacitor's bridge has said whether it is there.
 */
export function store(): KeyValueStore {
  return Capacitor.isNativePlatform() ? deviceStore : asyncStore;
}
