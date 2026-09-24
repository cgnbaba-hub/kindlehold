# Gameplay critique, round 2 (gameplay-critic)

Date: 2026-09-24. I re-measured every claim instead of trusting the commit message (`923dcd0`, "Gameplay iteration 1").

**Evidence.** All runs were on the working tree. That tree includes an uncommitted change to `src/units/sim.js`: `SEP_RADIUS` goes from 0.75 to 0.85, and melee units close in on ring slots around their target.
- `npm test`: 66/66 pass, including the new `tests/simulation/counters.test.js`.
- `node scripts/balance-duels.mjs 6` and `node scripts/balance-duels.mjs 10`.
- `node scripts/econ-diag.mjs 3,6,10`.
- Seven full bot matches (45-minute cap) through a wrapper around `bot-run`. The wrapper also:
  - counts every `alert` bus event
  - tracks the Keep's minimum HP and when provisions first reach 0
  - logs `ai:gather` and `ai:raid-delayed`
- Scratchpad experiments (not committed):
  - `keep.mjs`: siege time on an undefended Keep
  - `hero.mjs`: hero impact
  - `kite.mjs` / `kite2.mjs`: army compositions and kiting exploits
  - `pause.mjs`: the pause-work behaviour
- No browser was started, because of the CPU constraint. Only the screenshots taken before the gameplay commit exist, so visual claims are **unverified**.

## Scores

| # | Criterion | Round 1 | Round 2 | Why it moved |
|---|---|---|---|---|
| 1 | First-launch experience & tutorial clarity | 6.0 | **6.5** | Hero keys are correct, and "Fletchers beat shields" is now true. The command grid is still icon-only, and the hint letters are hard-coded. |
| 2 | Economy feedback (chain, stall reasons, pacing) | 5.5 | **6.0** | Stall alerts and markers exist, and there is a pre-meal food warning. The alerts are repetitive and hard to act on. The minute 5–12 dead stretch is unchanged. |
| 3 | Population / housing / labour decisions | 5.0 | **5.5** | Pause-work exists. In practice it redistributes workers to other buildings rather than creating labourers, and there is no reserve control. |
| 4 | Construction satisfaction | 6.5 | **6.5** | No change. |
| 5 | Unit control | 6.5 | **6.5** | Auto-kiting was added. The Move button, the control-group bar and select-all are still missing. |
| 6 | Combat readability & counters | 4.5 | **6.0** | The counter triangle now holds at 6v6 and 10v10 and has tests. Readability is unverified visually, and the fights are still a blob. |
| 7 | Hero usefulness | 6.5 | **7.0** | Decisive: with abilities she turns a wiped army into a 5/6-survivor win. She is still downed 2–5 times per Hard match. |
| 8 | Enemy behaviour | 5.5 | **6.5** | Raids form only from the garrison and have a visible gather phase. Harassment now delays raids. Wave 2 happens. Raids still last about 40 s and hit the same Lodge repeatedly. |
| 9 | Scenario pacing & win/lose conditions | 6.5 | **6.5** | The Keep is no longer paper, and Hard is no longer lost. Instead **Hard never ends**: a 45-minute stalemate on all 3 seeds. Normal got slightly longer, to 20–25 min. |
| 10 | **Overall gameplay (slice)** | **5.8** | **6.4** | All four round-1 blockers are resolved as stated. One new pacing blocker appeared on Hard, and most polish items are only partly addressed. |

**Overall gameplay score: 6.4 / 10.** Real, measurable progress:
- the counter triangle is now true
- the Keep takes over a minute to fall instead of 17 s
- raids respond to what the player does
- the tutorial names the right keys

The slice is now a "good prototype" on Normal and Story. It is held back by:
- Hard, which turns into an endless war of attrition
- a feedback layer that is noisy rather than clear: about 2.5 alerts per minute, two-thirds of them the same "is full" line
- an unchanged dead stretch in the mid-game economy

## Evidence summary

