# Borderbound

A geography game about crossing the world one land border at a time.

You start in one country and you are given another to reach. You can only
travel to a country that shares a land border with the one you are standing
in. Get there in as few moves as you can.

```
France → Spain → Portugal
```

From France, Spain is a legal move. So are Belgium, Germany and Italy.
Portugal is not — it does not border France. Work out the route yourself.

Built with Expo, so iOS, Android and the web all run the same code.

## Quick start

```bash
npm install          # install dependencies
npm start            # Expo dev server (press i, a or w)
npm test             # run the test suite
npm run typecheck    # TypeScript, no emit
```

## Running it

| Target | Command | Notes |
| --- | --- | --- |
| Dev server | `npm start` | Then press `i`, `a` or `w` |
| Web | `npm run web` | Opens in your browser |
| iOS | `npm run ios` | Needs macOS and Xcode |
| Android | `npm run android` | Needs Android Studio or a connected device |

### iOS

Development builds need macOS with Xcode installed.

```bash
npm run ios                          # simulator or connected device
npx expo prebuild --platform ios     # generate the native ios/ project
npx expo run:ios --configuration Release
```

For a release build, open `ios/Borderbound.xcworkspace` in Xcode after
prebuilding, set your signing team, and archive. Or build in the cloud without
a Mac:

```bash
npx eas build --platform ios
```

`ios/` is generated and gitignored; `npx expo prebuild` recreates it from
`app.config.ts` whenever you need it.

### Android

```bash
npm run android                          # emulator or connected device
npx expo prebuild --platform android     # generate the native android/ project
npx expo run:android --variant release
```

For a distributable build:

```bash
cd android && ./gradlew assembleRelease   # APK
cd android && ./gradlew bundleRelease     # AAB for Google Play
```

or `npx eas build --platform android` to build in the cloud.

### Web

```bash
npm run build:web        # static export into dist/
npx serve dist           # serve it locally
```

## Deploying to GitHub Pages

`.github/workflows/deploy-web.yml` builds and publishes on every push to
`main`. To turn it on once:

1. **Settings → Pages → Build and deployment → Source**: choose
   **GitHub Actions**.
2. Push to `main`. The workflow typechecks, tests, builds and deploys.

The site lands at `https://<owner>.github.io/<repo>/`.

### About the base path

GitHub Pages serves project sites from a subpath, not the domain root, so the
bundle needs every asset URL prefixed. The workflow sets
`EXPO_PUBLIC_BASE_URL` to `/<repo>`, which `app.config.ts` feeds into Expo's
`experiments.baseUrl`. Nothing is hard-coded to this repository's name, and
builds without that variable are served from the root.

Two details the workflow handles that are easy to miss:

- `.nojekyll`, without which GitHub Pages' Jekyll step silently drops the
  `_expo/` directory and the page loads blank.
- `404.html`, a copy of `index.html`, so deep links fall back to the app.

To build for Pages by hand:

```bash
EXPO_PUBLIC_BASE_URL=/border-hopper npm run build:web
touch dist/.nojekyll && cp dist/index.html dist/404.html
```

## Testing

```bash
npm test
```

87 tests over the rules, run in plain Node because `src/core` imports nothing
from React Native. They cover country data integrity, known borders and
non-borders, pathfinding, game generation, gameplay transitions, daily
determinism, search, and statistics.

## The country data

Everything geographic is generated:

```bash
npm run build:data       # regenerates src/data/world.generated.json
```

Source: **Natural Earth 1:50m** country polygons via the
[`world-atlas`](https://github.com/topojson/world-atlas) package. Nothing is
drawn by hand and no border is invented.

**Adjacency is derived from the polygons, not typed in.** In a TopoJSON
topology two countries that share a border share an arc, so the adjacency
graph falls out of the geometry exactly. If the map shows a border, the game
agrees it is one.

### Geographic interpretation

A geography game has to take a position on a handful of genuinely ambiguous
cases. These are the positions this one takes.

**Land borders only.** Two countries are neighbours when their territory
touches on land. Sea crossings never count, however short: the United Kingdom
borders only Ireland, Spain does not border Morocco, and Japan borders nobody.
This is the single rule the whole game rests on.

**195 playable countries.** The 193 UN member states, plus the two UN observer
states (Vatican City and Palestine), plus Taiwan. Dependencies, overseas
territories and special areas — Greenland, Puerto Rico, Hong Kong, Gibraltar,
Western Sahara, Antarctica and the rest — are still *drawn* on the map, so the
world has no holes in it, but they are not playable and take no part in the
adjacency graph.

**Unrecognised regions are merged into the state that contains them.** Natural
Earth draws Somaliland, Northern Cyprus and Kosovo separately. Under ISO
3166-1 their territory belongs to Somalia, Cyprus and Serbia, and merging them
keeps the borders that run *through* them intact — without it Somalia would
not border Djibouti. Hong Kong and Macao are merged into China for the same
reason. Siachen Glacier is merged into India.

**Exclaves count.** Russia borders Poland and Lithuania only through
Kaliningrad, and Azerbaijan borders Türkiye only through Nakhchivan. Both are
real land borders and both are in the graph.

**Enclaves count.** Lesotho is surrounded by South Africa, San Marino and
Vatican City by Italy. All are ordinary neighbours.

**Borders that exist only through distant overseas territory are excluded.**
This is the one place where playability wins over completeness, and it is
worth being explicit about. French Guiana is an integral overseas department
of France, so France genuinely borders Brazil and Suriname. Including that
edge merges the Americas and Afro-Eurasia into one landmass, and about a
quarter of all country pairs then route their shortest path through it — and
no player is going to guess "Brazil" while standing in France. The edge is
excluded, which leaves **two mainland components**: the Americas, and
Afro-Eurasia. There is no land route between them, and games are never
generated across them.

**Microstates are playable but never the objective.** Monaco, San Marino,
Liechtenstein, Andorra and Vatican City are legal moves and appear in search,
but are never chosen as a start or destination, where they would make for a
frustrating puzzle.

**Antarctica is omitted.** It has no land borders, and Natural Earth 1
stretches it into a distorted band across the bottom of the map.

**Two known gaps in the source data.** Natural Earth 1:50m does not model
Spain's exclaves at Ceuta and Melilla, so Spain does not border Morocco even
though it does in reality. And simplifying polygons for performance means very
short borders can be approximate — but every border in the graph was derived
before simplification, so what is drawn and what is playable always agree.

## How a game is generated

1. Pick a starting country, weighted so larger and more recognisable countries
   come up more often.
2. Compute BFS distances from it over the land graph.
3. Pick a destination at a distance inside the requested difficulty band.
4. Store the shortest route length for scoring. The player never sees it.

| Difficulty | Moves |
| --- | --- |
| Easy | 2 |
| Medium | 3–4 |
| Hard | 5–7 |

Every generated game is solvable by construction, because the destination is
chosen from countries already known to be reachable. Easy is pinned to exactly
two moves so a game never opens with the destination already next door.

The **daily challenge** is a pure function of the calendar date: the same date
produces the same start and destination for every player on every device, with
no backend. Results are stored locally and a day can only be played once.

## Project layout

See [ARCHITECTURE.md](ARCHITECTURE.md) for the reasoning. In brief:

```
src/core/     Pure TypeScript rules — no React, no React Native
src/data/     Generated country dataset
src/ui/       Map, components and screens
scripts/      Build-time data generation
tests/        Vitest suites against src/core
```

## Licence

Code is MIT (see [LICENSE](LICENSE)). Country geometry comes from
[Natural Earth](https://www.naturalearthdata.com/), which is in the public
domain.
