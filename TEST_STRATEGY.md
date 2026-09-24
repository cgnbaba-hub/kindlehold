# Test Strategy

All tests run with tools already in the repository: Node's built-in test runner
(`node --test`) for logic, Playwright + headless Chromium for browser checks.
No mocking of the systems under test: simulation tests drive the real simulation
through the same command API the UI uses.

| Layer | Location | Runner | Command |
|---|---|---|---|
| Unit | `tests/unit/` | node:test | `npm run test:unit` |
| Integration (module host, save, validation) | `tests/integration/` | node:test | `npm test` |
| Deterministic simulation | `tests/simulation/` | node:test | `npm run test:sim` |
| Visual (screenshot presets + JSON reports) | `scripts/verification/verify.mjs` | Playwright | `npm run verify` |
| End-to-end (menus, tutorial happy path, save/load, error screen) | `scripts/verification/e2e.mjs` | Playwright | `npm run test:e2e` |
| Performance | `scripts/verification/perf.mjs` | Playwright | `npm run test:perf` |
| Deployment (nginx routing, headers, rollback) | `scripts/deployment/validate-nginx.sh` | docker nginx | `npm run test:deploy` |

## Required coverage (Stage 1)

Seeded determinism · fixed timestep · resource production · resource consumption ·
worker assignment · construction costs & completion · technology prerequisites ·
recruitment · combat damage & counters · hero cooldowns · enemy wave triggers ·
victory & defeat · save/load round-trip · save migration · navigation around
obstacles · building placement validity · module failure isolation · missing asset
fallback · main-menu flow · full vertical-slice happy path (scripted, accelerated)
· production build · nginx static routing · reload on nested paths.

## Visual verification loop

`verify.mjs`:
1. Starts Vite (or connects to `--url`), launches Chromium with SwiftShader GL.
2. For each preset: loads `/?verify=1&seed=…&preset=…`, waits for
   `window.__GAME_READY__`, applies camera preset, time of day and tick count
   through `window.__GAME__`, waits two frames, samples FPS for a fixed window.
3. Captures PNG to `docs/screenshots/<run>/<preset>.png` and a JSON report to
   `docs/reports/<run>/<preset>.json` containing console errors/warnings, page
   errors, failed requests, FPS, frame-time p50/p95/p99, renderer info (draw calls,
   triangles, textures, geometries), module health.
4. Exits non-zero if a mandatory gate fails (errors, failed requests, failed modules,
   draw calls/triangles over budget, blank screenshot).

Blank-screen detection: the screenshot's luminance variance must exceed a
threshold, computed in the page from the canvas pixels.

## Human/critic visual review

Screenshots are inspected by a person or a read-only critic agent who records a
score in `docs/critiques/` with evidence. Code inspection alone never passes a
visual gate; screenshots alone never pass a gameplay gate.

## Reference environment limitation

Headless Chromium on the VPS renders with SwiftShader (CPU). FPS numbers from it are
reported but are not representative of GPU hardware (see PERFORMANCE_BUDGET.md).
