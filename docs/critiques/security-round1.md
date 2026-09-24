# Security critique — round 1

Reviewer: security-critic (read-only). Date: 2026-09-24.
Scope: save/settings parsing, DOM sinks, debug surface, nginx + deploy scripts, tooling paths, secrets/supply chain.
Method: code review with file:line evidence, plus a Node harness that fed 49 crafted saves through
`deserializeWorld` and, for each one that loaded, ran `createSimulation()` → `sim.replaceWorld(world)` → `sim.run(100)`
in a child process with a timeout (no browser, no vite, no docker).

Threat-model context: saves only come from `localStorage` (`src/save/storage.js:243-249`). No file import, no network.
Someone who can write that origin's localStorage can already run script there, so save-robustness problems are
mostly **integrity/availability** problems (a corrupted or hand-edited save bricks the game), not privilege escalation.
The severities below reflect that.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 3 |
| Low | 5 |
| Info | 6 |

---

## Medium

### M1. Shell injection through `DEPLOY_ROOT` in deploy.sh / rollback.sh
**Evidence**
- `deploy/scripts/deploy.sh:31` builds the script that runs on the server (or locally) with `root='$DEPLOY_ROOT'`. The only check (`:22`) is that the value starts with `/` and is not `/`. A single quote in the value closes the string.
- `deploy/scripts/deploy.sh:56` has the same problem: `ssh "$DEPLOY_HOST" "mkdir -p '$DEPLOY_ROOT'"`. `:57` (`scp ... "$DEPLOY_HOST:$DEPLOY_ROOT/..."`) is also read by the remote shell.
- `deploy/scripts/rollback.sh:15` uses `root='$DEPLOY_ROOT'` and does **no** validation at all: a relative path or `/` is accepted.

**Reproduction** (dry-run only; the third command pipes one printed line into bash):
```
$ DEPLOY_ROOT="/tmp/x'; echo INJECTED-AS-\$(id -un); : '" bash deploy/scripts/deploy.sh --dry-run | sed -n 3p
root='/tmp/x'; echo INJECTED-AS-$(id -un); : ''; id='20260924090402-2ad8efc'; keep='5'
$ ... | sed -n 3p | bash
INJECTED-AS-root
```
The value is chosen by the operator, so this is not remotely exploitable. The risk is a poisoned `.env.deploy` or CI variable, or a path with an accidental `'` or space, running arbitrary commands as the deploy user. It also contradicts SECURITY.md ("quoted variables").

**Fix**: Add an allowlist in both scripts before anything else runs:
`[[ "$DEPLOY_ROOT" =~ ^/[A-Za-z0-9._/-]+$ && "$DEPLOY_ROOT" != *..* ]] || { echo "bad DEPLOY_ROOT" >&2; exit 2; }`.
Then pass values as positional arguments rather than interpolating them into the script text:
`ssh "$DEPLOY_HOST" bash -s -- "$DEPLOY_ROOT" "$ID" "$KEEP" <<'SCRIPT' ... root="$1"; id="$2"; keep="$3" ... SCRIPT`
(use a quoted heredoc so nothing is expanded locally). Also validate `DEPLOY_HOST` (`^[A-Za-z0-9._@-]+$`, must not start with `-`) to rule out `ssh -o...` option injection.

### M2. Saves that pass validation can freeze the running game with no error screen
**Evidence**
- The schema only checks a few fields. For entities: `src/save/index.js:113-121` (id, kind, x, z, owner). For the world: `:123-135`. It does **not** check `players.p1` existing, `mission.flags`, `combat.pending`, `building.type` being a known def, `research.techId`, `path` arrays, `selection.groups`, `weather` or `stats`.
- The simulation contains most of the damage because module-host has error boundaries (`src/core/module-host.js:31-41`). The HUD does not: `hud.update` runs through `hooks.onFrame` (`src/app/session.js:64`) outside any try/catch, and `frame()` (`src/app/session.js:70-80`) calls `requestAnimationFrame(frame)` only **after** `loop.advance` returns. One throw in the HUD therefore stops the frame loop for good. The window `error` handler (`src/app/main.js:9-11`) only logs it, so the player sees a frozen game and no overlay.
- `src/ui/hud.js:399` `const p = w.players[PLAYER];` and then `p.res[r]`, `p.pop` and so on (≈`:426-437`) run every frame.

