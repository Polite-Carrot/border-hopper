import type { UnityAdsClient } from '@politecarrot/capacitor-unity-ads';
import { adDue, noteAdShown, noteGameFinished, shouldPrepare, startPacing, type AdPacing } from './policy';

/**
 * The iOS app's ads come through Unity LevelPlay: its app key and interstitial
 * ad unit, from the LevelPlay dashboard. Unity Ads is one of the networks
 * LevelPlay mediates, set up there with the iOS Unity game ID 800388470.
 */
export const LEVELPLAY_CONFIG = {
  ios: { appKey: '28869d645', interstitial: '8phyx3pjsc71l7iy' },
} as const;

/**
 * The Android app still uses Unity Ads directly, until it moves to LevelPlay
 * as well. Both apps live under one Unity project.
 */
export const UNITY_CONFIG = {
  android: { gameId: '800388471', interstitial: 'BP_Interstitial_Android' },
  // Real ads. To see test ads on a phone, register it under Unity Dashboard
  // -> Monetization -> Settings -> Test device instead of changing this.
  testMode: false,
} as const;

export interface Ads {
  /** True inside the iOS or Android app; on the web every call is a no-op. */
  isNative(): boolean;
  platform(): string;
  /** Applies the player's saved choice, then starts the SDK. */
  start(personalised: boolean): Promise<void>;
  setPersonalised(on: boolean): Promise<void>;
  /**
   * The iPhone tracking status, asking the player only if `mayPrompt` and
   * they have never been asked. Null off iOS or if the bridge fails.
   */
  tracking(mayPrompt: boolean): Promise<string | null>;
  noteGameFinished(): void;
  /**
   * Shows an interstitial if one is due and already loaded, and resolves
   * once it has closed. Never waits for an ad to load: if none is ready it
   * starts loading one for next time and resolves straight away.
   */
  maybeShowInterstitial(): Promise<boolean>;
}

type Client = Pick<
  UnityAdsClient,
  'init' | 'setPersonalized' | 'requestTracking' | 'prepareInterstitial' | 'showInterstitial' | 'state'
>;

const warn = (error: unknown) =>
  console.warn('Ads:', (error as { message?: string } | null)?.message ?? error);

/**
 * The game's side of the ads: when they may show and the consent signals.
 * The client owns the SDK, ATT and playback: the studio's Unity Ads package
 * on Android, and the same package's JS driving the LevelPlay plugin on iOS.
 *
 * `adsRemoved` is read on every call, so a Remove Ads purchase takes effect at
 * once and a refund brings ads back, with no restart either way. Someone who
 * owns it at launch never has the ads SDK started at all.
 */
export function createAds(
  client: Client,
  clock: () => number = Date.now,
  onShown?: () => void,
  adsRemoved: () => boolean = () => false
): Ads {
  let pacing: AdPacing = startPacing(clock());
  let preparing: Promise<boolean> | null = null;
  let showing = false;
  let asking: Promise<string | null> | null = null;

  const platform = () => client.state().platform;
  const isNative = () => platform() === 'ios' || platform() === 'android';
  /** Whether ads exist at all here: in the apps, for someone who has not bought them away. */
  const live = () => isNative() && !adsRemoved();

  function prepare(): Promise<boolean> {
    if (!live() || showing) return Promise.resolve(false);
    if (preparing) return preparing;
    preparing = client
      .prepareInterstitial()
      .then((result) => {
        if (!result.loaded) warn(result.reason);
        return result.loaded === true;
      })
      .catch((error) => {
        warn(error);
        return false;
      })
      .finally(() => {
        preparing = null;
      });
    return preparing;
  }

  return {
    isNative,
    platform,

    async start(personalised) {
      if (!live()) return;
      try {
        await client.setPersonalized(personalised);
        await client.init();
      } catch (error) {
        warn(error);
      }
    },

    async setPersonalised(on) {
      if (!live()) return;
      try {
        if (client.state().personalized !== on) await client.setPersonalized(on);
        // A prepared ad was loaded under the old consent and is now void.
        if (client.state().ready && shouldPrepare(pacing)) void prepare();
      } catch (error) {
        warn(error);
      }
    },

    tracking(mayPrompt) {
      if (platform() !== 'ios') return Promise.resolve(null);
      if (asking) return asking;
      asking = (mayPrompt
        ? client.requestTracking()
        : client.init().then(() => client.state().attStatus)
      )
        .catch((error) => {
          warn(error);
          return null;
        })
        .finally(() => {
          asking = null;
        });
      return asking;
    },

    noteGameFinished() {
      if (!live()) return;
      pacing = noteGameFinished(pacing);
      if (shouldPrepare(pacing) && !client.state().prepared.interstitial) void prepare();
    },

    async maybeShowInterstitial() {
      if (!live() || showing || !adDue(pacing, clock())) return false;
      if (!client.state().prepared.interstitial) {
        void prepare();
        return false;
      }
      showing = true;
      try {
        const result = await client.showInterstitial();
        if (!result.shown) {
          warn(result.reason);
          return false;
        }
        pacing = noteAdShown(clock());
        onShown?.();
        return true;
      } catch (error) {
        warn(error);
        return false;
      } finally {
        showing = false;
      }
    },
  };
}
