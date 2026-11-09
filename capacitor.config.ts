import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The native wrapper.
 *
 * `webDir` is the Expo web export, so the iOS and Android apps run the same
 * build the site does. Rebuild it before syncing -- `npm run sync:native` does
 * both in the right order -- because `cap sync` copies whatever is in `dist/`
 * without checking how old it is.
 *
 * The app id matches the studio's other games and `app.config.ts`; all three
 * have to agree or the stores, Unity and Firebase end up pointing at different
 * apps.
 */
const config: CapacitorConfig = {
  appId: 'com.politecarrot.borderhopper',
  appName: 'Border Hopper',
  webDir: 'dist',
  // The splash the player sees is drawn by the game itself (see BootScreen),
  // so the native window underneath it only has to be the same black.
  backgroundColor: '#000000',
  ios: {
    // Every plugin except the studio's Unity Ads one: the iOS app's ads come
    // through Unity LevelPlay instead (packages/capacitor-levelplay), whose
    // Unity Ads adapter brings its own, newer copy of the Unity Ads SDK. Both
    // in one app would not link. A plugin added to package.json has to be
    // added here too, or iOS leaves it out. Android takes every plugin but
    // LevelPlay, which has no Android side yet.
    includePlugins: [
      '@capacitor-firebase/analytics',
      '@capacitor/haptics',
      '@capacitor/local-notifications',
      '@capacitor/preferences',
      '@capgo/native-purchases',
      '@politecarrot/capacitor-levelplay',
    ],
    contentInset: 'never',
    backgroundColor: '#000000',
    // The game never scrolls the page; without this, drags rubber-band the whole WebView.
    scrollEnabled: false,
  },
  android: {
    backgroundColor: '#000000',
  },
};

export default config;
