/**
 * For the website's GitHub Actions build only: removes dependencies that come
 * from the studio's private repositories, which that build cannot download,
 * from package.json and package-lock.json, so `npm ci` installs the rest.
 *
 * The website never uses them -- ads only exist in the iOS and Android apps --
 * and src/ads/unity-unavailable stands in for them. The workflow never
 * commits these two files, so the change only lives for that one build.
 *
 *   node scripts/drop-private-deps.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PRIVATE = ['@politecarrot/capacitor-unity-ads'];

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

for (const name of PRIVATE) {
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    delete pkg[field]?.[name];
    delete lock.packages?.['']?.[field]?.[name];
  }
  delete lock.packages?.[`node_modules/${name}`];
  console.log(`Left out ${name} (private; the website build uses a stand-in)`);
}

writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
writeFileSync('package-lock.json', `${JSON.stringify(lock, null, 2)}\n`);
