import { Capacitor } from '@capacitor/core';
import { createUnityAds } from '@politecarrot/capacitor-unity-ads';
import { track } from '../core/analytics';
import { UNITY_CONFIG, createAds, type Ads } from './ads';

let instance: Ads | null = null;

/**
 * The app's one ads client: Unity's native SDK is a singleton.
 *
 * Kept apart from ads.ts so the tests never load the Unity package, which
 * only some machines can install (see src/ads/unity-unavailable).
 */
export function getAds(): Ads {
  instance ??= createAds(
    createUnityAds({ ...UNITY_CONFIG, capacitor: Capacitor }),
    Date.now,
    () => track('ad_shown', { format: 'interstitial' })
  );
  return instance;
}
