# Decisions and assumptions

Format: `D-### (date) — decision. Why. Consequence.`

- **D-001 (2026-09-24)** — Project lives in `/root/kindlehold`, not directly in `/root`.
  `/root` is the VPS home directory and contains unrelated projects (OpenClaw notes,
  stackr, borak-lose, …); the "current folder" was therefore treated as the parent and
  a dedicated project folder was created. No existing files were modified.
- **D-002** — Title *Kindlehold*, setting *Harrowmere March*, factions *Hearthbound* /
  *Rustfang Reavers*, hero *Maren Ashgrove*, commander *Vharek the Tollbreaker* — all
  original to this project.
- **D-003** — Three.js **0.186.0** (r186, latest on npm at start), Vite **8.3.0**,
  Playwright **1.62.1** (pinned to match the Chromium build r1234 already present in
  `~/.cache/ms-playwright`, avoiding a 150 MB download).
- **D-004** — Tests use Node's built-in `node:test` runner instead of Vitest/Jest:
  one fewer dependency, and the simulation is pure ES modules that run in Node.
- **D-005** — Fixed 20 Hz simulation tick. RTS-scale movement does not need more;
  it keeps sim cost low on the 2-vCPU VPS used for verification.
- **D-006** — All art and audio are procedural/project-authored at runtime
  (geometry, canvas textures, WebAudio synthesis). Reasons: guaranteed licence
  clarity, tiny payload, deterministic screenshots. External CC0 sources are
  reachable (checked Poly Haven API, Kenney) and may be added later with a register row.
- **D-007** — Agent orchestration: the Claude Code `Agent` tool (subagents) is
  available in this environment; `.claude/agents/*.md` role definitions are created.
  Builder work is executed **sequentially by the integrator session following the
  ownership model** (one folder per role, CCR process), because parallel builders on
  a shared 2-vCPU VPS with one dev server would contend for the same build/verify
  loop and cost budget. **Critics are run as independent read-only subagents** so
  that scores do not come from the builder that wrote the code.
- **D-008** — Performance: the VPS has no GPU; headless Chromium uses SwiftShader.
  GPU FPS targets (class A) cannot be measured here; GPU-independent proxies (draw
  calls, triangles, sim ms) are hard gates, FPS is reported as informational.
- **D-009** — Deployment validation runs the repository's nginx config inside the
  existing local `nginx:1.27-alpine` Docker image bound to `127.0.0.1` only. The host
  has no nginx installed and other projects' containers are left untouched. No public
  DNS / tunnel changes are made (no domain was provided).
- **D-010** — Shadows: one camera-fitted directional shadow map instead of cascaded
  shadows. The RTS camera has a bounded view depth; a fitted single map gives
  comparable quality at lower cost.
- **D-011** — World ids are integers from a monotonic counter in the world object;
  iteration uses sorted id arrays for determinism.
