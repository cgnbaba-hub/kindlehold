# Gameplay critique, round 1 (gameplay-critic)

Date: 2026-09-24. I checked the builder's claims against evidence instead of accepting them. Evidence came from:
- `node scripts/bot-run.mjs` on normal/1337, normal/7, normal/42, story/1337, hard/1337 and hard/42
- `node scripts/econ-diag.mjs 3,6,10`
- `npm test`: 56/56 pass
- three throw-away Node experiments in the scratchpad (not committed): counter duels, time for raiders to destroy the Keep, hero impact, and an idle player
- screenshots in `docs/screenshots/round1/` and `docs/screenshots/e2e-20260924-101050/`

## Scores

| # | Criterion | Score |
|---|---|---|
| 1 | First-launch experience & tutorial clarity | 6.0 |
| 2 | Economy feedback (chain, stall reasons, pacing) | 5.5 |
| 3 | Population / housing / labour decisions | 5.0 |
| 4 | Construction satisfaction | 6.5 |
| 5 | Unit control | 6.5 |
| 6 | Combat readability & counters | 4.5 |
| 7 | Hero usefulness | 6.5 |
| 8 | Enemy behaviour | 5.5 |
| 9 | Scenario pacing & win/lose conditions | 6.5 |
| 10 | **Overall gameplay (slice)** | **5.8** |

**Overall gameplay score: 5.8 / 10.** The whole loop works from start to finish: rekindle, build, grow, iron, arms, raid, counter-attack, victory or defeat. On Normal and Story it finishes inside the 15–30 minute target (18–21 min). It is well past "functional". Still, a new player would stumble over several things:
- the tutorial names the wrong keys for the hero abilities
- the counter triangle the tutorial teaches doesn't hold up in play
- Hard is lost at about minute 14 if you follow the objectives
- the Keep, which is the loss condition, falls in 17 seconds

## Evidence summary

| Run | Result | Time | Timeline notes |
|---|---|---|---|
| normal 1337 | victory | 21.0 min | growth 5.0, iron 11.8, warning 14.0 (timer), arms 14.4, raid 16.0, retreat 16.7, Warhall 21.0 |
| normal 7 / 42 | victory | 20.5 / 20.2 min | same shape; provisions 0 at 16 min in all three Normal runs |
| story 1337 | victory | 18.3 min | raid of 6 repelled in 36 s |
| hard 1337 | **defeat** | 13.9 min | warning 11.0 with 0 soldiers, raid 12.5, Lodge falls 13.4, **Keep falls 13.9** |
| hard 42 | **defeat** | 14.1 min | iron objective done 11.8 (after the 11.0 warning); Keep falls 14.1; pop 25 → 13 |
| idle player (normal) | defeat | 16.9 min | lose condition fires correctly (`no-one-left`) |

Counter duels, 6 v 6, starting 10 m apart (scratchpad `exp.mjs`):
```
shield v reaver 5-0 | blade v reaver 4-0 | fletcher v reaver 0-6
blade v slinger 5-0 | shield v slinger 5-0 | fletcher v slinger 3-0
fletcher v brute 0-6 | blade v brute 0-4 | shield v brute 0-1 (63 s)
9 reavers kill the Keep (1600 HP) in 17 s
```
Hero impact (6 mixed soldiers vs the first-raid mix of 9, `hero.mjs`):
- no hero: army wiped, 4 raiders left
- hero without abilities: army wiped, 4 raiders left
- hero using Kindle + Flare: **5 soldiers survive, raid wiped**

The abilities decide the fight.

---

## BLOCKERS (ranked)

**B1. The tutorial hint names the wrong hero keys, and Q actually rotates the camera.**
- Evidence: `src/missions/scenarios/harrowmere.js:62` says "Maren: Q = Beacon Flare, W = Kindle the Line".
- The real bindings are `abilityFlare: 'KeyF', abilityKindle: 'KeyG'` (`src/input/bindings.js:7`), with `rotateLeft: 'KeyQ'` (`bindings.js:5`).
- The stale data is `ABILITIES.flare.key: 'Q'` and `kindle.key: 'W'` (`src/heroes/index.js:13,15`).
- The PLAYER_GUIDE, the How-to-Play screen and the command-grid badges (F/G in `ui-1920.png`) are all correct. Only the hint shown during the raid is wrong, which is the moment it matters most.
- The hero experiment shows the abilities decide the raid, so a player who follows this hint rotates the camera instead of casting and loses the fight.
- Fix: generate the hint text from the current bindings (`keyLabel(bindings.abilityFlare)`), and remove or derive `ABILITIES.*.key`. Add a test that no scenario text contains hard-coded key letters that differ from `DEFAULT_BINDINGS`.