**Reproduction (Node harness results, 100 ticks each):**
```
noPlayers            (players: {})                 LOADED; economy=failed: Cannot read properties of undefined (reading 'res')
ownerUnknown         (all owners 'p9')             LOADED; economy=failed ...
buildingUnknownType  (building.type='nonexistent') LOADED; navigation(CRITICAL)=failed:deserialize ...navRadius | population, combat failed
missionMinimal       (mission:{objectives:[]})     LOADED; missions=failed: ...reading 'raidWarned'
noWeatherCombatStats (combat/stats removed)        LOADED; combat=failed: ...reading 'pending'
techBogus            (research.techId='nope')      LOADED; technology=failed
manyUnitsLongPaths   (1200 units, order:null)      LOADED; ai, units, combat failed
```
In the browser, `noPlayers` would also throw at `hud.js:399+` on the first frame and freeze the page.
`buildingUnknownType` raises the critical overlay. Its "Load last save" button (`src/app/game-app.js:84`) picks `latestSave()`, which may be the same broken save, so the player lands back on the same overlay.

**Fix**
1. Extend the schema so a save that loads is also a save that can run. Require every structure the modules dereference: `players` must contain `p1` and `p2` with `res`, `pop`, `popCap` and `research: null|{techId ∈ TECHS, progress:number}`; `mission.flags/triggers/timers/messages` objects; `ai.state`; `combat.pending` array (max ~2000); `weather`; `stats`; `selection.groups` record of number arrays. Add a per-kind entity schema: `type` must be an **own** key of `BUILDINGS`/`UNITS`/deposit types (`Object.hasOwn`), `owner ∈ {'p1','p2','none'}`, `hp`/`maxHp` finite, `path` null or array ≤ 2048 of `{x,z}` finite, `workers` array of ints ≤ 16, `queue` ≤ 5, `stock.in/out` records of RESOURCES.
2. Wrap the per-frame view hooks in a boundary. In `session.js`, either `try { loop.advance(dt) } catch (e) { onCritical('frame', e) }` with `requestAnimationFrame(frame)` scheduled **before** advance, or register the HUD as a view module so module-host handles its errors.
3. Add a post-load smoke step: after `replaceWorld`, run `host.health()`. If a critical module failed during `deserialize`, reject the load with a readable message instead of starting the session.

### M3. nginx: `location ^~ /assets/` bypasses the `.map` and dotfile deny rules
**Evidence**: `deploy/nginx/game.conf.example:50` uses `^~`, which tells nginx to **skip regex locations** for any URI under `/assets/`. The `location ~* \.map$ { return 404; }` (`:57`) and `location ~ /\. { deny all; }` (`:60`) rules therefore never apply to `/assets/*.js.map` or `/assets/.anything`. `/assets/` is exactly where Vite writes source maps and hashed chunks. Today no maps are built (`vite.config.js:10`, `build.sh:22`, and `find dist -name '*.map'` is empty), so the gap is latent. The "refuse just in case" rule does not do what its comment claims. `validate-nginx.sh` does not test this (`:47` checks only `/.env`), and `health-check.sh:21-22` passes only because the file is absent.
**Fix**: Put the deny rules inside the `/assets/` block (`location ~* \.map$ { return 404; }` nested, or `if ($uri ~* "(\.map$|/\.)") { return 404; }`). Alternatively, drop `^~` and turn the assets block into a regex location placed **after** the deny regexes. Add `curl ${BASE}assets/x.js.map` and `${BASE}assets/.x` checks to `validate-nginx.sh` after planting such files in the local release.

---

## Low

### L1. The `/assets/` location drops all security headers except nosniff
`game.conf.example:50-54`: nginx does not inherit `add_header` into a location that sets its own. JS/CSS responses under `/assets/` therefore carry no CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy or COOP. The impact is small for script/style responses, but an SVG or HTML placed under `/assets/` and opened directly would render without CSP. **Fix**: repeat the header set in the `/assets/` block, or move the headers into a snippet (`include snippets/kindlehold-headers.conf;`) and include it in every location that adds headers.

