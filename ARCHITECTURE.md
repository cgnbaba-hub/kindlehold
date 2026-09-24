# Kindlehold — Architecture

Kindlehold is an original browser RTS / settlement builder. This document is the
contract every subsystem follows. Changes to it go through the integrator
(see "Core-change request process").

## 1. Layering and dependency direction

```
            ┌───────────────────────────── app/ (bootstrap, routes, error overlay)
            │
  view layer (may import three)          simulation layer (pure JS, no three, no DOM)
  ──────────────────────────────         ───────────────────────────────────────────
  terrain/view  environment/  camera/    world/  navigation/  economy/  population/
  buildings/view units/view  effects/    buildings/defs  construction/  production/
  input/  selection/view  ui/  audio/    technology/  units/sim  heroes/  combat/
  showcase/  debug/  telemetry/          ai/  missions/  save/
            │                                        │
            └──────────────► core/ ◄─────────────────┘
                 (rng, events, loop, module host, logger, contracts, validation)
```

Rules:

1. `core/` imports nothing from other `src/` folders.
2. Simulation modules import only `core/`, `world/` and other simulation modules'
   **public** `index.js` / `defs.js` exports. They never import `three`, never touch
   `window`/`document`, and never read wall-clock time. They run unchanged in Node
   (`node --test`) — this is what makes determinism testable.
3. View modules read authoritative state from the world object and simulation
   events. They never write authoritative state. User intent is turned into
   **commands** (`core/commands.js`) that the simulation applies on the next tick.
4. Authoritative gameplay state is never stored on Three.js objects. Three objects
   carry at most `userData.entityId` for picking.
5. `app/` is the composition root: it is the only place that wires simulation and
   view together.

## 2. Folder ownership

| Folder | Owner (role) | Layer | Responsibility |
|---|---|---|---|
| `src/core` | integrator | shared | RNG, event bus, fixed loop, module host, logger, commands, validation, contracts |
| `src/world` | integrator | sim | World model factory, entity store, spatial index, terrain heightfield sampling, territory |
| `src/app` | integrator | composition | Bootstrap, routing (`?showcase=`), error overlay, verification hooks |
| `src/terrain` | terrain-builder | view | Terrain mesh, splat materials, worn paths, territory border |
| `src/environment` | environment-builder | view | Sky, sun/moon, day-night, fog, water, vegetation rendering, night lights |
| `src/camera` | integrator (wave 1) | view | RTS camera rig, presets, bounds |
| `src/input` | integrator (wave 1) | view | Keyboard/mouse mapping, rebinding |
| `src/selection` | unit-builder | view+cmd | Click/box select, control groups, selection rings |
| `src/navigation` | navigation-builder | sim | Grid, A*, path service with request budget, formations |
| `src/economy` | economy-builder | sim | Resources, stock, hauling jobs, stall reasons |
| `src/population` | population-builder | sim | Settlers, housing, job assignment, provisions, stability |
| `src/buildings` | building-builder | sim defs + view | Building definitions, meshes, construction stages |
| `src/construction` | building-builder | sim | Placement validity, construction sites, repair, demolition, refunds |
| `src/production` | economy-builder | sim | Workplace work cycles, deposits, inputs/outputs |
| `src/technology` | economy-builder | sim | Tech tree, research queue, effects |
| `src/units` | unit-builder | sim + view | Military units, orders, movement, figure rendering |
| `src/heroes` | hero-builder | sim | Hero trait and abilities |
| `src/combat` | combat-builder | sim | Targeting, damage, armour, projectiles, towers |
| `src/ai` | ai-builder | sim | Enemy camp, waves, raid logic, difficulty |
| `src/missions` | mission-builder | sim | Scenario loading, objectives, triggers, tutorial, victory/defeat |
| `src/effects` | effects-builder | view | Pooled particles (smoke, dust, sparks, fire), floating text |
| `src/audio` | audio-builder | view | Procedural WebAudio mixer, SFX, ambience, music |
| `src/ui` | ui-builder | view | DOM HUD, menus, settings, tooltips, alerts |
| `src/save` | save-builder | sim | Serialization, schema versions, migrations, slots |
| `src/telemetry` | verification-builder | view | FPS, frame-time percentiles, renderer stats |
| `src/debug` | verification-builder | view | Debug overlay, `window.__GAME__` verification API |
| `src/showcase` | each builder (own file) / integrator (router) | view | Isolated deterministic subsystem scenes |
| `src/demo` | mission-builder | data | Scripted demo command sequences for verification presets |