| Run | Result | Time | Timeline notes | Keep min HP | Provisions first 0 | Alerts (per min, max in any 60 s) |
|---|---|---|---|---|---|---|
| normal 1337 | victory | 24.2 min (r1: 21.0) | warning 14.0 · gather 16.0 · wave1 16.3, 9 raiders, retreat 16.95 · **wave 2** 21.9 · Warhall 24.2 | 2200 (untouched) | 22.0 min | 63 (2.6, 7) |
| normal 7 | victory | 20.3 | warning 13.6 (triggered by arms) · wave1 16.0 · retreat 16.6 | 2200 | never | 45 (2.2, 6) |
| normal 42 | victory | 24.9 | wave1 16.3 · **wave 2** 22.0 · Warhall 24.9 | 2200 | never (28 at 24 min) | 55 (2.2, 7) |
| story 1337 | victory | 18.8 | wave1 16.2 (6 raiders) · retreat 16.7 | 2200 | **13.3** (3 left at 16 min, during the gather) | 52 (2.8, 8) |
| hard 1337 | **no result at 45 min** | 45+ | warning 13.0 · wave1 15.1 (11) · 6 waves, all repelled · 4× hero downed · strike never succeeds | 2200 | never | 102 (2.3, 7) |
| hard 42 | **no result at 45 min** | 45+ | wave1 15.1 · Lodge destroyed 16.5 · pop 30→22 · 6 waves · timber 1 from 28 min to 45 min | 2200 | never | 112 (2.5, **12**) |
| hard 7 | **no result at 45 min** | 45+ | Quarry destroyed 20.9 · 6 waves · 5× hero downed · timber 3 / stone 7 from 24 min on | 2200 | never | 103 (2.3, 6) |

Alert mix for normal 1337: 43 of 63 are stall alerts.
- "Farmstead is full…" ×18
- "Woodcutter's Lodge is full…" ×14
- "Quarry is full…" ×5
- "nothing left" ×4
- "Iron Mine is full" ×2

On hard 1337: "Farmstead is full" ×36 and "Woodcutter's Lodge is full" ×14. The scout alert fires 13 times in 45 min.

**Counter duels** (`balance-duels.mjs`; rows are the player's units, columns the enemy's):
```
6v6       brute          reaver         slinger          10v10     brute         reaver        slinger
shield    3-0 (41s)      5-0 (16s)      0-3 (31s)        shield    4-0 (48s)     8-0 (20s)     0-5 (27s)
blade     0-2 (27s)      4-0 (13s)      5-0 (14s)        blade     0-3 (31s)     7-0 (13s)     8-0 (15s)
fletcher  5-0 (18s)      0-3 (15s)      3-0 (18s)        fletcher  8-0 (20s)     0-3 (25s)     5-0 (21s)
```

**Keep siege** (`keep.mjs`: undefended Keep, raiders ordered straight at it, no player units nearby):

| Attackers | Keep | Time to destroy | Raiders killed |
|---|---|---|---|
| 9 reavers | unlit | 64 s (r1: **17 s**) | 0 |
| 9 reavers | lit | 70 s | 2, by Keep archers |
| 9 of the first-raid mix | lit | 106 s | 3 |
| 11 of the Hard mix | lit | 81 s | 2 |
| 19 reavers | lit | 42 s | – |

The Keep is sturdy but not invulnerable.

**Army compositions** against the first-raid mix of 9 (`kite.mjs`):

| Player army | Survivors |
|---|---|
| 9 blades | 6/9 |
| 3 shield / 3 blade / 3 fletcher | 6/9 |
| 5 shield / 4 fletcher | 5/9 |
| 9 shields | 1/9 (54 s) |
| 9 fletchers | 0/9 |

**Hero impact** (`hero.mjs`): 6 soldiers (2 of each type) against the first-raid mix of 9.

| Setup | Result |
|---|---|
| no hero | army wiped, 6 raiders left |
| hero, no abilities | 3 soldiers survive |
| hero with Flare + Kindle | 5 soldiers survive, raid wiped in 15 s |

**Pause-work** (`pause.mjs`, normal 1337 at 8 min): pausing the Lodge takes its workers to 0 with `stall='paused'`. The labourer count stays **8 → 8**, because the freed foresters became a farmer and a miner. Resuming restores 2 workers.

---

## Verified fixed

