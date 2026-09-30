# Kindlehold in five minutes

A short tour of how the game is put together — enough to find your way around the code or to
explain it to someone else. The detailed module contracts are in [../ARCHITECTURE.md](../ARCHITECTURE.md).

## The two halves: simulation and view

```
                 commands (player input, AI, scripted bot)
                                  │
                                  ▼
┌──────────────────────── simulation, 20 ticks per second ────────────────────────┐
│ world  ── economy · production · population · construction · combat · units ·   │
│           AI · missions · weather · exploration · diplomacy · wildlife          │
└──────────────────────────────────┬──────────────────────────────────────────────┘
                                   │ events on a bus (unit died, building finished, …)
                                   ▼
┌──────────────────────── view, every display frame ──────────────────────────────┐
│ terrain · buildings · figures · vegetation · water · sky · effects · audio · HUD │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- **The simulation** (`src/app/simulation.js` plus the gameplay folders) advances in fixed
  steps of 1/20 s. It never touches the screen and never reads the clock or `Math.random`:
  randomness comes from a seeded generator stored *inside* the world. Same seed and same
  commands → the same game, every time.
- **The view** (`src/app/session.js`, `src/render`, `src/terrain`, `src/units/view.js`, …) draws
  the current world, interpolating between two simulation steps so movement stays smooth at any
  frame rate. It only reads the world; it may keep its own visual state (animation phases,
  particles) that never feeds back.
- **The event bus** (`src/core/events.js`) carries what happened, so sound, effects, HUD
  messages and statistics can react without the simulation knowing about them.

## The world object and saving

Everything that matters lives in one plain object (`src/world/world.js`): entities (buildings,
settlers, units, deposits, places of interest), players and their stock, mission state, time,
weather, the RNG state. Saving is JSON-serialising that object; loading validates it against a
strict schema (`src/save/index.js`) with migrations for older versions, then swaps it in. There
is no hidden state elsewhere, which is why save/load is reliable and easy to test.

## Modules and error boundaries

Each subsystem registers with a module host (`src/core/module-host.js`) as a *sim* or *view*
module with `update()`/`render()` and a health status. Exceptions are caught per module: a
broken view module is switched off and the game goes on; a broken core module stops the game
and offers "load last save" instead of a blank page.

## Content as data

Chapters are declarative (`src/missions/scenarios/*.js`): map, starting town, enemy faction and
outposts, objectives with conditions (`{ built: 'mine', count: 2 }`, `{ poiDone: 'hamlet' }`),
story beats with actions (grant goods, reveal land, trigger a raid). New chapters rarely need
new code. Maps are data too (`src/world/maps/`); terrain, rivers, forests and roads are
generated from them.

## Rendering

- Three.js with an HDR post-processing chain (`src/render/post.js`): multisampled scene buffer,
  ambient occlusion from depth, bloom, tone mapping, colour grading, miniature focus.
- **Instancing everywhere**: trees, grass, building parts and figures are drawn in batches, not
  one draw call per object.
- **Characters** (`src/units/skinned-figures.js`): modelled KayKit characters, baked offline
  (`scripts/assets/bake-figures.mjs`) into a compact file. Each figure writes its bone matrices
  and colours into one row of a float texture; the vertex shader skins all figures of a kind
  in a single draw call. Costumes per role and faction are data (`src/units/cast.js`).
- **Load governor** (`src/app/render-context.js`): when frames stay slow it switches off
  ambient occlusion, then bloom, then multisampling, and only then lowers the resolution.

## Quality assurance

| Layer | Where | What it proves |
|---|---|---|
| Unit and integration tests | `tests/unit`, `tests/integration` | rules, validation, poses, costumes |
| Simulation tests | `tests/simulation` | whole chapters played deterministically by a bot |
| Browser tests | `scripts/verification/e2e.mjs` | the real UI: menus, tutorial, save/load, chapters |
| Soak test | `scripts/verification/soak.mjs` | no growth in GPU resources, DOM or heap over time |
| Visual checks | `scripts/verification/verify.mjs`, `?showcase=…` | screenshots per time of day and zoom |
| Diagnostics (F3) | `src/ui/diagnostics.js` | performance log from a player's own machine |

## Where to look first

| I want to… | Start in |
|---|---|
| change a building or its costs | `src/buildings/defs.js` |
| change how settlers work | `src/production/`, `src/population/`, `src/economy/` |
| add a unit | `src/units/defs.js`, then `src/units/cast.js` for its looks |
| write a chapter | `src/missions/scenarios/` |
| tune the enemy | `src/ai/` |
| change the HUD | `src/ui/hud.js`, `src/ui/styles.css` |