## 3. Module contract (lifecycle)

Every module (simulation or view) is an object registered with the `ModuleHost`
(`src/core/module-host.js`):

```js
/** @type {import('./src/core/contracts.js').GameModule} */
{
  id: 'economy',
  critical: false,          // critical modules failing -> recoverable error screen
  kind: 'sim' | 'view',
  init(ctx) {},             // ctx = { world, bus, rng, log, commands, services, settings }
  start() {},
  update(step) {},          // sim modules only; step = { tick, dt }
  render(alpha, frame) {},  // view modules only; alpha = interpolation 0..1
  pause() {}, resume() {},
  serialize() {},           // module-private persistent state (usually null: state lives in world)
  deserialize(data) {},
  dispose() {},
  getHealthStatus() {},     // { status: 'ok'|'degraded'|'failed', detail }
  runShowcase(ctx) {},      // optional; returns a showcase descriptor
}
```

Documented deviations:
- Sim modules implement `render` as a no-op; view modules implement `update` as a no-op.
  The host skips missing methods, so modules only define what they use.
- Most sim modules keep **all** persistent state inside the world object, so their
  `serialize()` returns `null`. The world object is the save-game boundary.
- `runShowcase` lives in `src/showcase/<id>.js` rather than on the module object to keep
  showcase code out of the production hot path (it is lazy-loaded).

## 4. Failure handling

- `ModuleHost` wraps every lifecycle call in try/catch. Errors are logged with the
  module id, counted, and reported via `module:error`.
- A non-critical module that throws 3 times in 10 seconds is **disabled**
  (`status: failed`) and the game continues; the HUD shows a small degraded badge.
- A critical module failure (`world`, the simulation driver, `renderer`) shows the
  recoverable error overlay (`src/app/error-overlay.js`) with *Retry*, *Load last save*,
  *Return to menu*, and a copyable diagnostic. The page is never left blank.
- Assets load with timeouts (`core/assets.js`); on failure a procedural fallback is used
  and a `asset:fallback` event is logged.
- Audio failing (no AudioContext, autoplay blocked) is non-critical by design.
- All JSON inputs (scenario files, save files, settings) pass through
  `core/validate.js`: size limits, prototype-pollution guards, typed schema checks.

## 5. Events (event bus `core/events.js`)

Synchronous bus. Simulation modules emit during `update`; view modules subscribe and
react during their next `render`. Listener counts are bounded (warning above 64 per
event name) and every `on()` returns an unsubscribe function which modules call in
`dispose()`. Canonical event names live in `src/core/contracts.js` (`EV`).

| Event | Payload | Emitted by | Consumed by |
|---|---|---|---|
| `entity:spawned` | `{id, kind}` | world | views, audio |
| `entity:removed` | `{id, kind, reason}` | world | views, effects |
| `building:placed` | `{id, type, owner}` | construction | ui, audio |
| `building:completed` | `{id, type}` | construction | missions, ui, audio, effects |
| `building:destroyed` | `{id, type, owner}` | combat | missions, ai, effects, audio |
| `construction:progress` | `{id, progress}` | construction | effects |
| `resource:changed` | `{owner, res, amount, delta}` | economy | ui |
| `production:cycle` | `{id, res, amount}` | production | effects, audio |
| `production:stalled` | `{id, reason}` | production | ui |
| `work:strike` | `{id, kind, x, z}` | production/construction | effects, audio |
| `settler:arrived` | `{id}` | population | ui |
| `population:changed` | `{owner, pop, cap}` | population | ui |
| `tech:started` / `tech:completed` | `{owner, techId}` | technology | ui, audio, missions |
| `unit:recruited` | `{id, type, owner}` | units | ui, audio, missions |
| `unit:order` | `{ids, order}` | units | audio (acknowledgement) |
| `combat:hit` | `{attacker, target, damage, x, z}` | combat | effects, audio |
| `combat:shot` | `{from, to, flightTicks, kind}` | combat | effects |
| `unit:died` | `{id, type, owner, x, z}` | combat | effects, missions, audio |
| `hero:ability` | `{heroId, ability, x, z}` | heroes | effects, audio |
| `ai:wave` | `{wave, size, target}` | ai | missions, ui, audio |
| `mission:objective` | `{id, state}` | missions | ui, audio |
| `mission:message` | `{speaker, text, kind}` | missions | ui |
| `mission:ended` | `{result: 'victory'|'defeat', reason}` | missions | app, ui, audio |
| `alert` | `{level, text, x?, z?}` | any sim | ui, audio |
| `module:error` | `{module, message}` | module host | debug, ui |