1. **Round-1 B1: hero keys.**
   - The hint now reads "F = Beacon Flare, G = Kindle the Line" (`src/missions/scenarios/harrowmere.js:62`), which matches `abilityFlare: 'KeyF'` and `abilityKindle: 'KeyG'` (`src/input/bindings.js:7`).
   - `ABILITIES.*.key` was replaced by `binding` (`src/heroes/index.js:13,15`).
   - Remaining gap: the hint is still a literal string, so it goes stale if the player rebinds keys. There is no test. See P8.
2. **Round-1 B2: the Keep falls in seconds.**
   - Changes: Keep HP 2200, `damageTaken 0.7`, `MELEE_VS_BUILDING 0.5`, and Keep archers that fire when lit (`buildings/defs.js:31-32`, `combat/index.js:15,265-267`).
   - Raiders marching on a target building no longer stop at every other building (`combat/index.js:115-118`).
   - Result: 17 s became 64–106 s, and the Keep was never hit in any of the 7 bot runs.
   - Regression check passed: the Keep is not invulnerable (19 reavers take it in 42 s).
3. **Round-1 B3: Hard lost by following the objectives.**
   - The Hard warning moved to 13:00 and the first raid dropped from 13 to 11 units. The result: 0 defeats in 3 seeds.
   - The raid still arrives at 15.1 with 0–4 soldiers. Hard now survives because the Keep and Keep archers hold, not because the objective path prepares the player: on hard 42, `stone-iron` finished at 13.2, after the 13.0 warning.
   - Side effect: see new blocker B1.
4. **Round-1 B4: false counter triangle.**
   - Changes: percentage armour, 5% per point with a 75% cap (`combat/index.js:24-32`); ranged vs defensive raised to 2.0×; Brute HP 220 → 180; auto-kiting (`units/sim.js:272-286`).
   - All three counters now win and all three reverse match-ups lose, at both 6v6 and 10v10. This is locked in by `tests/simulation/counters.test.js`.
   - Regression checks passed:
     - Kiting is not exploitable: backpedal speed is 3.8 × 0.7 = 2.66 m/s, slower than every melee enemy, and a lone fletcher still loses to a reaver.
     - Mixed armies are viable (3/3/3 ≈ 9 blades).
5. **Round-1 P4: raid topped up from nowhere.**
   - `startRaid` now uses only the living garrison, and postpones up to 2 × 45 s when the garrison is below 60% of the wanted size (`ai/index.js:64-69`). `ai:raid-delayed` fired 2–4 times per Hard run.
   - There is a 20 s gather phase at a gather point in front of the camp, with a danger alert.
6. **Round-1 P1, partly: stall reasons invisible.** Stall reasons now raise a throttled alert with a jump-to location (`production/index.js:614-623`). An amber "!" marker was added in the selection view, but the marker was **not visually verified**.
7. **Round-1 P5, partly: raids too short and wave 2 never came.** Wave 2 now arrives before victory in 2 of the 3 Normal runs (21.9 and 22.0 min). Each raid still lasts only 33–45 s.
8. **Round-1 P2, partly: food ran out silently.**
   - Farmers now carry 4 per trip instead of 3, and a warning fires 30 s before a meal the stores cannot cover.
   - Provisions hit 0 in 2 of 5 Normal/Story runs, down from 3 of 3 Normal runs in round 1. But Story hits 0 at 13.3 and sits at 3 as the raid gathers.

---

## BLOCKERS (ranked)

**B1. Hard never ends: 45-minute stalemates on 3 of 3 seeds, well past the 15–30 min target.**
- **Evidence:** hard 1337, 42 and 7 each ran 6 raid waves and repelled all of them. The bot's strike force (8–11 soldiers) dies at the camp every time, and Maren was downed 4, 2 and 5 times. Nothing ends the match.
- **Why:**
  - Hard spawns a raider every 24 s up to `garrisonCap 16 + 2·wave` (`ai/index.js:14, ~215`), and the camp heals raiders by 2 HP/s.
  - Player armies are capped by 46 population and by iron.
  - The forests near the Lodges run out: timber sits at **1–4 from about minute 24–28** (hard 42/7/1337, and 3 on normal 1337 at 24 min). Only an alert that is easy to miss says "Woodcutter's Lodge has nothing left to work nearby".
