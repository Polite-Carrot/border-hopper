# Architecture

Short version: one TypeScript codebase, Expo for all three platforms, pure
game logic kept away from anything that renders, and a world map that is
projected once at build time and then simply moved under a camera.

## Decisions

### Expo (React Native + react-native-web)

iOS, Android and web from one codebase, with no second implementation of the
rules. React Native's own `Animated` and `TextInput` give native feel on
phones, and `react-native-web` renders the same components as DOM. Expo adds
the build tooling for all three targets and a static web export that drops
straight onto GitHub Pages.

The alternatives were worse fits. A native app per platform means writing the
adjacency graph, pathfinding and daily challenge twice. A pure web app wrapped
in a shell gives up the platform's scroll, haptics and native feel.

### The map is SVG, not a map SDK

`react-native-svg` renders the same SVG on iOS, Android and web. A tile-based
map SDK (MapLibre, Google Maps) would bring an API key, a large native
dependency and a visual style that fights the one this game wants — and the
game never needs tiles, streets, labels or arbitrary zoom. It needs about two
hundred country shapes it can recolour instantly.

Country geometry is **projected at build time** into SVG path strings, so the
app ships no projection code and never re-projects at runtime. The projection
is Natural Earth 1, which keeps continent shapes recognisable at world scale
and stays sane when the camera closes in.

### The game brings its own keyboard

The game draws its own A-Z keyboard rather than using the platform's.

This started as the opposite decision, and the reason for changing it is
layout. The search field is meant to sit exactly on the keyboard's top edge,
with the country list occupying the space the keyboard will take. That needs
the keyboard's height *before* it is ever shown. A platform keyboard's height
is unknowable in advance -- it varies by device, language and whether a
predictive bar is showing -- and on mobile web the browser responds to it by
moving the viewport out from under the layout. Owning the keyboard turns that
guess into a constant.

Nothing in the panel is a `TextInput`, because a focused one summons the
platform keyboard. The query is rendered as text with a caret.

What this costs: autocorrect, dictation, paste, and players' muscle memory.
Accented characters are not a loss, because the search folds accents anyway --
"turkiye" finds Türkiye and "cote divoire" finds Côte d'Ivoire -- so A-Z and a
space cover every country name. Hardware keyboards still work on the web
through a document key listener, so desktop players simply type.

### Camera

The whole world is drawn once into a `<G>` element. Travelling animates that
one group's translate and scale, so a move costs a single transform update per
frame no matter how much of the world is on screen — nothing re-renders, and
strokes use `vector-effect: non-scaling-stroke` so borders stay the same
weight at every zoom.

Scale is interpolated geometrically rather than linearly, which keeps the
apparent speed of travel even whether the camera is skimming across Europe or
pulling back to frame two continents.

The camera frames into a *visible rectangle* rather than the whole screen. The
HUD sits over the top of the map and the control panel over the bottom, so the
visible rectangle is what is left between them; that is what keeps the current
country in clear space instead of behind the country list.

### Data

Country polygons come from **Natural Earth 1:50m** via the `world-atlas`
package. 1:50m is the smallest scale that still contains the microstates —
Monaco, San Marino, Liechtenstein, Andorra, Vatican City — that a geography
game is expected to know about.

Adjacency is **derived from the geometry, not hand-written**. In a TopoJSON
topology, two polygons that share a border share an arc, so "these two
countries reference the same arc" is exactly "these two countries share a land
border". Sea crossings share no arc and so can never become neighbours. The
resulting graph has 312 edges and is symmetric by construction.

`scripts/build-country-data.ts` produces `src/data/world.generated.json`
(~475 KB) containing country metadata, the adjacency graph, and simplified
pre-projected SVG paths. Simplification runs on the topology rather than on
individual polygons, so a border simplifies identically for both countries
that share it and no gaps open up.

### No backend

Statistics, settings and daily results live in `AsyncStorage`. The daily
challenge is a pure function of the calendar date, so every player gets the
same challenge with nothing to host.

## Layout

```
src/
  core/          Pure TypeScript. No React, no React Native, no rendering.
    types.ts       Shared types
    world.ts       Loads the generated dataset, indexes it by ISO code
    graph.ts       Adjacency, BFS distances, shortest route, components
    generate.ts    Solvable-by-construction game generation
    daily.ts       Date-seeded daily challenge
    game.ts        Game state: moves, wrong guesses, win, result
    search.ts      Accent- and alias-aware country search
    stats.ts       Statistics and streaks
    share.ts       Share card text
    random.ts      Seeded PRNG
  data/          Generated country dataset (do not edit by hand)
  storage/       AsyncStorage persistence
  audio/         Sound stubs
  theme/         Colours, spacing, type, timings
  ui/
    map/           World map, camera maths, base layer
    components/    Buttons, search field, country list, HUD, route trail
    screens/       Menu, game, result, stats, settings, onboarding
    hooks/         Keyboard height, layout mode, haptics
scripts/         Build-time data generation
tests/           Vitest suites against src/core
```

`src/core` imports nothing from React or React Native. That is what lets the
rules run under Vitest in plain Node, and what would let a future server or a
second client reuse them unchanged.

## Extension points

These were designed for but deliberately not built:

- **Game modes.** `GameConfig.mode` selects a mode and `generateGame` takes a
  difficulty and an optional seed. Campaign, random and daily all produce the
  same `GameConfig` and run through the same `GameState`; timed, endless or
  no-mistakes modes would be new rules over the same pieces.

  Flight mode is the one mode that changes the graph rather than the
  objective: `travelOptions` adds each country's sea crossings, and the same
  BFS, generator and rules run over the wider edge set. The crossings
  themselves are computed at build time from the coastlines, because deciding
  whether a line between two countries is open water needs the full-detail
  land geometry and a few thousand point-in-polygon tests.

  The campaign ladder is generated at build time rather than at runtime, so a
  player's level 137 is the same next week as it is today. Changing the curve
  is a deliberate act of regenerating the file, not a side effect of editing
  a function.
- **Hints.** `movesRemaining()` and `shortestRoute()` already compute
  everything a hint needs; nothing surfaces them during play.
- **Audio.** Every point that should make a noise calls `play(sound)` in
  `src/audio/sounds.ts`. Adding audio means implementing that one function.
- **Multiplayer.** `GameState` is plain serialisable data and every transition
  is a pure function, so two clients given the same `GameConfig` can each run
  the rules locally and exchange states.
- **Leaderboards.** `GameResult` is the natural payload, and the daily key
  identifies the challenge.
