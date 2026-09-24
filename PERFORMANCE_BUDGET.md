# Performance Budget

Budgets are defined **before** feature work. Measured values are recorded in
`docs/STATUS.json` and in per-run reports under `docs/reports/`. Nothing here is a
measurement.

## Reference scenario

`?verify=1&seed=1337&preset=enemy-raid` — the slice map mid-game: Keep + 14
buildings, ~40 settlers, ~24 player soldiers, ~20 enemies fighting, full vegetation,
day-night running, all effects enabled at *High* quality.

## Target hardware classes

| Class | Definition | Target |
|---|---|---|
| **A: mid-range desktop GPU** (e.g. GTX 1660 / RX 6600 class, 1920×1080) | player target | ≥ 50 FPS, prefer 60 |
| **B: VPS headless Chromium, SwiftShader software GL, 2 vCPU** | the only hardware available to CI here | used for *relative* regressions, draw calls, triangles, sim cost; FPS is informational only |

Class A cannot be measured in this environment (no GPU on the VPS). Budgets that
depend on GPU speed are therefore verified indirectly through the GPU-independent
proxies below, and the limitation is recorded in `docs/KNOWN_ISSUES.md`.

## GPU-independent budgets (hard gates, measured in class B)

| Metric | Budget |
|---|---|
| Draw calls per frame (reference scenario, High) | ≤ 1,500 (target ≤ 400) |
| Triangles per frame | ≤ 1,500,000 |
| Live textures | ≤ 96 |
| Live geometries | ≤ 400 |
| Shadow-map size | ≤ 2048² (High), 1024² (Medium), off (Low) |
| Point lights active | ≤ 8 |

## CPU budgets

| Metric | Budget (class B, measured) |
|---|---|
| Simulation step, reference scenario | mean ≤ 4 ms, p95 ≤ 8 ms |
| Path requests processed per tick | ≤ 12 (queued beyond) |
| A* node expansions per request | ≤ 6,000 (partial path beyond) |
| Render-side JS per frame (excluding GL) | mean ≤ 6 ms |
| Frame time p95 at 1920×1080 class A | ≤ 20 ms (unmeasurable here) |

## Memory and entities

| Metric | Budget |
|---|---|
| JS heap after 10 min reference play | ≤ 250 MB, no monotonic growth > 10 MB/min |
| Entities (all kinds) | hard cap 1,200 |
| Particles | pool of 1,500 (High), 700 (Medium), 300 (Low) |
| Event listeners per event name | ≤ 64 (warn above) |
| Save file | ≤ 2 MB (rejected above) |

## Payload

| Metric | Budget |
|---|---|
| Initial JS (gzip) | ≤ 350 KB |
| Total production payload (gzip) | ≤ 2 MB (the game ships no binary art: all content is procedural) |
| Time to `__GAME_READY__` (class B, local) | ≤ 15 s |

## Rules

- No allocation in per-frame hot loops (reuse vectors/matrices; pooled particles).
- No full-scene traversal per frame (`scene.traverse` banned in render loops).
- Instancing for trees, rocks, grass, figures, fields; merged geometry per building type.
- Simulation never depends on frame rate (fixed 20 Hz tick).
- Quality selector (Low / Medium / High) scales shadows, particle pool, grass
  density, pixel ratio and antialiasing.
