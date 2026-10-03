# Border Hopper

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

For a release build, open `ios/BorderHopper.xcworkspace` in Xcode after
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

## The iOS and Android apps

Capacitor, matching the studio's other games. `ios/` and `android/` are real
projects and are **committed**, because the files that carry consent are
hand-edited and belong in version control:

| | iOS | Android |
| --- | --- | --- |
| Project | `ios/App/` (Xcode) | `android/` (Gradle) |
| Identity | `com.politecarrot.borderhopper` | `com.politecarrot.borderhopper` |
| Consent config | `App/Info.plist` | `app/src/main/AndroidManifest.xml` |

Both declare analytics collection **off at build time**, so nothing can leave
before the player has answered the consent card; the analytics sink turns it on
after they say yes. Neither uses the `..._DEACTIVATED` form of that flag, which
is permanent and makes runtime `setEnabled` calls silently do nothing. iOS also
carries the `NSUserTrackingUsageDescription` string for Apple's tracking
prompt.

```bash
npm run sync:native     # rebuild the web export, then copy it into both apps
npm run open:ios        # Xcode
npm run open:android    # Android Studio
```

`cap sync` copies whatever is in `dist/` without checking how old it is, which
is why `sync:native` rebuilds first. The copied assets
(`ios/App/App/public/`, `android/app/src/main/assets/public/`) are generated
and ignored.

The apps run the same web export the site does, so what ships on a phone is the
build the browser tests cover.

## Deploying to GitHub Pages

Already set up, and it needs nothing configured in the repository settings.

GitHub Pages for this repository publishes the **root of `main`** directly.
So `.github/workflows/publish-web.yml` rebuilds the game on every push to
`main` and commits the result — `index.html`, `404.html`, `.nojekyll` and
`_expo/` — back to that root, which is what Pages then serves. Push code, and
the live site follows a minute later.

The site is at <https://borderhopper.politecarrot.com>.

That means the built bundle is committed to the repository. That is the price
of publishing from a branch rather than from a build artifact, and it is why
`_expo/` is wiped before each copy: bundle filenames are content-hashed, so
old ones would otherwise pile up forever.

If you would rather not commit build output, switch **Settings → Pages →
Source** to **GitHub Actions** and change the workflow's last two steps to
`actions/upload-pages-artifact` and `actions/deploy-pages`. Everything else,
including the base path handling below, stays as it is.

### About the base path

Where the site lives decides how asset URLs have to be written, so the
workflow works it out rather than hard-coding it:

- **Custom domain** (a `CNAME` file in the repo root) — served from the root
  of that domain, so the base path is empty. This repository has one.
- **No custom domain** — Pages serves a project site from
  `https://<owner>.github.io/<repo>/`, so every asset URL needs that prefix.

Either way the value goes into `EXPO_PUBLIC_BASE_URL`, which `app.config.ts`
feeds to Expo's `experiments.baseUrl`. Nothing is hard-coded to this
repository's name or domain; delete the `CNAME` and the next build switches
back to the project-site path on its own.

Two details that are easy to miss, both handled by the workflow:

- `.nojekyll`, without which Pages runs the root through Jekyll — which
  renders `README.md` as the home page and drops the `_expo/` directory for
  starting with an underscore.
- `404.html`, a copy of `index.html`, so deep links fall back to the app.

To reproduce the published root by hand:

```bash
npm run build:web       # or EXPO_PUBLIC_BASE_URL=/border-hopper for a project site
rm -rf _expo icons && cp -R dist/. . && rm -rf dist
touch .nojekyll && cp index.html 404.html
```

`npm run build:web` also runs `scripts/finish-web-build.mjs`, which adds the
home-screen icons and a web manifest. Expo's export ships only a favicon, so
without it iOS uses a screenshot of the page as the icon when someone adds the
game to their home screen.

## The map

The camera frames the country you are in and animates to the next one; that
animation is a single group transform, so travelling costs one prop update per
frame however much of the world is on screen.

You can drag and pinch it yourself at any time, and **the map wraps**: keep
dragging west past Alaska and you arrive in Russia, round and round without
ever reaching an edge. The renderer draws the canvas three times side by side
and folds the pan offset back inside one canvas width, so the offset never
grows no matter how long you drag. Vertical drag has no wrap — there is
nothing north of the north pole — so it is bounded instead, with the allowance
growing as you zoom in.

This is why the map is equirectangular rather than the better-looking Natural
Earth 1: only a cylindrical projection repeats cleanly. See "The country data"
below for what that costs.

The recentre button appears as soon as you move the map, and travelling puts
the camera back in charge.

### The traveller

A little explorer in a safari hat stands on the country you are in and
**hops** to each new one -- a quick jump over a border, a long high arc for a
flight -- squashing as he lands, with his shadow left on the ground below. He
stands on dry land in every country, including the ones whose middle is sea,
like Japan and Indonesia. With reduce motion on, he simply appears in the next
country.