- The requested wave growth of 4 per wave is also meaningless: from wave 3 on, the wanted size (27–31) always exceeds the garrison cap (about 22), so every wave postpones twice for 90 s and then marches at whatever cap allows.
- **Fix:**
  - Make the Warhall's reinforcements finite or slowing. For example, stop respawning while the hall is below 60% HP, or grow `spawnInterval` by 25% per repelled wave.
  - Stop camp healing while player units are within 40 m.
  - Cap `growth` so that `firstRaid + wave·growth ≤ garrisonCap + 2·wave`.
  - Add a "forest exhausted: build a new Woodcutter's Lodge near trees" objective hint with a camera jump, plus a timber-trend warning.
  - Re-run `bot-run hard 1337/42/7`. The goal is at least one bot victory, or at least a decisive end, inside 35 min.
  - Update `docs/KNOWN_ISSUES.md`. It still says Hard "loses at ~15 min", which is now false.

## POLISH (ranked)

**P1. Alerts are repetitive and not actionable. The new stall alerts dominate the feed.**
- **Evidence:**
  - 45–112 alerts per match, at 2.2–2.8 per minute, with up to 12 in one minute (hard 42, during a raid).
  - About 65–70% are "\<building\> is full — more free labourers are needed to carry goods": Farmstead ×18 to ×36 per match, repeated for each Farmstead every 90 s (`production/index.js:620`).
  - The player cannot directly create "free labourers". The only real levers are more Cottages, or pausing another building, and the alert mentions neither.
  - The scout alert fires 13 times per Hard match.
- **Fix:**
  - Alert only after 20 s or more of continuous stall.
  - Throttle per stall *type* (not per building) to one every 3 min, and merge them ("2 Farmsteads and a Lodge are full").
  - Name the lever: "…build a Cottage or pause a Lodge to free hands".
  - Demote repeat scout sightings to `info` after the first.

**P2. Hauling limits growth, and food still runs out at the worst moment.**
- **Evidence:**
  - On normal 1337, provisions hit 0 at 22.0 min, just as raid 2 starts (`ai:wave` at 21.9), while "Farmstead is full" alerts keep firing. Food is produced but not hauled.
  - On story 1337, provisions hit 0 at 13.3 and sit at 3 at 16 min, as the raid gathers.
  - econ-diag at 10 min: the Lodge, Quarry and both Farmsteads are `storageFull`, and the Iron Mine is `noInput` (no provisions).
  - The new warning (`population/index.js:97`) only fires 30 s before a meal that will fail. That leaves no time to build a farm (build time plus a 30 s grow cycle).
- **Fix:**
  - Show a "food lasts about N min at current rates" line on the provisions tooltip, and warn below 3 min.
  - Pause arrivals when the net provision rate is negative.
  - Give the Keep 2 porters (hauling-only workers), or let Farmsteads deliver their own goods when the Keep is within 30 m.

**P3. Minutes 5–12 are still a dead stretch. Round-1 P6 is unchanged.**
- **Evidence:**
  - econ-diag at 6 min: the mine site is **0%** built with nothing delivered (round 1: 12%), and the second Farmstead is at 0%.
  - `stone-iron` is done at 10.6–12.0 on Normal and 12.1–13.2 on Hard (round 1: 11.8).
  - Timber is 5–21 at 2 min and 6–17 at 4 min in every Normal run.
- **Fix:** start with about 110 timber or make the Lodge yield 4 per trip, and add the mid-phase beat proposed in round 1 (scout dialogue at about 4 min plus a "Barracks early?" nudge).

**P4. Raids are still short, and they repeat the same target.**
- **Evidence:**
  - Every wave is repelled 33–45 s after `ai:wave`; `RETREAT_AT` is still 0.35 (`ai/index.js:20`).
  - On Hard, waves 3–6 all target the same Woodcutter's Lodge (ids 359, 458 and 349 across seeds). Once the player's army is parked there, the raids stop mattering.
  - The alert says "Rustfang raid! 11 **reavers** are marching…" even when slingers and brutes are in the mix (`ai/index.js:82`).
