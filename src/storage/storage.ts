import { store } from './backend';
import { EMPTY_STATS, type Stats } from '../core/stats';
import type { GameResult } from '../core/types';
import type { CampaignProgress } from '../core/campaign';
import { backfillPassport, type Passport } from '../core/passport';

/**
 * Local persistence. Everything the game remembers lives on the device; there
 * is no account and no backend. In the iOS and Android apps that means the
 * phone's own storage, not the web view's (see `backend.ts`).
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
  consentAsked: 'borderbound:consent-asked:v1',
  campaign: 'borderbound:campaign:v1',
  passport: 'borderbound:passport:v1',
} as const;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await store().getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await store().setItem(key, JSON.stringify(value));
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
  // On now that there is something to hear. Quiet, and only ever a hop and
  // a jingle, so a new player meets it rather than having to find it.
  sound: true,
  haptics: true,
  reduceMotion: false,
  // Off is the only safe default for consent, and the only honest one: a
  // player who has never been asked has not agreed.
  analytics: false,
  personalisedAds: false,
};

export const loadSettings = (): Promise<Settings> => readJson<Settings>(KEYS.settings, DEFAULT_SETTINGS);
export const saveSettings = (settings: Settings): Promise<void> => writeJson(KEYS.settings, settings);

/**
 * Whether the player has been shown the consent card. Separate from
 * `onboarded` because they answer different questions: one is "have they been
 * taught the game", the other is "have they been asked". Sharing a key would
 * mean a later change to the intro silently re-asked for consent, or worse,
 * that adding the card left existing players never asked at all.
 */
export async function loadConsentAsked(): Promise<boolean> {
  try {
    return (await store().getItem(KEYS.consentAsked)) === '1';
  } catch {
    return false;
  }
}

export async function saveConsentAsked(): Promise<void> {
  try {
    await store().setItem(KEYS.consentAsked, '1');
  } catch {
    // Worst case the card comes back next launch, with the answer unchanged.
  }
}

export async function loadOnboarded(): Promise<boolean> {
  try {
    return (await store().getItem(KEYS.onboarded)) === '1';
  } catch {
    return false;
  }
}

export async function saveOnboarded(): Promise<void> {
  try {
    await store().setItem(KEYS.onboarded, '1');
  } catch {
    // Worst case the player sees the three-line intro twice.
  }
}

/** Campaign progress: the best result for each level the player has finished. */
export const loadCampaign = (): Promise<CampaignProgress> => readJson<CampaignProgress>(KEYS.campaign, {});
export const saveCampaign = (progress: CampaignProgress): Promise<void> => writeJson(KEYS.campaign, progress);

/**
 * The passport. The first time it is loaded on a device that has been playing
 * since before passports existed, it is filled in from the daily results and
 * campaign progress already saved, so nobody opens it to find it empty.
 */
export async function loadPassport(today: string): Promise<Passport> {
  try {
    const raw = await store().getItem(KEYS.passport);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Passport>;
      return { stamps: saved.stamps ?? {}, skin: saved.skin ?? null };
    }
  } catch {
    // Unreadable: rebuild it from history below, which is better than empty.
  }
  const passport = backfillPassport(await loadDailyResults(), await loadCampaign(), today);
  await savePassport(passport);
  return passport;
}
export const savePassport = (passport: Passport): Promise<void> => writeJson(KEYS.passport, passport);

export async function resetEverything(): Promise<void> {
  try {
    await store().multiRemove(Object.values(KEYS));
  } catch {
    // Nothing to do; the UI reloads from whatever survived.
  }
}
