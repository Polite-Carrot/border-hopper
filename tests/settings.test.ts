import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A stand-in for the device's key/value store, so the loading and saving rules
 * can be tested in Node without React Native.
 */
const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      for (const key of keys) store.delete(key);
    },
  },
}));

const { DEFAULT_SETTINGS, loadSettings, saveSettings } = await import('../src/storage/storage');

const SETTINGS_KEY = 'borderbound:settings:v1';

describe('privacy settings', () => {
  beforeEach(() => store.clear());

  it('starts with both kinds of consent switched off', () => {
    expect(DEFAULT_SETTINGS.analytics).toBe(false);
    expect(DEFAULT_SETTINGS.personalisedAds).toBe(false);
  });

  it('gives a brand new player consent switched off', async () => {
    const settings = await loadSettings();
    expect(settings.analytics).toBe(false);
    expect(settings.personalisedAds).toBe(false);
  });

  it('never turns consent on for a player who was never asked', async () => {
    // Exactly what an existing player has saved: the settings as they were
    // before these two switches existed. An upgrade must not read the missing
    // keys as anything but "no".
    store.set(
      SETTINGS_KEY,
      JSON.stringify({ difficulty: 'hard', sound: false, haptics: true, reduceMotion: false })
    );
    const settings = await loadSettings();
    expect(settings.analytics).toBe(false);
    expect(settings.personalisedAds).toBe(false);
    // ...while keeping what they had chosen.
    expect(settings.difficulty).toBe('hard');
  });

  it('remembers each switch on its own', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, analytics: true });
    const settings = await loadSettings();
    expect(settings.analytics).toBe(true);
    expect(settings.personalisedAds).toBe(false);

    await saveSettings({ ...settings, personalisedAds: true, analytics: false });
    const after = await loadSettings();
    expect(after.analytics).toBe(false);
    expect(after.personalisedAds).toBe(true);
  });

  it('falls back to no consent when the stored settings are corrupt', async () => {
    store.set(SETTINGS_KEY, '{ not json');
    const settings = await loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings.analytics).toBe(false);
  });
});
