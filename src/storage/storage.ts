import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_STATS, type Stats } from '../core/stats';
import type { GameResult } from '../core/types';
import type { CampaignProgress } from '../core/campaign';

/**
 * Local persistence. Everything the game remembers lives on the device; there
 * is no account and no backend.
 */
/**
 * Storage keys keep the game's original name on purpose: renaming them would
 * orphan the stats, settings and daily results already on players' devices.
 */
const KEYS = {
  stats: 'borderbound:stats:v1',
  dailyResults: 'borderbound:daily:v1',
  settings: 'borderbound:settings:v1',
  onboarded: 'borderbound:onboarded:v1',
  campaign: 'borderbound:campaign:v1',
} as const;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A failed write only costs history, never the game in progress.
  }
}

export const loadStats = (): Promise<Stats> => readJson<Stats>(KEYS.stats, EMPTY_STATS);
export const saveStats = (stats: Stats): Promise<void> => writeJson(KEYS.stats, stats);

/** Finished daily challenges, keyed by date, so a day can only be played once. */
export type DailyResults = Record<string, GameResult>;
export const loadDailyResults = (): Promise<DailyResults> => readJson<DailyResults>(KEYS.dailyResults, {});
export const saveDailyResults = (results: DailyResults): Promise<void> => writeJson(KEYS.dailyResults, results);

export interface Settings {
  /** 'mixed' lets the game choose a difficulty each round. */
  difficulty: 'mixed' | 'easy' | 'medium' | 'hard';
  sound: boolean;
  haptics: boolean;
  reduceMotion: boolean;
  /**
   * Consent, both off until the player turns them on, and both the only
   * authority on the matter: anything that ever reports usage or asks for a
   * personalised ad has to read these first.
   *
   * Nothing in this build does either yet. They are stored now so the answer
   * is already recorded, and already "no", on the day something does.
   */
  analytics: boolean;
  personalisedAds: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: 'mixed',
  sound: false,
  haptics: true,
  reduceMotion: false,
  // Off is the only safe default for consent, and the only honest one: a
  // player who has never been asked has not agreed.
  analytics: false,
  personalisedAds: false,
};

export const loadSettings = (): Promise<Settings> => readJson<Settings>(KEYS.settings, DEFAULT_SETTINGS);
export const saveSettings = (settings: Settings): Promise<void> => writeJson(KEYS.settings, settings);

export async function loadOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEYS.onboarded)) === '1';
  } catch {
    return false;
  }
}

export async function saveOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.onboarded, '1');
  } catch {
    // Worst case the player sees the three-line intro twice.
  }
}

/** Campaign progress: the best result for each level the player has finished. */
export const loadCampaign = (): Promise<CampaignProgress> => readJson<CampaignProgress>(KEYS.campaign, {});
export const saveCampaign = (progress: CampaignProgress): Promise<void> => writeJson(KEYS.campaign, progress);

export async function resetEverything(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  } catch {
    // Nothing to do; the UI reloads from whatever survived.
  }
}
