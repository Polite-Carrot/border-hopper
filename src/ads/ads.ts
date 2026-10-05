import { Capacitor } from '@capacitor/core';
import { createUnityAds, type UnityAdsClient } from '@politecarrot/capacitor-unity-ads';
import { track } from '../core/analytics';
import { adDue, noteAdShown, noteGameFinished, shouldPrepare, startPacing, type AdPacing } from './policy';

/** Border Hopper's Unity project. Both apps live under one Unity project. */
export const UNITY_CONFIG = {
  ios: { gameId: '800388470', interstitial: 'BP_Interstitial_iOS' },
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
 * The game's side of the studio's Unity Ads package: when ads may show and
 * the consent signals. The package owns the SDK, ATT and playback.
 */
export function createAds(client: Client, clock: () => number = Date.now, onShown?: () => void): Ads {
  let pacing: AdPacing = startPacing(clock());
  let preparing: Promise<boolean> | null = null;
  let showing = false;
  let asking: Promise<string | null> | null = null;

  const platform = () => client.state().platform;
  const isNative = () => platform() === 'ios' || platform() === 'android';

  function prepare(): Promise<boolean> {
    if (!isNative() || showing) return Promise.resolve(false);
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
      if (!isNative()) return;
      try {
        await client.setPersonalized(personalised);
        await client.init();
      } catch (error) {
        warn(error);
      }
    },

    async setPersonalised(on) {
      if (!isNative()) return;
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
      if (!isNative()) return;
      pacing = noteGameFinished(pacing);
      if (shouldPrepare(pacing) && !client.state().prepared.interstitial) void prepare();
    },

    async maybeShowInterstitial() {
      if (!isNative() || showing || !adDue(pacing, clock())) return false;
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

let instance: Ads | null = null;

/** The app's one ads client: Unity's native SDK is a singleton. */
export function getAds(): Ads {
  instance ??= createAds(
    createUnityAds({ ...UNITY_CONFIG, capacitor: Capacitor }),
    Date.now,
    () => track('ad_shown', { format: 'interstitial' })
  );
  return instance;
}
