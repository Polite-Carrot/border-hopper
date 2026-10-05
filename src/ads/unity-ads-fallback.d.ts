/**
 * Types for `@politecarrot/capacitor-unity-ads` where the package is not
 * installed: the website's GitHub Actions build, which cannot read the
 * studio's private repository (see src/ads/unity-unavailable).
 *
 * TypeScript only falls back to an ambient declaration like this when it
 * cannot find the real module, so anywhere the package is installed its own
 * types win. Mirrors the package's js/index.d.ts.
 */
declare module '@politecarrot/capacitor-unity-ads' {
  export interface PlatformConfig {
    gameId: string;
    interstitial?: string;
    rewarded?: string;
  }
  export interface AdsOptions {
    ios?: PlatformConfig;
    android?: PlatformConfig;
    testMode?: boolean;
    timeoutMs?: number;
    capacitor?: any;
  }
  export interface LoadResult { loaded: boolean; reason?: string; code?: string | number }
  export interface ShowResult {
    shown: boolean;
    rewarded: boolean;
    finishState?: 'completed' | 'skipped';
    reason?: string;
    code?: string | number;
  }
  export interface UnityAdsClient {
    init(): Promise<boolean>;
    setPersonalized(value: boolean): Promise<void>;
    requestTracking(): Promise<string>;
    prepareInterstitial(): Promise<LoadResult>;
    prepareRewarded(): Promise<LoadResult>;
    showInterstitial(): Promise<ShowResult>;
    showRewarded(): Promise<ShowResult>;
    state(): {
      platform: string; ready: boolean; showing: boolean; personalized: boolean;
      attStatus: string | null; effectivePersonalized: boolean;
      prepared: { interstitial: boolean; rewarded: boolean };
    };
  }
  export function createUnityAds(options?: AdsOptions): UnityAdsClient;
}