## Sound

Two sounds, both synthesised with Web Audio rather than shipped as files, the
way the studio's other games do it: a soft upward **hop** at every border
crossed, and a two-second **jingle** on arrival — four notes hopping up a C
major arpeggio, a lift through F and A, a landing on high C over a I–IV–V–I
bass. The hop bends up the same fourth the jingle opens with, so the two sound
like one game. Everything is written down in `src/audio/synth.ts`.

It's quiet by design: measured by rendering the real synth offline, the jingle
peaks at -12.8 dBFS and the hop at -14.1, against the near-0 most game audio
is mastered to. One constant, `VOLUME` in `src/audio/sounds.ts`, if that's
wrong. The audio session is set to "ambient", so it mixes with whatever is
already playing — a podcast keeps going — and follows the iPhone's silent
switch.

Buttons and wrong guesses stay silent on purpose: a click on every tap and a
buzz on every mistake is the fastest way to get sound switched off, and
haptics already cover mistakes.

## The keyboard

The game draws its own keyboard instead of using the platform's, so that its
height is known before it appears. The search field can then sit exactly on
the keyboard's top edge, with the country list filling the space the keyboard
will later occupy -- opening it swaps the list for the keys and moves nothing
else. Typing offers the top three matches above the keys, and hardware
keyboards work on the web for desktop players. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the trade-offs.

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

**Land borders only** — outside flight mode. Two countries are neighbours when
their territory touches on land. Sea crossings never count, however short: the United Kingdom
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

**Antarctica is omitted.** It has no land borders, and an equirectangular
projection stretches it into a distorted band across the bottom of the map.

**The map is equirectangular, so the far north is stretched.** Greenland and
northern Russia are wider than they should be. That is the cost of a map that
wraps: only a cylindrical projection repeats cleanly, and being able to keep
scrolling west into Asia was judged worth more than accurate shapes at 70
degrees north. Every distance, area and adjacency in the game is computed on
the sphere before projection, so nothing the game *decides* is affected.

**Two known gaps in the source data.** Natural Earth 1:50m does not model
Spain's exclaves at Ceuta and Melilla, so Spain does not border Morocco even
though it does in reality. And simplifying polygons for performance means very
short borders can be approximate — but every border in the graph was derived
before simplification, so what is drawn and what is playable always agree.

## Privacy

**Privacy & data** is a screen of its own, reached from a button in Settings
rather than sat among the game toggles: consent is the one thing in there
somebody might come looking for deliberately, months later and in a hurry, so
it gets its own door. Settings shows a one-line summary underneath the button
— "Nothing is being shared" or "Some sharing is switched on" — so the state is
readable without opening it.

It holds two switches, **Send usage data** and **Personalised ads**, both off
until a player turns them on.

A first run asks once, on a card after the how-it-works intro: usage data
only, off, with Continue leaving it off. Personalised ads are not asked there
— there are no ads to encounter yet, and one question is the most a first run
can carry before consent becomes a form people tap through, which is not
consent. Whether the question has been asked is stored separately from whether
the intro has been seen, so changing one never silently re-asks or skips the
other.

### What "send usage data" actually sends

Nine events, defined in `src/core/analytics.ts`, none of which leave unless
the switch is on:

| Event | When | Why it earns its place |
| --- | --- | --- |
| `game_start` | a game begins | the denominator for everything else |
| `game_complete` | a game is won | par, time, wrong turns |
| `game_abandoned` | a game is left unfinished | where people give up, and in which country |
| `wrong_guess` | a guess the rules refused | which borders people believe in that do not exist |
| `flight_taken` | a flight rather than a border | whether flight mode's mechanic gets used |
| `campaign_complete` | the 1000th level | how many finish at all |
| `result_shared` | a result is shared | which modes people show off |
| `onboarding_complete` | the how-it-works card is dismissed | how many never start |
| `consent_changed` | a privacy switch moves | whether the asking is reasonable |

`wrong_guess` is the one the privacy screen promises by name: enough of them
together say which countries people get stuck on.

Events raised while consent is off are **dropped, not buffered** — holding
them back for a later yes would be collecting first and asking afterwards.
`track` also swallows everything a backend can throw: an analytics failure
must never cost somebody their game.

There is no backend yet. `setAnalyticsSink` takes one when there is, and no
call site changes. Nothing in this build reports usage or shows
an ad, so today they record an answer rather than change behaviour — but they
are the only authority on the question, and anything added later has to read
them first.

Off is the default because a player who has never been asked has not agreed,
and because a player upgrading from a build without these switches has not
been asked either. Loading settings merges the defaults under whatever is
stored, so a missing answer reads as no rather than undefined; there is a test
for exactly that.

