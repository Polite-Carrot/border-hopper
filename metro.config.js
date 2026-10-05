const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The studio's Unity Ads package comes from a private repository. Anywhere it
// is installed -- every machine that builds the iOS and Android apps -- it
// resolves as normal. Only when it is missing, which is the website's GitHub
// Actions build, does Metro fall back to a no-op stand-in instead of failing;
// the website never shows ads anyway.
//
// A real fallback, tried only after normal resolution fails. Neither
// `extraNodeModules` nor a tsconfig `paths` alias will do: Metro consults both
// before node_modules, so either would swap out the real package everywhere.
const UNITY_ADS = '@politecarrot/capacitor-unity-ads';
const STAND_IN = path.resolve(__dirname, 'src/ads/unity-unavailable/index.ts');
const upstream = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstream ?? context.resolveRequest;
  try {
    return resolve(context, moduleName, platform);
  } catch (error) {
    if (moduleName === UNITY_ADS) return { type: 'sourceFile', filePath: STAND_IN };
    throw error;
  }
};

module.exports = config;
