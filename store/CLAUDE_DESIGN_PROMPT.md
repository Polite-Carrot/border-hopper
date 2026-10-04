# Claude Design brief: Border Hopper store art

Paste the prompt below into Claude Design and attach the files it lists. The
screenshots are real captures of the game at Apple's exact sizes, made with a
seeded save (campaign at level 29, 49 passport stamps, wearing Brazil's flag).

| Folder | Size | Use for |
| --- | --- | --- |
| `screenshots/iphone-6.9/` | 1320 × 2868 | iPhone 6.9" screenshots (Apple scales these down for smaller iPhones) |
| `screenshots/ipad-13-landscape/` | 2752 × 2064 | iPad 13" screenshots, landscape: big map with the country list in a sidebar |
| `screenshots/ipad-13/` | 2064 × 2752 | iPad 13" portrait, if you prefer portrait |
| `brand/app-icon-1024.png` | 1024 × 1024 | The app icon |
| `brand/explorer.svg` | vector | The explorer character, for promo art |

To recapture after the game changes, the script that made these is described
at the end.

---

## The prompt

> Design the App Store screenshots and promo art for **Border Hopper**, a
> geography puzzle game for iPhone and iPad. I've attached real screenshots
> from the game, the app icon and the game's character.
>
> **The game:** you're given two countries, and you travel from one to the
> other by naming the countries in between, one border at a time. A little
> explorer in a safari hat hops across each border on a world map. Every
> border is a real land border between 195 countries. There's a 1,000-level
> campaign, a daily challenge, and a flight mode that adds real sea crossings
> like Dover to Calais plus long-haul routes. Every country you pass
> through stamps your passport, and your explorer can wear the flag of any
> country you've stamped.
>
> **Look and feel:** a dark, night-time map. Use these colours:
> - background `#050A12`, ocean `#07101D`, land `#1E2E43`
> - "you are here" bright blue `#3DBDF8`
> - destination pink `#FF7BA8`
> - gold for achievements `#FFCE6A`
> - text `#E9F1FA`, secondary text `#8098B4`
>
> Headlines in a heavy, wide-tracked sans-serif, like the game's own BORDER
> HOPPER wordmark (Avenir Next Heavy, or similar). The explorer
> (`explorer.svg`) is the mascot: friendly and simple, with a red jumper.
> Calm and clever, not loud. No confetti or cartoon explosions.
>
> **Make two screenshot sets, six frames each, telling the same story:**
> 1. iPhone: 1320 × 2868 px, portrait, using `iphone-6.9/`
> 2. iPad: 2752 × 2064 px, landscape, using `ipad-13-landscape/`
>
> Each frame is a short headline (2–5 words) with an optional one-line
> subline above or below the screenshot, which sits in a device frame or with
> rounded corners. Frames can run into each other, for example with the map
> continuing across the set.
>
> | # | Screenshot | Headline | Subline |
> | --- | --- | --- | --- |
> | 1 | `gameplay-hop` | Hop the world | Name the next country, and your explorer jumps the border |
> | 2 | `world-zoomed-out` | Every border is real | 195 countries, and every neighbour is a real one |
> | 3 | `flight-departures` | Take to the skies | Flight mode: real straits and long-haul routes |
> | 4 | `passport` | Collect every flag | Each country you cross stamps your passport |
> | 5 | `result` | Find the shortest route | Perfect routes, streaks and new stamps |
> | 6 | `campaign` | 1,000 levels | Plus a new daily challenge every day |
>
> The first three frames matter most, because they're the ones people see in
> search results. Frame 1 should make the game obvious at a glance. Spare
> shots you can swap in: `gameplay` (the explorer standing still),
> `menu`, `flight-picker`, `level-start`.
>
> **Also make this promo art:**
> - Social post, 1080 × 1080
> - Story, 1080 × 1920
> - Wide banner, 1200 × 628
> - Google Play feature graphic, 1024 × 500: the icon, the name, the
>   explorer on a map, and no small text
>
> **Rules:**
> - Use the screenshots as they are. You can crop, scale and frame them, but
>   don't redraw the interface or invent features, scores or screens.
> - No star ratings, awards, review quotes, prices or "free".
> - Text must be readable when a screenshot is shown small.
> - Keep anything important clear of the very top and bottom edges.
> - Write in British English (centre, colour).
> - Keep every frame in the same style, so the set reads as one piece.
> - Export PNG or JPEG with no transparency, at exactly the sizes above.

---

## Store text

The App Store description, promotional text, subtitle and keywords are in
[`APP_STORE_TEXT.md`](APP_STORE_TEXT.md).

## Recapturing the screenshots

`scripts/store-screenshots.mjs` makes them. It drives the web build in
headless Chromium at each device's size and pixel ratio, with the notch and
home-bar insets emulated, starting every scene from the same seeded save. The
top of the file says how to run it. Recapture after any visible change to the
game, so the store never shows an older version.

- iPhone: 440 × 956 points at 3×, insets 62 top / 34 bottom
- iPad: 1032 × 1376 points (portrait) or 1376 × 1032 (landscape) at 2×
