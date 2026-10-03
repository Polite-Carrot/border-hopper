/**
 * Writes src/data/flags.generated.json: the flag of every playable country as
 * a small SVG string, for the explorer's jumper.
 *
 * Bundled rather than loaded as files so a skin is there the instant it is
 * chosen, offline, in the browser and in the apps alike. The set comes from
 * `country-flag-icons`, whose flags are simplified enough to read on a jumper
 * 36 pixels tall, and is about 110KB for all of them.
 *
 *   npm run build:flags
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import world from '../src/data/world.generated.json' with { type: 'json' };

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/flags.generated.json');
const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve('country-flag-icons/package.json'));

const flags: Record<string, string> = {};
for (const { iso2 } of world.countries) {
  flags[iso2] = readFileSync(resolve(pkg, '3x2', `${iso2}.svg`), 'utf8').trim();
}

const license = readFileSync(resolve(pkg, 'LICENSE'), 'utf8').split('\n').find((line) => line.startsWith('Copyright'));
writeFileSync(
  OUT,
  `${JSON.stringify({ source: 'country-flag-icons (MIT)', license, flags }, null, 0)}\n`
);
console.log(`wrote ${Object.keys(flags).length} flags to ${OUT}`);
