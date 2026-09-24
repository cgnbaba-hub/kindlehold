# Kindlehold — Final Review (Stage 1 vertical slice)

Date: 2026-09-24 · Commit reviewed: see `docs/STATUS.json → lastVerifiedCommit`.

**Verdict: the vertical slice is functionally complete and verified, but it does NOT pass the
8.5 quality gates.** Final independent critic scores: **visual 7.0 / 10** (after the maximum of
four critic rounds: 5.7 → 6.2 → 6.6 → 7.0) and **gameplay 6.8 / 10** (5.8 → 6.4 → 6.8, no blockers
left). Per the project rules the affected subsystems are recorded as *blocked below gate* with
their real scores; no pass is claimed. The first accepted vertical slice was therefore **not
tagged**.

## What works (with evidence)

| Area | Evidence |
|---|---|
| Starts from documented commands | README / DEPLOYMENT; `npm run dev`, `npm run build && npm run preview` |
| Tutorial understandable without source code | Objectives with hints and highlighted buttons; e2e `new-game-tutorial-flow` drives it through the real UI; gameplay critic R3 tutorial 7.0 |
| Establish a settlement; gather, transport, process, consume | Physical labourers, work cycles, hauling, provisions → iron chain; `tests/simulation/economy.test.js` |
| Population, housing, labour, economy drive decisions | Housing cap, meals, stability, pause-work, recruitment consumes settlers |
| Construction visible and functional | Staked sites, rising walls under scaffolding, cancel/refund/demolish/repair; tests |
| Territory matters | Placement restricted to own territory; March Charter expands it; tests |
| Military recruited and commanded | Move / attack / attack-move / patrol / stop / hold / formations / control groups; tests |
| Combat vs an active enemy | Garrison, scouting, gathered raids, retreat, camp defence; counter triangle regression-tested 6v6 and 10v10 |
| Hero | Maren Ashgrove: passive aura, two abilities with cooldowns, targeting previews, audio/visual feedback |
| Complete match can be won or lost | Scripted bot wins on Story/Normal/Hard (21.8–32.9 min); defeat tests; victory/defeat screens |
| Save and load | Round-trip determinism, migration, hostile-save rejection, load smoke test; e2e quick save/load |
| Original visuals and audio | All procedural/project-authored (ASSET_REGISTER.md); procedural WebAudio |
| Automated tests | 72/72 `node --test` (unit, integration, deterministic simulation) |
| Screenshot verification | 12/12 presets pass all gates (`docs/reports/final/`, `docs/screenshots/final/`) |
| End-to-end | 9/9 (`docs/reports/latest-e2e.json`) |
| No critical console errors | 0 console/page errors and 0 failed requests in the final verification run |
| Performance (GPU-independent budgets) | draws 140, triangles 1.25 M, 12 textures, 73 geometries, heap 36 MB flat, sim 0.17 ms/tick mean (budget 4) — `docs/reports/latest-perf.json` |
| Asset licences | 0 unregistered assets; no third-party assets; three.js MIT |
| Deployment | Atomic releases, rollback, headers, gzip, CSP browser load validated locally in nginx (`npm run test:deploy`) |
| Security | Critic round 1: 0 critical/high; all medium/low findings fixed |

## Where it falls short (honest)

1. **Visual quality 7.0 < 8.5.** Remaining blockers per `docs/critiques/visual-final.md`: river has
   no visible depth colour and shows red glints at dawn/dusk; melee still clumps; the Beacon Flare
   ground glow is a flat disc clipped on slopes; menu key art is a gameplay frame without sky;
   grass still reads yellow-lime in close-ups.
2. **Gameplay 6.8 < 8.5.** No blockers, but labour decisions are shallow (5.5), raids are short
   (36–54 s), and the difficulty levels feel alike (`docs/critiques/gameplay-round3.md`).
3. **GPU frame rate not measured** — no GPU on the VPS; SwiftShader gives 1.7–3 FPS at 1080p.
4. **Time to ready exceeds budget in class B:** 36.6 s for a fresh game (High quality,
   SwiftShader) vs the 15 s budget; the raid reference state takes 46 s including 16 minutes of
   pre-simulated game time. Shader compilation and procedural texture generation on the CPU dominate.
5. **Not publicly deployed** — no domain/DNS was provided. The only remaining infrastructure step
   is to add a public hostname (e.g. a Cloudflare Tunnel route) for the nginx container
   (DEPLOYMENT.md §6).
6. No human playtesting has been done; balance evidence comes from the scripted bot and critics.

## Criteria (final critic view)

| Criterion | Assessment |
|---|---|
| First-launch experience | Engine-rendered key art menu, difficulty picker, clear first objective |
| Tutorial clarity | Good: hints with live key bindings, highlighted buttons |
| Settlement readability | Improved (distinct roofs, outlines); still busy at overview |
| Economy feedback | Stall markers, stall texts, aggregated hints, rates in the ribbon |
| Construction satisfaction | Rising walls with scaffolding, completion dust + chime |
| Unit control | Complete command set, formations, groups bar |
| Combat readability | Faction discs, counter-hit bursts; melee still clumps |
| Hero usefulness | Abilities decide raids (critic-measured) |
| Enemy behaviour | Gathers visibly, varies targets, retreats, finite reserves |
| Visual coherence | 7.1 (critic) |
| Audio coherence | Procedural; not independently scored |
| Day and night | Rose-gold dawn, amber dusk, moonlit night; long dawn shadows remain |
| Performance | GPU-independent budgets pass; GPU FPS unmeasured; startup slow on CPU rendering |
| Save/load reliability | Deterministic round trip, hostile saves rejected |
| Error recovery | Recoverable overlays for critical failures, missing WebGL, failed loads; audio degrades silently |
| Originality | Original setting, names, dialogue, designs; no third-party content |
| Asset compliance | Complete register; 0 unregistered |
| Hostinger deployment readiness | Ready; public hostname step outstanding |

## Recommended next steps

Visual: water depth/shore colour ramp from the heightfield, terrain-projected ability decals,
composed key art with sky, tighter grass palette. Gameplay: labour priorities, multi-stage raids
with siege objectives, stronger difficulty differentiation. Then re-run both critics.
