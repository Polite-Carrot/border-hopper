import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Inside the iOS and Android apps, saves must go to the phone's own storage
 * (Capacitor Preferences), not the web view's localStorage, which iOS may
 * clear. These stand-ins play both parts.
 */
const native = { value: true };
const preferences = new Map<string, string>();
const webView = new Map<string, string>();
const browserStore = new Map<string, string>();

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: preferences.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void preferences.set(key, value),
    remove: async ({ key }: { key: string }) => void preferences.delete(key),
  },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => browserStore.get(key) ?? null,
    setItem: async (key: string, value: string) => void browserStore.set(key, value),
    multiRemove: async (keys: string[]) => keys.forEach((key) => browserStore.delete(key)),
  },
}));
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => webView.get(key) ?? null,
  removeItem: (key: string) => void webView.delete(key),
};

const storage = await import('../src/storage/storage');
const SETTINGS = 'borderbound:settings:v1';
const STATS = 'borderbound:stats:v1';

describe('saving in the apps', () => {
  beforeEach(() => {
    native.value = true;
    preferences.clear();
    webView.clear();
    browserStore.clear();
  });

  it('saves to the phone, not the web view', async () => {
    await storage.saveSettings({ ...storage.DEFAULT_SETTINGS, sound: false });
    expect(JSON.parse(preferences.get(SETTINGS)!).sound).toBe(false);
    expect(browserStore.size).toBe(0);
    expect((await storage.loadSettings()).sound).toBe(false);
  });

  it('moves what an earlier build left in the web view across, once', async () => {
    webView.set(STATS, JSON.stringify({ gamesPlayed: 42 }));
    webView.set('borderbound:onboarded:v1', '1');

    expect((await storage.loadStats()).gamesPlayed).toBe(42);
    expect(await storage.loadOnboarded()).toBe(true);
    // Now on the phone, and gone from the web view.
    expect(JSON.parse(preferences.get(STATS)!).gamesPlayed).toBe(42);
    expect(webView.has(STATS)).toBe(false);
    expect(webView.has('borderbound:onboarded:v1')).toBe(false);
  });

  it('prefers what is on the phone over anything left in the web view', async () => {
    preferences.set(STATS, JSON.stringify({ gamesPlayed: 7 }));
    webView.set(STATS, JSON.stringify({ gamesPlayed: 42 }));
    expect((await storage.loadStats()).gamesPlayed).toBe(7);
  });

  it('resets both, so an old web view copy cannot come back after a reset', async () => {
    preferences.set(STATS, JSON.stringify({ gamesPlayed: 7 }));
    webView.set('borderbound:campaign:v1', JSON.stringify({ 1: { moves: 2, seconds: 5, optimal: true } }));
    await storage.resetEverything();
    expect(preferences.size).toBe(0);
    expect(webView.size).toBe(0);
    expect(await storage.loadCampaign()).toEqual({});
  });

  it('keeps using browser storage on the website', async () => {
    native.value = false;
    await storage.saveSettings({ ...storage.DEFAULT_SETTINGS, haptics: false });
    expect(JSON.parse(browserStore.get(SETTINGS)!).haptics).toBe(false);
    expect(preferences.size).toBe(0);
  });
});
