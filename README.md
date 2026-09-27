# POYA · Pixel Pet Arena

A pixelated digital pet you raise like a real one. Adopt a wild animal, keep it fed, clean and happy,
condition it in the training yard, then send it into the arena against rival (bot) pets.

## Run it

No build step and no dependencies. ES modules need to be served over HTTP (opening `index.html` directly won't work):

```sh
npm start            # = python3 -m http.server 8080
# open http://localhost:8080
npm test             # logic tests + a balance simulation of every matchup (Node 18+)
```

Progress is saved in the browser's `localStorage`.

## Mobile

The game is built mobile-first for phones:
- On the camp screen, the tabs become a bottom tab bar. Needs show as a compact 2-column grid, and battle HP cards sit side by side.
- Tap targets are at least 44px. Double-tap zoom and pull-to-refresh are turned off. Hover effects only apply on devices that can hover.
- In battle, **hold** a move to read its description (a tap uses it). In training, tap anywhere on the bar.
- Layouts account for notches and home-indicator areas (`viewport-fit=cover` + `env(safe-area-inset-*)`).

It is also an installable **PWA**: `manifest.webmanifest`, icons in `icons/`, and `sw.js`, which makes the game work offline after the first visit. On a phone, open the hosted URL and choose *Add to Home Screen* / *Install app*. PWAs require HTTPS, except on `localhost`.

To regenerate the icons after changing a sprite, run `node tools/make-icons.mjs` (no dependencies).

### Shipping to the App Store / Play Store
The game is a static site, so it can be wrapped with [Capacitor](https://capacitorjs.com):
```sh
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android @capacitor/ios
npx cap init POYA com.yourname.poya --web-dir .
npx cap add android && npx cap add ios   # then open in Android Studio / Xcode
```
Before a store release, consider:
- **Fonts:** self-host Press Start 2P and VT323 (both SIL Open Font License) instead of loading them from Google Fonts. Otherwise the very first launch needs internet.
- **Web dir:** point `webDir` at a folder that contains only the game files (`index.html`, `css/`, `src/`, `icons/`, `manifest.webmanifest`, `sw.js`).
- **Saves:** they live in `localStorage`. For a native app, `@capacitor/preferences` is more durable, and only `saveGame`/`loadGame` in `src/core/state.js` would need to change.

## Gameplay

| Animal | Role | Style |
| --- | --- | --- |
| Wolf | Assassin | Stealth, vertical mobility, high critical damage |
| Gorilla | Juggernaut | High health, slow, immense crowd control (stuns, grapples) |
| Grizzly Bear | Bruiser | Bleed damage-over-time, tracking, attrition |
| Eagle | Scout | Reconnaissance, aerial dives, blind/weaken debuffs |

- **Care**: Fullness, energy, happiness, hygiene and health change in real time, and more slowly while you're away. Neglect causes sickness. Mood comes from these needs and scales both training gains and battle damage (−40% to +15%).
- **Groom & Play**: Groom is a brushing mini-game (drag the brush to scrub off mud and tangles); Play is a feather teaser wand (dangle it low to tempt a pounce, yank it away to tease). How well it goes scales the hygiene or happiness gain. Tap your pet to cuddle, but not too much.
- **Feed**: Buy food with arena coins. Each species has favorite and disliked foods. Protein Chow boosts the next training session, and Medicine cures sickness.
- **Train**: Digimon World-style equipment (Boulder Moving, Waterfall, Striking Log, Punch Glove, Running, Classroom). Each station raises a primary stat and, by a smaller amount, a secondary one. Stamina (the MP stand-in) lowers the energy cost of training. Sessions are a timing mini-game with 3 reps. Each stat has a cap per level, so you need to level up to keep growing. Each species trains its specialty 50% faster.
- **Mastery**: Good and perfect reps build mastery at each training station (progressive overload). At 12 and 36 mastery the station offers one of its 2 moves, which any animal can learn, and its timing bar gets faster. Skipped moves can be learned later from the Train tab.
- **Moves**: Each species starts with 4 moves and learns a new one every level from Lv 2 to Lv 10 (13 in total). Pick which 4 to take into battle in the Stats tab; the basic attack is always equipped.
- **Battle**: Turn-based fights with your 4 equipped moves, cooldowns and status effects, against Rookie, Contender or Champion bots.

## Folder structure

Each feature has its own folder. Balance numbers sit at the top of the file that uses them.

```
index.html
css/
  theme.css          colour palette (Sweetie-16), fonts, base styles
  components.css     buttons, bars, tabs, chips, toasts, modals
  screens.css        per-screen layouts + responsive rules
src/
  main.js            boot: load save, offline catch-up, real-time clock
  core/              config, save/load state, small utils
  pets/
    species.js       ← animal definitions: stats, growth, passives, diets, learnsets
    pet.js           pet model, derived stats, XP/levels
    needs.js         ← hunger/energy/hygiene/health simulation + rates
    mood.js          mood from needs, mood multipliers, thought bubbles
  foods/
    foods.js         ← food catalog (prices, effects)
    feeding.js       shop + feeding rules, likes/dislikes
  care/care.js       ← play / groom / sleep actions + tap-to-cuddle rules
  training/
    exercises.js     ← training equipment + rules (costs, caps, bonuses)
    trainer.js       applies a finished session to the pet
    simulator.js     the timing mini-game logic (no DOM)
  combat/
    abilities.js     ← every move, plus bot AI scoring
    effects.js       status effects (stealth, stun, bleed, ...)
    battle.js        turn engine: returns events for the UI to play back
    bots.js          opponent generation by difficulty + move picker
    arena.js         entry requirements, costs, rewards
  sprites/
    animals.js       ← pixel-art sprites as editable character grids
    renderer.js      rasterise + draw sprites/glyphs
    backgrounds.js   meadow (day/night) scene + background registry
    arena.js         ← colosseum battle scene (stone colours, layout, crowd)
    fx.js            floating emotes (hearts, Zzz, stars)
  ui/
    router.js, dom.js
    components/      pet stage (animation), bars, toasts, modal, training sim, groom / play / cuddle / feeding
    panels/          Care / Feed / Train / Battle / Stats tabs
    screens/         title, select, home (camp), battle
tests/logic.test.js
tools/make-icons.mjs  generates app icons from the sprites
manifest.webmanifest, sw.js, icons/   installable app + offline support
```

The `←` files are where most tweaking happens. All game logic (`pets`, `foods`, `care`, `training`, `combat`) is plain JavaScript with no DOM access, so it can be tested in Node.

### Common changes
- **New food**: add it to `FOODS` and `FOOD_ORDER` in `foods/foods.js`.
- **New ability**: add it to `ABILITIES` in `combat/abilities.js`, then add `[level, id]` to a species' `learnset` (and an animation in `sprites/moves.js`, or it uses a plain lunge).
- **New animal**: add it to `SPECIES` and `SPECIES_ORDER` and give it a sprite in `sprites/animals.js`. `npm test` checks that everything it references exists and that its matchups stay balanced.
- **Faster/slower pet needs**: change `NEED_RATES` in `pets/needs.js`.