Everything else — statistics, settings, campaign progress, daily results — is
stored on the device. There is no account and no backend.

## Game modes

**Campaign** — 1000 fixed levels that everyone climbs in the same order,
getting harder two ways at once. Routes grow from two moves to twelve — three
warm-up levels, three-move routes from level 4, then one move longer every 60
to 150 levels to the end — and the countries used as start and destination get
steadily less familiar: level 1 is Canada to Mexico, level 1000 is a
twelve-country trek across Africa and Eurasia. A level opens when the one
before it is finished, and replaying can only improve a score.

Over a ladder this long, two things needed managing on purpose. *Variety*: a
country used in the last five levels sits out, and repeat use is discounted,
so the best-connected countries don't come round every few levels (a third of
levels reused one before this rule; 8% do now, where the curve left no
alternative). *Geography*: the Americas get their share of every level whose
route length they can support. They can't support many — 196 routes in all,
none longer than 10 moves — so they come out at 6% of levels against 15% of
countries, up from 2.8% left to chance. Wherever a fair map and a smooth
difficulty curve conflict, the curve wins: a 2-move level dropped into a run of
4-move ones reads as a mistake.

A handful of countries never appear, for structural reasons rather than
oversight. The UK, Ireland, Haiti and the Dominican Republic share their
islands with only one other country, so no route of two or more moves exists.
Small, central countries — much of Central America and the Gulf — are obscure
enough that the curve only admits them late, by which point routes are too long
to start or end there.

Recognisability is scored from population (60%), land area (25%) and number of
land neighbours (15%) — a big country with many borders gets met often even
when few people live there. Early levels draw only from the top of that
ranking and the pool widens as the ladder climbs. The ladder is built at build
time by `npm run build:campaign` into `src/data/campaign.generated.json`, so it
never shifts under a player mid-climb.

**Random** and **Flight mode** — both open the same sheet, differing only in
which mode it starts on: they are the same game with a different rule, and two
sheets that drifted apart would be worse than one. Pick how you travel, pick
how far, and go. The difficulty bands shown change with the mode, because they
genuinely differ — a hard walk is 5–7 moves and a hard flight is 4–5.

The sheet is the only place difficulty is chosen -- Settings does not have
it -- and it opens on whatever you picked last. "New game" after a finished
game keeps the same mode and difficulty rather than asking again.

**How flight mode works** — a flight network on top of the land borders, which
opens up every island the land rules shut out. The rule is not guessable, so
the sheet explains it before you start: every country has a departures board
showing exactly where you can fly, and it is neither "anywhere" nor "only the
nearest place". The network is in two
parts, because either one alone is wrong.

*Sea crossings* are measured between real coastlines, not invented: the United
States reaches Russia because the Bering Strait is 113km wide, Britain reaches
France across 47km of Channel, and a landlocked country has none at all. Each
country gets its three nearest crossings under 2000km, and the pairing is
always two-way. A segment only counts if it is open water the whole way,
anchored at sea on both ends. Without that last part France's nearest
non-neighbour is Austria — 143km away with Switzerland in between — and
landlocked Andorra ends up with a route to Malta.

*Long hauls* are what stop it feeling like a ferry timetable. Crossings alone
mean you can only ever hop to whatever happens to be nearest, which is not what
flying is. So each country also gets three routes of at least 1200km, weighted
towards places that are far away and widely known — roughly how a real route
map looks. They are drawn with a fixed seed, so the network is the same for
everyone and can be learned. Only the nearest sea crossing carries over into
the flight network, so a country that borders a busy sea does not get a dozen
short hops instead of anywhere interesting. The result averages seven routes
per country, spread across every distance band from a 47km Channel hop to
Australia–Mauritania at 16,400km.

The available flights are shown during play, because nobody knows off-hand
that the United States can reach Russia. Land borders stay hidden; working
those out is still the game. This turns the world into one piece — every
country is reachable from every other — and shrinks it hard: nowhere is more
than four flights from anywhere, which is why flight mode has its own
difficulty bands rather than the land ones.

**Daily challenge** — the same start and destination for every player, once a
day.

## How a random game is generated

1. Pick a starting country, weighted so larger and more recognisable countries
   come up more often.
2. Compute BFS distances from it over the land graph.
3. Pick a destination at a distance inside the requested difficulty band.
4. Store the shortest route length for scoring. The player never sees it.

| Difficulty | Moves (land) | Moves (flight) |
| --- | --- | --- |
| Easy | 2 | 2 |
| Medium | 3–4 | 3 |
| Hard | 5–7 | 4–5 |

Every generated game is solvable by construction, because the destination is
chosen from countries already known to be reachable. Easy is pinned to exactly
two moves so a game never opens with the destination already next door.

Flight mode gets its own bands because long-haul routes shrink the world: the
flight graph's diameter is four, so asking for a seven-move route would be
asking for one that does not exist.

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