### L2. Migrations run on unvalidated data and leak raw TypeErrors
`src/save/index.js:182` calls `migrate()` **before** `checkValues`/`validate` (`:183-184`). `src/save/migrations.js:204-206` dereferences `world.players[id].burnPenalty`, and `:202-203` writes to `world.stats`. Harness results:
```
playerNull_v1:    REJECTED (TypeError: Cannot read properties of null (reading 'burnPenalty'))
playersString_v1: REJECTED (TypeError: Cannot create property 'burnPenalty' on string 'a')
statsString_v1:   REJECTED (TypeError: Cannot create property 'buildingsBuilt' on string 'x')
```
These are rejected correctly, but through a non-`ValidationError` path. The raw engine message reaches the player (`game-app.js:71`). A future migration that loops over unvalidated arrays could also hang. **Fix**: validate a minimal schema-v1 shape (and run `checkValues`) before migrating. Wrap `migrate` in `try { } catch (e) { throw new ValidationError('save could not be upgraded') }`.

### L3. A valid save becomes unloadable once `nextId` grows past the schema limit
`worldSchema` allows `nextId ≤ 1e9` (`index.js:128`) and entity keys of ≤ 9 digits (`:131`). `spawn` increments without a bound (`src/world/world.js:93`). Loading a save with `nextId: 999999999` and running 3000 ticks gives `nextId after 1000000003` and `ROUNDTRIP FAIL: world.nextId: number out of range`. Normal play won't reach this, but a crafted or edited save turns every later save into one that can't be loaded (for example, autosave overwrites `auto`). **Fix**: have `spawn` refuse (like the entity cap) when `nextId >= 1e9`, or relax both limits to `Number.MAX_SAFE_INTEGER` / `^\d{1,15}$`.

### L4. Prototype-chain lookups with URL-param and save-controlled keys
The code does plain-object lookups without `Object.hasOwn`: `QUALITY[quality]` (`src/app/render-context.js:12`, from `?quality=`), `DEMO_STATES[name]` (`src/demo/states.js:97`, `?demo=`), `SHOWCASES[id]` (`src/showcase/index.js:20`, `?showcase=`), and HUD lookups `BUILDINGS[type]`, `TECHS[techId]`, `RES_NAMES[...]` (`src/ui/hud.js:148,245,282`) that take save data. Values like `constructor`/`toString`/`hasOwnProperty` resolve to built-ins instead of `undefined`. For example, `?verify=1&demo=hasOwnProperty` calls `Object.prototype.hasOwnProperty(sim)` and ends on an error overlay, and `?quality=constructor` yields a `q` with no settings. A shared link can break the page for whoever opens it (nuisance only; no code execution, since every callee is a built-in). **Fix**: use `Object.hasOwn(TABLE, key) ? TABLE[key] : fallback`, or `Object.freeze(Object.assign(Object.create(null), {...}))` for the tables. Validate `quality` against `['low','medium','high']`.

### L5. SECURITY.md overstates some controls
- "nginx validation test loads game under CSP": `scripts/deployment/validate-nginx.sh:42-44` only checks that the CSP header is **present**. Nothing loads the app in a browser under that CSP. (Separately I confirmed that `dist/index.html` has no inline script. The only inline content is the `<noscript>` style attribute, which `'unsafe-inline'` allows, and the `data:` favicon, which `img-src data:` allows. No `eval`/`new Function` appears in `dist/assets/*.js`, so the policy should work.)
- "numeric range clamps, entity cap" for saves: true for the top level, but entity internals are unvalidated (see M2).
- "quoted variables" in shell scripts: see M1.
**Fix**: bring the documentation in line with reality, or add the missing checks (e2e run against the nginx container with the CSP console-error check).

---

## Info