**B2. The Keep, which is the defeat condition, falls in seconds.**
- Evidence: 9 reavers destroy the 1600 HP Keep in **17 s** (`exp.mjs`). In hard/1337 the Lodge falls at 13.4 min and the whole game is lost at 13.9 min.
- Why: melee does full damage to buildings (`src/combat/index.js:122-124`). Only ranged damage is reduced (`RANGED_VS_BUILDING`, line 14).
- Attack-move raiders auto-acquire any building within sight on their way to a target (`combat/index.js:88-104`, buildings score +18), so the Keep gets hit incidentally. That makes `TARGET_PRIORITY` keep:3 meaningless (`src/ai/index.js:19`).
- Fix, any combination of:
  - add a `buildingDamageMult` of about 0.35 for melee, or give the Keep armour of about 8 and fortification HP of about 3000
  - raise a full-screen "The Keep is under attack" alert with the camera jump
  - skip raider auto-acquire on the Keep unless it is the raid target or nothing else is within 20 m

**B3. Hard is lost if you follow the objectives.**
- Evidence: both Hard seeds end in defeat at about 14 min. The warning fires by timer at 11.0 (`raidWarningAt.hard`, `harrowmere.js:9`) before the player can finish `stone-iron`: at 11.8 in hard/42, and not reached in hard/1337, where iron was still 0 at 12 min.
- Hard also has 0.8× starting resources and a 20 s arrival interval (`src/population/index.js:18`), so timber is 1–8 for minutes 2–10.
- The raid is 13 units (`src/ai/index.js:15`) against 0–1 soldiers. The design table promises Hard only "+10% enemy HP" as the AI advantage. In practice the timings make it a race the tutorial path cannot win.
- Fix: move the Hard warning to about 13 min, or trigger it on `stone-iron` done plus N seconds with the timer only as a backstop. Alternatively make the first Hard raid 10 with growth +4. Re-run `bot-run hard 1337/42` until the bot wins at least one seed, and document the expected player path.

**B4. The counter triangle taught to the player is false in play.**
- Evidence (duels above):
  - Fletchers "beat shield lines" but lose 0–6 to Brutes and 0–6 to Reavers.
  - Shieldbearers, which are "strong against blades", also beat Slingers 5–0. Shields are the best answer to everything except Brutes, where 6 v 6 is a 63-second stalemate.
- Why:
  - flat armour subtraction (`combat/index.js:25`: `base*counter - armor`) eats most of the 1.5× bonus (fletcher vs brute: 12×1.5−4 = 14 vs 11 on a reaver)
  - ranged units have no kiting, and melee reaches them in about 2 s
  - brute HP is 220 against fletcher damage of 12
- The tutorial and How-to-Play teach "Fletchers beat shields" (`src/ui/menus.js:191`, `harrowmere.js:54`).
- Fix:
  - make the counter apply after armour, or make it 2.0×
  - give ranged units a short "step back when melee is within 4 m" behaviour, or make Fletchers ignore Brute armour
  - reword the hint to "Fletchers, *behind a front line*, beat shields"
  - add a balance test asserting that each counter wins a 6 v 6 duel

## POLISH (ranked)

**P1. Stall reasons can only be found by clicking each building.**
- `EV.PRODUCTION_STALLED` has no UI consumer (grep: it is emitted in production, population and units, but nothing in `src/ui` listens). The reasons render only inside the selection panel (`src/ui/hud.js:256`).
- econ-diag at 10 min shows the Lodge and Quarry both `storageFull` with 7 of 11 labourers busy hauling to sites. The player gets no signal.
- Fix: add a floating amber icon over stalled buildings (`buildings/view.js`), and a throttled alert when a building stays stalled for more than 20 s ("Quarry idle: storage full — more labourers needed").

**P2. The food crash lands exactly on the raid, and the warning comes too late.**
- In all Normal runs provisions hit 0 at 16 min while pop is 43–46: 46 eaters use about 31/min, against about 24/min produced (513 over 21 min). Stability falls 95 → 60–68 during the fight.
- The only alert fires after a missed meal (`population/index.js:99-101`). Arrivals still cost provisions while stock is at least 4 (`population/index.js:82`).
- Fix:
  - show a "food lasts ~N min" projection on the Provisions tooltip, and warn when it drops under 3 min
  - pause arrivals when the net provision rate is negative
  - consider a third farm plot per Farmstead, or making the growth objective suggest a second Farmstead

**P3. The labour economy is fully automatic, so population decisions are shallow.**
- `assignJobs` fills every slot nearest-first and keeps 2 + workplaces/2 labourers free (`population/index.js:116-147`). The player cannot set priorities, pause a workplace or cap workers.
- The only levers are building Cottages and turning settlers into soldiers.
- Fix (cheap): a per-building "pause work / release workers" toggle and a Keep-panel "labourer reserve" stepper. Both give the "hands for economy vs. hands for defence" tension the design promises.

