# Kindlehold

*The Rekindling of Harrowmere* — an original browser-based 3D medieval settlement-building
and real-time strategy game (Stage 1 vertical slice). Three.js + Vite + plain ES modules.

Rekindle a burnt hearth-keep, rebuild a working economy (timber, stone, iron,
provisions), house and feed your people, research, train soldiers, lead the Lantern
Warden Maren Ashgrove, survive the Rustfang raid and break Vharek's toll fort.

> Kindlehold is an original game. It is inspired only by general conventions of
> economy-focused RTS games; it is not affiliated with, endorsed by, or a remake,
> sequel, remaster or port of any existing game. All content is original or procedurally
> generated (see [ASSET_REGISTER.md](ASSET_REGISTER.md)).

## Quick start

```bash
npm ci                 # Node 20+ (developed with Node 26.7)
npm run dev            # http://127.0.0.1:5180/
```

Production build and local preview:

```bash
npm run build && npm run preview   # http://127.0.0.1:5181/
```

## Controls (default, rebindable in Settings → Controls)

| Action | Input |
|---|---|
| Select | Left-click · drag a box for soldiers · Shift adds · double-click selects the same type |
| Move / attack / rally point | Right-click ground / enemy (context-sensitive) |
| Pan / rotate / zoom | Arrow keys or screen edge · Q / E or middle-drag · mouse wheel or + / − |
| Attack-move · Patrol · Stop · Hold | A · P · S · H (then left-click for A/P) |
| Maren: Beacon Flare · Kindle the Line | F (then left-click target) · G |
| Control groups | Ctrl+1–9 to set, 1–9 to select, double-tap to centre |
| Build menu · Centre selection · Centre Keep | B · Space · Home |
| Game speed · Pause menu | [ / ] · Esc |
| Quick save · Quick load | F5 · F9 (autosave every 2 minutes) |

A full in-game guide is in the main menu (*How to Play*) and [docs/PLAYER_GUIDE.md](docs/PLAYER_GUIDE.md).

## Development

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server (HMR) |
| `npm test` | Unit, integration and deterministic simulation tests (`node:test`) |
| `npm run verify` | Visual verification: 12 screenshot presets + JSON reports (dev server) |
| `node scripts/verification/verify.mjs --prod` | Same against the production build (recommended while editing) |
| `npm run test:e2e` | End-to-end tests through the real UI (production build) |
| `npm run test:perf` | Performance report for the reference raid scenario |
| `npm run test:deploy` | Local nginx deployment validation (Docker) |
| `node scripts/bot-run.mjs normal 1337 40` | Headless full match played by the scripted bot |

Useful URLs:

* `?showcase=<id>` — isolated subsystem scenes: `terrain`, `environment`, `buildings`, `economy`,
  `population`, `units`, `combat`, `effects`, `audio`, `ui`, `scenario` (add `&hour=6` etc.).
* `?verify=1&demo=midgame|construction|battle|hero|raid&seed=1337` — deterministic verification
  session exposing `window.__GAME__`.
* `?debug=1` — normal game flow with `window.__GAME__` for e2e tests; `?start=1` skips the menu.

Architecture, module ownership and contracts: [ARCHITECTURE.md](ARCHITECTURE.md).
Design: [GAME_DESIGN.md](GAME_DESIGN.md) · Art: [ART_DIRECTION.md](ART_DIRECTION.md) ·
Tests: [TEST_STRATEGY.md](TEST_STRATEGY.md) · Performance: [PERFORMANCE_BUDGET.md](PERFORMANCE_BUDGET.md) ·
Security: [SECURITY.md](SECURITY.md) · Status: [docs/STATUS.json](docs/STATUS.json) ·
Decisions: [docs/DECISIONS.md](docs/DECISIONS.md) · Known issues: [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md).

## Testing notes

Browser checks run in headless Chromium with **SwiftShader** (software GL) because the
development VPS has no GPU. They verify correctness, errors, draw calls and triangle
counts; their FPS numbers are informational only. See PERFORMANCE_BUDGET.md.

## Deployment

Static build served by nginx with atomic releases and rollback. Full commands in
[DEPLOYMENT.md](DEPLOYMENT.md); files in [deploy/](deploy/).

```bash
deploy/scripts/build.sh
DEPLOY_HOST=my-vps DEPLOY_ROOT=/var/www/kindlehold deploy/scripts/deploy.sh
DEPLOY_HOST=my-vps DEPLOY_ROOT=/var/www/kindlehold deploy/scripts/rollback.sh
```

## Troubleshooting

| Problem | Fix |
|---|---|
| "WebGL 2 is not available" | Enable hardware acceleration or use a current Chrome/Edge/Firefox/Safari |
| Low frame rate | Settings → Graphics → Medium or Low (fewer shadows, particles, grass) |
| No sound | Click or press a key once (browsers block audio until a gesture); check Settings → Audio |
| Save/Load unavailable | Private browsing may block localStorage; saves live in this browser only |
| Page shows an error card | Use *Load last save* or *Main menu*; details can be copied from the card |
| `npm run verify` hangs on dev server | Use `--prod`: HMR reloads the page while files change |
