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
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

/**
 * A file's URL with a fingerprint of its contents on the end. Browsers --
 * Safari above all -- keep favicons and home-screen icons for a very long
 * time, well past a refresh, so a new icon at the same address can go unseen
 * for weeks. A changed icon gets a changed address and is fetched afresh; an
 * unchanged one keeps its address and stays cached.
 */
function versioned(path) {
  const file = join(out, path.replace(/^\//, ''));
  if (!existsSync(file)) return `${base}${path}`;
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10);
  return `${base}${path}?v=${hash}`;
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
    { src: versioned('/icons/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: versioned('/icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: versioned('/icons/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync(join(out, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);

const head = [
  // Painted before a single line of JavaScript runs. Without it the browser
  // shows its default white page until React mounts, which on a slow phone is
  // a white flash directly in front of a black startup screen -- exactly the
  // thing the startup screen exists to prevent. Black rather than the app's
  // own background, so the first paint already matches the splash.
  `<style>html,body,#root{background-color:#000;overscroll-behavior:none;}*{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important;}</style>`,
  // No selecting, copying or long-press menus anywhere: the game has no text worth copying.
  `<script>['copy','cut','selectstart','contextmenu','dragstart'].forEach(function(t){document.addEventListener(t,function(e){e.preventDefault()},{capture:true})})</script>`,
  `<link rel="apple-touch-icon" href="${versioned('/icons/apple-touch-icon.png')}"/>`,
  // A sharp PNG alongside Expo's 16/32px favicon.ico, for the browsers and
  // high-density screens that would otherwise scale the tiny one up.
  `<link rel="icon" type="image/png" sizes="192x192" href="${versioned('/icons/icon-192.png')}"/>`,
  `<link rel="manifest" href="${versioned('/manifest.webmanifest')}"/>`,
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
  // viewport-fit=cover lets the page reach the screen edges on a notched
  // iPhone *and* makes env(safe-area-inset-*) report the real insets. The app
  // positions its HUD from those insets, so without this the iOS app -- whose
  // WebView draws behind the status bar -- would be told the insets are zero
  // and put the back button underneath the Dynamic Island.
  html = html.replace(
    /<meta name="viewport" content="([^"]*)"/,
    (tag, content) => (content.includes('viewport-fit') ? tag : `<meta name="viewport" content="${content}, viewport-fit=cover"`)
  );
  // Expo writes the favicon link itself; give it a fingerprint too.
  html = html.replace(`href="${base}/favicon.ico"`, `href="${versioned('/favicon.ico')}"`);
  if (!html.includes('rel="manifest"')) html = html.replace('</head>', `  ${head}\n  </head>`);
  writeFileSync(path, html);
}

console.log(`Added ${ICONS.length} icons, a manifest and their links to ${out}`);
