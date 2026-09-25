import type { ExpoConfig } from 'expo/config';

/**
 * GitHub Pages serves a project site from `https://<user>.github.io/<repo>/`,
 * so the web build needs every asset path prefixed with that subpath. The
 * deploy workflow sets `EXPO_PUBLIC_BASE_URL`; local builds leave it empty and
 * are served from the root.
 */
const baseUrl = process.env.EXPO_PUBLIC_BASE_URL ?? '';

const config: ExpoConfig = {
  name: 'Border Hopper',
  slug: 'border-hopper',
  scheme: 'borderhopper',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#050A12',
  primaryColor: '#3DBDF8',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.borderhopper.game',
    userInterfaceStyle: 'dark',
  },
  android: {
    package: 'com.borderhopper.game',
    userInterfaceStyle: 'dark',
    adaptiveIcon: {
      backgroundColor: '#050A12',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
    // A single-page app: there is no router, just one entry point.
    output: 'single',
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        // Black, to match the startup screen that follows it rather than the
        // menu that follows that. Otherwise launching the app on a phone
        // changes background colour twice before anything is playable.
        backgroundColor: '#000000',
        imageWidth: 220,
      },
    ],
  ],
  experiments: {
    baseUrl,
  },
};

export default config;
