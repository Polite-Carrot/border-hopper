/**
 * Post-processes the Expo web export for publishing.
 *
 * Expo emits a favicon and nothing else, so a browser has no icon to use when
 * someone adds the game to their home screen -- iOS falls back to a screenshot
 * of the page. This copies the app icons in, writes a web manifest, and links
 * both from the page.
 *
 * Run with: node scripts/finish-web-build.mjs [outputDir]
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const root = resolve(HERE, '..');
const out = resolve(root, process.argv[2] ?? 'dist');
const base = process.env.EXPO_PUBLIC_BASE_URL ?? '';

const ICONS = ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

mkdirSync(join(out, 'icons'), { recursive: true });
for (const icon of ICONS) {
  copyFileSync(join(root, 'assets/web', icon), join(out, 'icons', icon));
}

const manifest = {
  name: 'Border Hopper',
  short_name: 'Border Hopper',
  description: 'A geography game about crossing the world one land border at a time',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  orientation: 'any',
  background_color: '#050A12',
  theme_color: '#050A12',
  icons: [
    { src: `${base}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${base}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: `${base}/icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync(join(out, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);

const head = [
  // Painted before a single line of JavaScript runs. Without it the browser
  // shows its default white page until React mounts, which on a slow phone is
  // a white flash directly in front of a black startup screen -- exactly the
  // thing the startup screen exists to prevent. Black rather than the app's
  // own background, so the first paint already matches the splash.
  `<style>html,body,#root{background-color:#000;}</style>`,
  `<link rel="apple-touch-icon" href="${base}/icons/apple-touch-icon.png"/>`,
  `<link rel="manifest" href="${base}/manifest.webmanifest"/>`,
  // The browser's own chrome while the app loads, so it matches the splash
  // rather than the menu that comes after it.
  `<meta name="theme-color" content="#000000"/>`,
  `<meta name="apple-mobile-web-app-title" content="Border Hopper"/>`,
].join('\n    ');

for (const page of ['index.html', '404.html']) {
  const path = join(out, page);
  let html;
  try {
    html = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  if (html.includes('rel="manifest"')) continue;
  writeFileSync(path, html.replace('</head>', `  ${head}\n  </head>`));
}

console.log(`Added ${ICONS.length} icons, a manifest and their links to ${out}`);
