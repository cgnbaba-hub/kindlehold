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
- Hard is won by the scripted bot but slowly (28.8 and 40.8 min on seeds 1337 / 42, above
  the 15–30 min target); Normal 26.2 min, Story 20.6 min (seed 1337). Human playtesting of any
  difficulty has not been done.
- Melee units can visually overlap while fighting in dense clumps (simple separation only).

## Presentation

- All art is procedural and low-poly by design; there are no skeletal animations
  (figures are segmented and posed procedurally).
- Unit "voice" acknowledgements are wordless synthesized syllables, not recorded speech.
- Music is generative (procedural lute-like plucks and pads), not a composed score.
