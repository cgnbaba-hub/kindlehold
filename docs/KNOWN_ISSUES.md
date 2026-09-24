# Known issues and limitations

This list is kept honest and current. "Measured" items cite the report that shows them.

## Environment / verification limits

- **GPU frame rate is unmeasured.** The development VPS has no GPU; all browser checks run
  on SwiftShader (CPU rendering) at roughly 3 FPS for 1920×1080. The 50/60 FPS targets
  for a mid-range GPU (PERFORMANCE_BUDGET.md, class A) are therefore *not verified*.
  GPU-independent proxies are measured instead (draw calls ≈ 100–115, triangles ≈ 1.05 M in
  the overview presets — within the 1,500 / 1.5 M budgets; see `docs/reports/`).
- Browser verification is slow for the same reason (several minutes per preset).
- No public deployment was performed: no domain or DNS change was authorised. The
  production build and nginx configuration are validated locally in Docker
  (`npm run test:deploy`). Remaining manual step: publish a hostname (see DEPLOYMENT.md §6).

## Gameplay scope (Stage 1)

- One map, one scenario, one hero. Diplomacy, trading, skirmish, weather gameplay effects
  and a map editor are Stage 2 items and not started.
- No fog of war (for either side). The AI reads the world directly; this is documented in
  `src/ai/index.js` and the AI gains no resource or vision advantage from it beyond what the
  player can also see.
- Settlers cannot be ordered directly; they choose work automatically (workplace slots,
  hauling, building, repairing). Priorities cannot be set.
- Measured match lengths (scripted bot, seeds 1337/7/42/99): Story 21.8–26.9 min,
  Normal 23.9–30.2 min, Hard 28.6–32.9 min (Hard slightly above the 15–30 min target).
  The difficulties feel similar in length; Hard's challenge comes from larger waves.
  Human playtesting of any difficulty has not been done.
- The counter triangle holds from 6v6 to 12v12 in the duel harness; at 12v12 Fletchers vs
  Reavers can run to the 120 s limit (Reavers ahead) instead of a clean wipe.
- Melee units can visually overlap while fighting in dense clumps (simple separation only).

## Presentation

- All art is procedural and low-poly by design; there are no skeletal animations
  (figures are segmented and posed procedurally).
- Unit "voice" acknowledgements are wordless synthesized syllables, not recorded speech.
- Music is generative (procedural lute-like plucks and pads), not a composed score.

## Quality gates (final)

- **Visual 7.0 / 10 and gameplay 6.8 / 10 — below the 8.5 gate** after the maximum critic
  rounds (see docs/FINAL_REVIEW.md, docs/critiques/). Open visual items: river depth colour and
  dawn/dusk glints, melee clumping, Beacon Flare glow clipped on slopes, key-art composition,
  grass tint in close-ups. Open gameplay items: shallow labour decisions, short raids, similar
  difficulty curves.
- **Startup time:** 36.6 s to a playable frame for a fresh game in headless SwiftShader (budget
  15 s); dominated by shader compilation and CPU texture generation. Not measured on a GPU.