- **I1. Debug API in production** (`src/app/game-app.js:18,122`, `src/showcase/runner.js:29`, `src/debug/verify-api.js`). `?debug=1`, `?verify=1` or any `?showcase=` exposes `window.__GAME__`, including the full `session`, `world()`, `issue()` and `runTicks(n ≤ 200000)` (a multi-second tab freeze). Only same-origin script can reach it, and such script already has full access. There is no server, no account and no secret, so the real impact is single-player cheating and self-DoS. Acceptable. Optionally gate it behind `import.meta.env.DEV || import.meta.env.VITE_ENABLE_VERIFY` and a separate verification build. Also note that `?verify=1` disables autosave (`game-app.js:131`).
- **I2. DOM sinks are clean.** The only `innerHTML` write is `src/ui/dom.js:38`, with `ICONS[name] || ICONS.unknown`. The values are project-authored strings. A prototype-key name can only produce built-in function text, never attacker markup. `src/ui/hud.js:456,458` only **reads** `innerHTML` to compare markup. `error-overlay.js` uses `textContent` throughout (`:20,22,28,42`). `h()` (`dom.js:8-31`) sets text via `textContent`/text nodes. `setAttribute` keys are code-controlled. No `eval`, `new Function`, `insertAdjacentHTML`, `document.write` or string-`setTimeout` anywhere in `src/`. The lint test (`tests/unit/lint-rules.test.js:46-50`) enforces this.
- **I3. `safeParse` limits characters, not bytes** (`src/core/validate.js:18`). 2 M UTF-16 code units can be about 6 MB of UTF-8. localStorage quotas bound this in practice. Rename it, or measure with `new TextEncoder().encode(text).length` if file import is ever added.
- **I4. `/RELEASE` is publicly served** (written by `build.sh:25`) and discloses the build time and git short SHA. Harmless for an open game. Deny it or move it to a non-served path if that matters.
- **I5. Deploy retention can delete the rollback target.** The cleanup at `deploy.sh:39-41` protects only `current`, not the release named in `.previous`. With `KEEP_RELEASES=1`, `rollback.sh` then fails with "no release to roll back to". `rollback.sh:18` also trusts the contents of `.previous` (a value of `releases/..` would point `current` at the deploy root). This only matters if the server is already compromised. Protect `.previous` in the cleanup and validate `target` with the same `^[0-9A-Za-z-]+$` regex.
- **I6. `secret-scan.mjs` scans tracked files only** (`scripts/verification/secret-scan.mjs:14`). The untracked `docs/KNOWN_ISSUES.md` and `docs/RELEASE_CHECKLIST.md` are not scanned until someone adds them. `.gitignore` lists `deploy/README.md`, but that file is tracked anyway, which is confusing but harmless.

---

## Verified OK

- Prototype pollution: the `safeParse` reviver drops `__proto__`/`constructor`/`prototype` (`validate.js:21`), and `assertNoDangerousKeys` runs as a second pass. The harness case `protoInEntities` (`"entities":{"__proto__":{"polluted":1}}`) loaded with no pollution.
- Deep nesting: 100k nested arrays are caught as a `ValidationError` (stack overflow inside the try), and the depth limits are 64 and 24 (`validate.js:30`, `index.js:139`).
- Oversized input: `combatPendingHuge` (6.9 MB) was rejected, and `heroDupes` (1249 entities) was rejected by `ENTITY_CAP`.
- Non-finite numbers are rejected by `checkValues` (`index.js:140`). JSON cannot encode NaN/Infinity anyway.
- No hangs: every loaded hostile save ran 100 ticks in under 100 ms. The worst case, 1200 settlers at the cap, took 1.5 s per 100 ticks (≈15 ms/tick), which is a performance-budget issue rather than a hang.
- Settings: `sanitizeSettings` (`src/app/settings.js:284-301`) copies only known keys, clamps numbers, allowlists enums, and restricts bindings to `^[A-Za-z0-9]{1,20}$`. Save-slot metadata is coerced with `String()`/`Number()` and truncated (`storage.js:228`).
- The CSP matches the build output: no inline scripts in `dist/index.html`, and no eval/`new Function` in the bundle. `frame-ancestors`, `object-src 'none'` and `base-uri 'self'` are present.
- `index.html` gets no-cache headers, hashed assets get immutable caching, `server_tokens off` is set, and hidden files outside `/assets/` get 404/403.
- Deploy scripts: all pass `bash -n`, use `set -euo pipefail`, validate the release id (`deploy.sh:27`, `rollback.sh:10`) and `KEEP_RELEASES` (`:21`), limit `rm -rf --` to entries in `releases/` other than `current`, and switch `current` atomically with `mv -T`. `build.sh` refuses to package source maps.
- Tooling paths: `inRepo` (`scripts/verification/lib/paths.mjs:16-20`) rejects paths outside the repo (tested with `/etc/x`, which throws). `safeName` guards the `verify.mjs` `--run/--seed/--quality/--presets` inputs. The `e2e`/`perf` run names are generated, not taken from input.
- Supply chain: `npm audit` reports 0 vulnerabilities. There is one runtime dependency (`three@0.186.0`), plus `vite@8.3.0` and `playwright@1.62.1` for development, and `package-lock.json` is committed.
- Secrets: `secret-scan.mjs` found 0 issues in 184 tracked files. `.env*` is ignored except `.env.example`, which contains placeholders only. `dist/`, `node_modules/` and `.deploy-local/` are not tracked.
- Unit, integration and simulation tests: 56/56 pass.
