/**
 * Captures the App Store screenshots in store/screenshots/ from the web build.
 *
 * Needs Playwright with Chromium, and the web build served somewhere:
 *
 *   npm run build:web && npx serve -l 8316 dist      # in one terminal
 *   npm i --no-save playwright && npx playwright install chromium
 *   node scripts/store-screenshots.mjs              # in another
 *
 * Optional: STORE_URL (default http://localhost:8316/), CHROMIUM_PATH for a
 * Chromium already on the machine, ONLY=iphone-6.9,ipad-13 for some devices.
 *
 * Every scene starts from the same seeded save, so the shots are repeatable:
 * campaign at level 29, 49 passport stamps, wearing Brazil's flag.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL = process.env.STORE_URL ?? 'http://localhost:8316/';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../store/screenshots');

/** App Store sizes: iPhone 6.9" (1320x2868) and iPad 13" (2064x2752). */
const DEVICES = {
  'iphone-6.9': { viewport: { width: 440, height: 956 }, scale: 3, insets: { top: 62, bottom: 34, left: 0, right: 0 } },
  'ipad-13': { viewport: { width: 1032, height: 1376 }, scale: 2, insets: { top: 24, bottom: 20, left: 0, right: 0 } },
  'ipad-13-landscape': { viewport: { width: 1376, height: 1032 }, scale: 2, insets: { top: 24, bottom: 20, left: 0, right: 0 } },
};
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const day = (n) => `2026-0${n < 10 ? '9-0' + n : '9-' + n}`;
const STAMPS = [
  'RU', 'PL', 'FR', 'DE', 'ES', 'PT', 'GB', 'IE', 'NL', 'BE', 'CH', 'NO', 'SE', 'FI', 'DK', 'GR', 'HR', 'HU', 'RO', 'UA',
  'JP', 'CN', 'IN', 'TR', 'TH', 'VN', 'KR', 'ID', 'MN', 'KZ',
  'EG', 'MA', 'KE', 'ZA', 'NG', 'TZ',
  'US', 'CA', 'MX', 'CU', 'GT',
  'BR', 'AR', 'CL', 'PE', 'CO',
  'AU', 'NZ', 'FJ',
];
const passport = { stamps: Object.fromEntries(STAMPS.map((iso, i) => [iso, day((i % 28) + 1)])), skin: 'BR' };
const campaign = Object.fromEntries(
  Array.from({ length: 28 }, (_, i) => [i + 1, { moves: 3, seconds: 40 + i, optimal: i % 3 !== 1 }])
);
const stats = {
  gamesPlayed: 64, gamesCompleted: 59, currentStreak: 7, longestStreak: 12, totalMoves: 230, totalWrongGuesses: 21,
  totalSeconds: 3100, bestSeconds: 9, optimalCompletions: 41, dailyStreak: 6, longestDailyStreak: 9, lastDailyKey: null,
};

async function scene(device, name, run, { seedRandom } = {}) {
  const spec = DEVICES[device];
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const context = await browser.newContext({
    viewport: spec.viewport, deviceScaleFactor: spec.scale, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: spec.insets });
  await page.addInitScript(({ passport, campaign, stats, seedRandom }) => {
    localStorage.clear();
    localStorage.setItem('borderbound:onboarded:v1', '1');
    localStorage.setItem('borderbound:consent-asked:v1', '1');
    localStorage.setItem('borderbound:settings:v1', JSON.stringify({
      difficulty: 'medium', sound: false, haptics: true, reduceMotion: false, analytics: false, personalisedAds: false,
    }));
    localStorage.setItem('borderbound:passport:v1', JSON.stringify(passport));
    localStorage.setItem('borderbound:campaign:v1', JSON.stringify(campaign));
    localStorage.setItem('borderbound:stats:v1', JSON.stringify(stats));
    if (seedRandom) {
      let a = seedRandom;
      Math.random = () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
  }, { passport, campaign, stats, seedRandom });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3900);
  const shot = async (file) => {
    mkdirSync(`${OUT}/${device}`, { recursive: true });
    await page.screenshot({ path: `${OUT}/${device}/${file}.png` });
  };
  const travel = async (country, wait = 1900) => {
    await page.keyboard.type(country, { delay: 10 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(wait);
  };
  const openLevel29 = async () => {
    await page.getByText(/^Campaign/).first().click();
    await page.waitForTimeout(900);
    await page.getByLabel(/^Level 29,/).click();
    await page.waitForTimeout(3600);
  };
  await run({ page, shot, travel, openLevel29 });
  console.log(device, name, errors.length ? errors : 'ok');
  await browser.close();
}

for (const device of Object.keys(DEVICES).filter((d) => !ONLY || ONLY.includes(d))) {
  await scene(device, 'menu', async ({ shot }) => shot('menu'));

  await scene(device, 'gameplay + result', async ({ page, shot, travel, openLevel29 }) => {
    await openLevel29();
    await shot('level-start');
    await travel('Poland');
    await travel('Czechia');
    await shot('gameplay');
    // Mid-hop, near the top of the jump.
    await travel('Austria', 190);
    await shot('gameplay-hop');
    await page.waitForTimeout(1700);
    await travel('Italy', 3200);
    await shot('result');
  });

  await scene(device, 'world zoom', async ({ page, shot, travel, openLevel29 }) => {
    await openLevel29();
    await travel('Poland');
    for (let i = 0; i < 8; i++) {
      if ((await page.getByLabel('Zoom out').getAttribute('aria-disabled')) === 'true') break;
      await page.getByLabel('Zoom out').click();
      await page.waitForTimeout(450);
    }
    await shot('world-zoomed-out');
  });

  await scene(device, 'flight', async ({ page, shot }) => {
    await page.getByText(/^Flight mode/).first().click();
    await page.waitForTimeout(1000);
    await shot('flight-picker');
    await page.getByText(/^Take off/).first().click();
    await page.waitForTimeout(4200);
    await shot('flight-departures');
    // Take the longest flight on the departures board and catch him in the air.
    const chips = page.getByRole('button').filter({ hasText: /\d[\d,]* km/ });
    const count = await chips.count();
    let best = null, bestKm = -1;
    for (let i = 0; i < count; i++) {
      const text = (await chips.nth(i).textContent()) ?? '';
      const km = Number(text.match(/([\d,]+)\s*km/)?.[1].replace(/,/g, '') ?? 0);
      if (km > bestKm) { bestKm = km; best = chips.nth(i); }
    }
    if (best) {
      await best.click();
      await page.waitForTimeout(560);
      await shot('flight-in-the-air');
    }
  }, { seedRandom: 1207 });

  await scene(device, 'passport', async ({ page, shot }) => {
    await page.getByText(/^Passport/).first().click();
    await page.waitForTimeout(1200);
    await shot('passport');
  });

  await scene(device, 'campaign', async ({ page, shot }) => {
    await page.getByText(/^Campaign/).first().click();
    await page.waitForTimeout(1200);
    await shot('campaign');
  });
}