**P4. The raid size ignores what the player does.**
- `startRaid` tops the wave up to full size by spawning fresh units at the map edge (`ai/index.js:62-66`), and the camp heals raiders (`ai/index.js:189-194`).
- So harassing the camp or killing the scout never makes the raid smaller. The documented "gather point" does not exist: raiders attack-move straight from the camp (`orderRaid`, line 77).
- Fix: cap the top-up at about 50% of the size, or delay the raid when the garrison is depleted. Stage the raid at a visible gather point near the Tollford for 20–30 s so a scouting player can pre-empt it.

**P5. The raid is over too fast to feel like a set piece.**
- Retreat triggers at 35% remaining strength (`RETREAT_AT`, `ai/index.js:20`). Waves were repelled in 42 s (normal/1337: 16.0 → 16.7) and 36 s (story).
- The second wave never comes before victory in any run. The "later waves every ~4 min" promised in GAME_DESIGN never happen on the objective path.
- Fix: set the retreat at 25% on Normal and Hard. Start the regroup timer at retreat instead of arrival, or trigger wave 2 when the player's army leaves territory, so the counter-attack risks the home base.

**P6. Minutes 5–11 are a dead stretch waiting on timber and iron.**
- econ-diag at 6 min: the mine site is 12% built with timber 6/30 delivered, and the second farm is at 0%. The bot sees timber at 0–6 for minutes 2–8.
- The iron objective takes 6.3–6.8 min on Normal. The warning is **always** timer-driven (14.0 in all Normal runs; `arms` is done at 14.3–14.5, right after), so the "6 soldiers or minute 14" trigger never actually fires early.
- Fix: raise the starting timber to about 110, or make the Woodcutter's Lodge yield 4 per trip. Add a mid-phase beat, for example the scout sighting at 4 min (it already exists but is silent before 60 s) turned into a dialogue line with a "build a Barracks early?" nudge.

**P7. Combat readability.**
- `combat-overview.png` and `hero-ability.png`: the fights are a single 1–2 m blob. Shieldbearers and Bladesmen share the blue tunic and steel helm, and the class silhouettes differ only in held props. Enemy classes are distinguished only by head gear.
- Health bars are about 40 px at 1920p with no team colour. Nothing marks attack targets, and there is no hit or counter feedback ("effective!").
- Fix:
  - a class tint per unit (shield darker blue, blade light blue, fletcher green already works)
  - ground rings coloured by owner
  - larger bars on hover or when selected
  - a small "×1.5" or coloured damage-number flash when a counter applies
  - widen formation spacing (`formationSlots`) to at least 1.6 m

**P8. The command grid is icon-only.**
- In `new-game-tutorial-flow.png` the four research buttons and the build buttons show only an icon and a tiny cost. A first-time player has to hover every one.
- The costs use 10 px icons that are hard to tell apart: timber, stone and iron all show as grey-brown slabs in the ribbon.
- Fix: a short text label under each command icon, or at least under Build and Research. Put names in the ribbon tooltips, and give the stability meter a numeric value.

**P9. The hero is downed in every assault.**
- `hero:downed` fires at the Warhall in all 5 winning runs (normal 19.5/19.4/18.8, story 17.5). Vharek hits for 35 and she has 420 HP.
- The 40 s recovery is fine, but she respawns at the Keep 140 m away, so she misses the finale every time.
- Fix: show Vharek's threat clearly (a "Cleave" telegraph), give Maren +100 HP or reduce Vharek's cleave against the hero, or have her recover in place when allies are within 10 m.

**P10. The victory screen evidence is a fixture.**
- `victory-screen.png` shows Time 0:01 and all stats 0, so the real end-of-match screen was never captured. The sim-side `world.stats` values are sane (e.g. produced 528/240/158/513, enemies defeated 21).
- Fix: capture the e2e victory screenshot from a bot-played save near the end, and add "Maren downed ×N" and "Raids repelled".

**P11. Minor control gaps.**
- Box-select ignores settlers whenever any soldier is in the box (`input/index.js:160-170`), which is fine. Double-click selects visible same-type units.
- There is no on-screen control-group bar, no "select all army" hotkey, and no guard/follow order.
- The 'Move' button only shows a toast (`hud.js:337`).
- Fix: add a control-group strip above the command grid and a select-all-army key (e.g. `~`). Make the Move button enter a click-target mode like Attack-move does.

## What works (so it isn't regressed)
- **Objectives:** the chain has clear text, dialogue and a live raid countdown (`hud.js:452-455`).
- **Construction:** staked site → rising walls with scaffolding → done (`buildings/view.js:209-216`), with labourers carrying goods. It is satisfying to watch, though early sites look sparse (`construction-closeup.png`).
- **Stall reasons:** the texts are specific and actionable (`production/index.js:18-25`).
- **AI:** scout → warning → raid → retreat → camp defence → Vharek engaging are all demonstrably running in the logs.
- **Hero abilities:** they are genuinely decisive, turning a loss into a 5-survivor win.
- **Lose conditions:** both are verified (Keep destroyed; `no-one-left` for an idle player).