- **Fix:**
  - Retreat at 25% on Normal and Hard.
  - Make `pickRaidTarget` avoid the previous wave's target, and prefer undefended buildings (fewer than 3 player units within 20 m).
  - Say "raiders" in the alert, or list the classes ("5 reavers, 3 slingers, 1 brute").

**P5. The hero is still downed during assaults. Round-1 P9 is unchanged.**
- **Evidence:** `hero:downed` fires in normal 1337 and normal 42, and 2–5 times per Hard run, always at the camp (x ≈ 54–75). She recovers at the Keep, 140 m away.
- **Fix:** as in round 1 (a Cleave telegraph, +100 HP, or recovering in place when allies are within 10 m), and have the bot/AI avoid pulling her into Vharek alone.

**P6. Pause-work does not do what its tooltip says, and there is still no labourer reserve.**
- **Evidence:** the tooltip says "Send its workers back to labouring". In `pause.mjs` the labourer count stayed at 8, because `assignJobs` immediately re-slots the freed workers into other vacancies (a farmer and a miner). It works as a crude priority tool, which is useful but not what the player is told.
- **Fix:** either reword it ("Workers move to other jobs or labouring"), or add the Keep-panel "labourer reserve" stepper from round 1 so the player can really trade production for hauling.

**P7. Combat readability is unverified, and the fights are probably still a blob.**
- **In code:** blades now wear a lighter coat with no shield, bars are bigger (1.5 m), a gold glint marks counter hits, and melee closes in on ring slots (uncommitted).
- **Evidence:** `docs/screenshots/round1/combat-overview.png` still shows a 2 m cluster. No post-fix combat screenshot exists (`docs/screenshots/round2/` held only `dawn-overview.png` at the time of writing).
- **Still missing:** owner-coloured ground rings, damage or "effective!" numbers, and wider formation spacing.
- **Fix:** capture `combat-overview` after the change and judge it; add owner rings.

**P8. The hint key letters are hard-coded.**
- `harrowmere.js:62` is a literal "F …, G …". A player who rebinds keys in Controls gets stale text again.
- **Fix:** substitute `{abilityFlare}` placeholders through `keyLabel(bindings())` in `hud.js:180`, and add the round-1 test that scenario text contains no stale key letters.

**P9. Control and UI gaps are unchanged (round-1 P8 and P11).**
- The command grid is icon-only, including the new Pause button.
- The Move button just shows a toast (`hud.js:337`).
- There is no control-group bar and no select-all-army key.
- **Fix:** as in round 1.

**P10. Blades are the best generalist, and shields underperform in real mixes.**
- **Evidence:** against the first-raid mix, 9 blades leave 6/9 survivors while 9 shields leave only 1/9. Shields lose 0–3 to slingers and grind 41–48 s against brutes.
- It is not a dominance problem, since 3/3/3 matches pure blades. But the "sturdy line" unit feels weak.
- **Fix:** give Shieldbearers +1 armour or 15% ranged damage reduction (a "shield wall" vs slingers), so they read as the front line rather than just the anti-reaver pick.

**P11. The victory screen evidence is still a fixture (round-1 P10), and KNOWN_ISSUES is stale on Hard.** Re-capture the victory screen from a bot save, and update the doc.

## Regression checks (asked for explicitly)

| Check | Result |
|---|---|
| Raids too weak or delayed forever? | **No.** Postponement is capped at 2 × 45 s, then the raid marches with the garrison. The raid is empty only if the garrison is wiped, which is the intended reward for harassing the camp. |
| Keep invulnerable? | **No.** It falls in 42–106 s undefended. |
| Kiting exploit? | **No.** Backpedal is slower than every melee enemy, and fletchers do not fire while backpedalling. |
| Pause-work abuse? | **None found.** The toggle only re-slots workers, and output stock stays in place to be hauled. |
| Alert spam? | **Yes: P1.** The new stall alerts are the dominant source. |
| Match length on Normal | Grew from 20–21 min to 20–25 min. Still inside the target. |
