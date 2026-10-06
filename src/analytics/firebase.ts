import { Capacitor, registerPlugin } from '@capacitor/core';
import type { ConsentStatus, ConsentType, FirebaseAnalyticsPlugin } from '@capacitor-firebase/analytics';
import { setAnalyticsSink } from '../core/analytics';

// Registered here rather than imported from the package: its web fallback
// imports the `firebase` JS SDK, which the Expo web bundle cannot resolve.
const firebase = Capacitor.isNativePlatform()
  ? registerPlugin<FirebaseAnalyticsPlugin>('FirebaseAnalytics')
  : null;

/**
 * Sends events to the app's Firebase project (GoogleService-Info.plist /
 * google-services.json). A no-op on the web.
 */
export function installFirebaseSink(): void {
  if (!firebase) return;
  setAnalyticsSink((name, params) => {
    const clean: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      // Android's Bundle drops booleans, so send them as strings.
      clean[key] = typeof value === 'boolean' ? String(value) : value;
    }
    firebase.logEvent({ name, params: clean }).catch(() => {});
  });
}

/**
 * Mirrors the player's two privacy switches into the native SDK, which starts
 * with collection off (see Info.plist and AndroidManifest.xml).
 */
export async function setFirebaseConsent(analytics: boolean, personalisedAds: boolean): Promise<void> {
  if (!firebase) return;
  const stats = (analytics ? 'GRANTED' : 'DENIED') as ConsentStatus;
  const ads = (analytics && personalisedAds ? 'GRANTED' : 'DENIED') as ConsentStatus;
  try {
    await firebase.setEnabled({ enabled: analytics });
    // One { type, status } per call: the plugin has no batch form.
    await firebase.setConsent({ type: 'ANALYTICS_STORAGE' as ConsentType, status: stats });
    await firebase.setConsent({ type: 'AD_STORAGE' as ConsentType, status: ads });
    await firebase.setConsent({ type: 'AD_USER_DATA' as ConsentType, status: ads });
    await firebase.setConsent({ type: 'AD_PERSONALIZATION' as ConsentType, status: ads });
  } catch {
    // Analytics is never worth a crash.
  }
}
