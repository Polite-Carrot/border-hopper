import { Capacitor, registerPlugin } from '@capacitor/core';
import { createUnityAds } from '@politecarrot/capacitor-unity-ads';
import { track } from '../core/analytics';
import { getPurchases } from '../purchases';
import { LEVELPLAY_CONFIG, UNITY_CONFIG, createAds, type Ads } from './ads';

let instance: Ads | null = null;

/**
 * The ads client for this platform.
 *
 * iOS: Unity LevelPlay, through the app's own plugin in
 * packages/capacitor-levelplay. That plugin answers exactly the calls the
 * studio's Unity Ads plugin does, so the studio package's JS client -- consent
 * syncing, ATT, load deadlines -- drives it unchanged: it is handed a bridge
 * whose only plugin is "LevelPlay", the app key in place of a game ID and the
 * ad unit in place of a placement.
 *
 * Android: Unity Ads directly, as before.
 */
function client() {
  if (Capacitor.getPlatform() === 'ios') {
    const levelPlay = {
      isNativePlatform: () => Capacitor.isNativePlatform(),
      getPlatform: () => Capacitor.getPlatform(),
      registerPlugin: () => registerPlugin('LevelPlay'),
    };
    return createUnityAds({
      ios: { gameId: LEVELPLAY_CONFIG.ios.appKey, interstitial: LEVELPLAY_CONFIG.ios.interstitial },
      testMode: false,
      capacitor: levelPlay,
    });
  }
  return createUnityAds({ ...UNITY_CONFIG, capacitor: Capacitor });
}

/**
 * The app's one ads client: the native SDKs are singletons.
 *
 * Kept apart from ads.ts so the tests never load the Unity package, which
 * only some machines can install (see src/ads/unity-unavailable).
 */
export function getAds(): Ads {
  instance ??= createAds(
    client(),
    Date.now,
    () => track('ad_shown', { format: 'interstitial' }),
    () => getPurchases().adsRemoved()
  );
  return instance;
}
