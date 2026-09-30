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
    contentInset: 'never',
    backgroundColor: '#000000',
  },
  android: {
    backgroundColor: '#000000',
  },
};

export default config;
