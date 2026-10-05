/**
 * Stands in for `@politecarrot/capacitor-unity-ads` where it is not
 * installed: the GitHub Actions build of the website, which cannot read the
 * studio's private repository and has no ads to show anyway.
 *
 * Wired in as a fallback only (metro.config.js), so any
 * machine that has the real package -- every iOS and Android build -- uses it.
 * Behaves exactly like the real package does in a browser: platform "web",
 * and every call a no-op.
 */
import type { AdsOptions, UnityAdsClient } from '@politecarrot/capacitor-unity-ads';

const unavailable = { loaded: false, reason: 'unavailable' };
const notShown = { shown: false, rewarded: false, reason: 'unavailable' };

export function createUnityAds(_options?: AdsOptions): UnityAdsClient {
  return {
    init: async () => false,
    setPersonalized: async () => {},
    requestTracking: async () => 'notApplicable',
    prepareInterstitial: async () => unavailable,
    prepareRewarded: async () => unavailable,
    showInterstitial: async () => notShown,
    showRewarded: async () => notShown,
    state: () => ({
      platform: 'web', ready: false, showing: false, personalized: false, attStatus: null,
      effectivePersonalized: false, prepared: { interstitial: false, rewarded: false },
    }),
  };
}
