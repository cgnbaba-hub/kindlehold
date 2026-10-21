# Known issues and limitations

This list is kept honest and current (last full review: 2026-10-21). "Measured" items cite the
report or script that shows them.

## Environment / verification limits

- **GPU frame rate is unmeasured.** The development machines have no GPU; all browser checks
  run on SwiftShader (CPU rendering) at a few frames per second. The 50/60 FPS targets for a
  mid-range GPU (PERFORMANCE_BUDGET.md, class A) are therefore *not verified*. GPU-independent
  proxies are measured instead: after 20 bot minutes the overview draws about 145 calls and
  1.2 M triangles, the settlement view about 150 calls and 1.05 M triangles (budgets 1,500 and
  1.5 M; `docs/reports/`, HANDOFF "Paket D").
- Browser verification is slow for the same reason (the 17 e2e tests take about 20 minutes).
- Live at https://kindlehold.js-automata.work. Deploys run on the VPS only (`deploy/`); an
  optional systemd timer deploys every new commit on `main` after tests, build and a health
  check, with rollback (DEPLOYMENT.md).
- Some asset sites are blocked from the cloud sessions (ambientcg.com, polyhaven.com), so
  photo-based CC0 textures could not be tried there.

## Gameplay

- Six campaign chapters, four enemy factions, two heroes (Maren, Wren), diplomacy with a third
  party, free play with random maps. No multiplayer, skirmish lobby or map editor.
- Exploration shroud for the player only (explored/unexplored, no live line-of-sight fog).
  The AI reads the world directly; this is documented in `src/ai/index.js`, and the AI gains
  no resource or vision advantage beyond what the player can also see.
- Labourers can be ordered to gather timber or stone by hand; building, hauling and
  workplace jobs stay automatic. Work priorities cannot be set.
- Transport: carriers are a large share of the town (about 45% in a measured game) and
  workshops wait for pickups a third to half of the time. Roads, pack animals or pack frames are
  designed (with prices) but not built yet: waiting for a decision.
- Balance (scripted bot, chapter one, minutes to victory, `scripts/balance-seeds.mjs`):
  Story 8/8 won, about 23 min; Normal 8/8, about 26 min; Hard about 12 of 20 won, about 37 min
  (unfinished counted as 40), with some defeats. Single matches vary by ±10 minutes; compare
  means over many seeds. Human playtesting has been informal.
- The bot builds compactly, so the motivation strains for idle townsfolk and long walks barely
  touch it; their effect on human-built towns is untested.

## Presentation

- Buildings and characters are KayKit models (CC0), baked to vertex colours; procedural models
  remain as the "classic" style and as the fallback. The KayKit pack has 17 buildings, so the
  farm and the Fisher share a house, and so do the Bakery and the Saltworks; roof colour and
  props tell them apart.
- Terrain textures are procedural (tileable noise with relief, macro variation and worn paths).
- Unit "voice" acknowledgements are wordless synthesized syllables, not recorded speech.
- Music is generative (procedural lute-like plucks and pads), not a composed score.

## Quality gates (stage 1 review, 2026-09-24)

- **Visual 7.0 / 10 and gameplay 6.8 / 10, below the 8.5 gate** after the maximum critic
  rounds (docs/FINAL_REVIEW.md, docs/critiques/). Much has changed since (modelled figures and
  buildings, lighting, longer chains, campaign); no new critic round has been run.
- **Startup time:** measured 2026-10-21 in headless SwiftShader: 19–21 s to a playable frame on
  High, 11 s on Low (budget 15 s; 36.6 s at the stage 1 review). The session is built after
  about 5 s; the rest is shader compilation for the first frames. Not measured on a GPU.

## Fixed

- **2026-10-21: modelled buildings never lit their windows at night (fixed).** The baker
  flagged a palette cell that no model uses as glass; the glow quads were also transformed
  twice. See HANDOFF, "Modellierte Gebäude".
- **Melee clumping (no longer seen).** Measured 2026-10-21 in 10-vs-10 and 20-vs-20 melee: no two
  allies closer than 0.64 m over a minute of fighting (separation keeps 1.8 m between allies, 1.1 m
  to foes).
- **2026-10-20: soldiers stalled at shared path corners (fixed for soldiers).** A squad pushed
  itself off a common waypoint for up to 40 s. Settlers keep the old behaviour on purpose: the
  same fix eased the economy measurably (GAME_DESIGN, "a harder Hard").
- **2026-09-24: ear-splitting sound on first click (fixed).** The lute "pluck" used a feedback
  delay loop whose loop gain exceeded 1 (0.985 feedback × lowpass resonance), so every music
  note grew exponentially. Measured output peak before the fix: 15,613,984 (linear full scale).
  The pluck is now feedback-free and the output has a limiter plus a hard ceiling (−6 dBFS).
  Measured peak after the fix: 0.332. Guarded by `npm run test:audio`.
