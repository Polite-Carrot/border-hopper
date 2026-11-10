# Unity LevelPlay for iOS (parked)

A Capacitor plugin that serves Border Hopper's iOS interstitials through Unity
LevelPlay 9.7.0 and its Unity Ads adapter 5.13.0, instead of Unity Ads
directly. It answers the same calls as the studio's Unity Ads plugin, so the
studio package's JS client can drive it unchanged.

**It is not wired into the app.** On TestFlight (November 2026), the game
screen went black from the third level on: the point where the app starts
loading its first ad. The cause was never pinned down; the likeliest is the
ad SDKs' memory on top of the game's map. The app went back to Unity Ads
directly.

## Switching it back on

Commit `25fd167` ("iOS ads through Unity LevelPlay") has every change:

- `npm install ./packages/capacitor-levelplay`
- `capacitor.config.ts`: an `ios.includePlugins` list of every plugin except
  `@politecarrot/capacitor-unity-ads`, plus this one. The adapter brings its
  own, newer Unity Ads SDK, and both in one app will not link.
- `src/ads/index.ts`: on iOS, hand `createUnityAds` a bridge whose only plugin
  is `LevelPlay`, with the app key (`28869d645`) as the game ID and the ad unit
  (`8phyx3pjsc71l7iy`) as the placement.
- `-ObjC` in the App target's Other Linker Flags, and ironSource's SKAdNetwork
  ID (`su67r6k2v3.skadnetwork`) in `Info.plist`.
- `npx cap sync`.

Before shipping it again, run it from Xcode on a phone, play past the third
level, and read the console for `[PoliteCarrot LevelPlay]` lines and
`WebView process terminated`.