## 6. Simulation, time and determinism

- Fixed timestep: **20 ticks per second** (`dt = 0.05 s`), `core/loop.js`. At most 5
  catch-up steps per rendered frame; excess time is dropped (the game slows rather than
  spiralling). Game speed (0.5×/1×/2×) scales accumulated time, never `dt`.
- Rendering interpolates positions with `alpha` between the previous and current tick
  (entities keep `px, pz` = previous-tick position).
- **Only** `world.rng` (sfc32, `core/rng.js`) may be used for randomness in simulation
  and content generation. `Math.random()` is banned in `src/` (checked by
  `tests/unit/lint-rules.test.js`). View-only jitter uses a separate seeded
  `viewRng` so screenshots are reproducible too.
- No wall-clock reads in simulation (`Date.now`, `performance.now` banned in sim folders;
  enforced by the same lint test).
- Iteration order is deterministic: entities are stored in a `Map`-free plain object
  keyed by integer id and iterated through `world.index` arrays sorted by id.
- Player input becomes commands (`{type, tick, ...}`) queued for the next tick.
  Same seed + same command list ⇒ identical world hash (`world/hash.js`), verified
  by `tests/simulation/determinism.test.js`.

## 7. Coordinates and units

- World units are **metres**. **+Y is up**. The map is centred on the origin;
  the playable area spans `x, z ∈ [-half, +half]` (`half = 128` for the slice map).
- The simulation is 2D on the XZ plane. Heights are sampled from the deterministic
  heightfield (`world/terrain-data.js`) only where rules need slope or water tests.
- Angles are radians, heading `0` faces +Z, rotating counter-clockwise seen from above.
- Navigation grid: 2 m cells, `cell = floor((x + half) / 2)`.

## 8. World model and save-game boundary

`src/world/world.js` creates the single serializable world object (see JSDoc
`World` in `core/contracts.js`). It contains: meta + seed + schema version, tick,
rng state, time of day, weather, players (resources, techs, research queue,
population, stability), all entities (buildings, construction sites, settlers,
military units, heroes, deposits, enemy units/structures), mission objectives and
trigger state, AI state, difficulty, selection & control groups, and statistics.

Derived data (spatial hash, navigation grid, territory map, per-kind indices) is
**rebuilt** on load and never saved. Save files: `{format:'kindlehold-save',
schemaVersion, savedAt, label, world}`; migrations in `src/save/migrations.js`.

## 9. Performance budgets (summary — authoritative numbers in PERFORMANCE_BUDGET.md)

Sim ≤ 4 ms/tick at reference scenario; ≤ 1,500 draw calls; ≤ 1.5 M triangles;
entity cap 1,200; path requests ≤ 12/tick; no per-frame allocations in hot loops.

## 10. Showcase modes

`?showcase=<id>` loads `src/showcase/<id>.js` lazily. Each showcase builds a small
deterministic world (fixed seed), mounts only the modules it needs, sets a camera,
and exposes `__GAME__` for verification. Available ids are listed in
`src/showcase/index.js`.

## 11. Verification hooks

`window.__GAME_READY__` becomes `true` once the first frame has rendered after load.
`window.__GAME__` exposes: `setSeed`, `setCameraPreset(name)`, `setTimeOfDay(h)`,
`runTicks(n)`, `getStats()`, `getHealth()`, `getWorldHash()`, `issue(command)`,
`save()/load()`. It is enabled in dev and when `?verify=1` is present.

## 12. Integration rules

1. Builders change only their folder, their showcase file, and their tests.
2. Cross-module needs (new event, new world field, new shared helper) are written to
   `docs/CORE_CHANGE_REQUESTS.md`; the integrator applies them and updates this file.
3. Every integration runs `npm test`, `npm run build`, `npm run verify`,
   `npm run test:e2e`, then updates `docs/STATUS.json` and commits.
4. The dev server must stay loadable after every commit.

## 13. Core-change request process

Append an entry to `docs/CORE_CHANGE_REQUESTS.md` with: id, requester, motivation,
proposed API, affected modules. The integrator marks it `accepted`, `rejected`, or
`done` with the commit hash. Only the integrator edits `src/core`, `src/world`,
`src/app`, `vite.config.js`, `package.json` and this document.
