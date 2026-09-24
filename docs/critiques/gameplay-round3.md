# Gameplay critique, round 3 (gameplay-critic)

Date: 2026-09-24. Build: `058744f`. The gameplay changes under review come from `dbade6e` ("Gameplay iteration 2") and `2cbf723` (a counter fix). I re-measured every claim instead of trusting the commit messages.

**Evidence.**
- `npm test`: 66/66 pass.
- `node scripts/balance-duels.mjs 6` and `node scripts/balance-duels.mjs 10`.
- `node scripts/econ-diag.mjs 3,6,10`.
- **Ten full bot matches** with a 45-minute cap: story 1337/42, normal 1337/7/42/99, hard 1337/42/7/99. They ran through a wrapper at `/tmp/kh3/run.mjs` that:
  - counts every player-facing `alert` event, grouped by text, with the peak count in any 60 s window
  - tracks the Keep's minimum HP
  - records when provisions first reach 0
  - counts hero downs
  - reads `ai.spawned`, the fort's reserves used
- Throw-away experiments, also under `/tmp/kh3/`:
  - `duel.mjs`: counter pairs at N = 4, 6, 8, 10 and 12, on 3 seeds each
  - `mix.mjs`: army compositions against the first-raid mix of 9
  - a map scan of how much stone exists
- No browser was started. Visual claims were checked against `docs/screenshots/round4/`, which was captured at 13:51–14:03, after both gameplay commits. `docs/screenshots/final/` was still empty.

## Scores

| # | Criterion | R1 | R2 | R3 | Why it moved |
|---|---|---|---|---|---|
| 1 | First-launch experience & tutorial clarity | 6.0 | 6.5 | **7.0** | Command buttons now have text labels (visible in `round4/ui-1920.png`). Hint keys come from the player's bindings. Move is a real targeting order. One hard-coded "Press B" remains in the help screen, and no test guards the placeholders. |
| 2 | Economy feedback (chain, stall reasons, pacing) | 5.5 | 6.0 | **6.5** | Alerts fell from 2.2–2.8 to 1.5–2.0 per minute, and the "goods piling up" hint now names the levers. The mine site is 30% built at 6 min (round 2: 0%). Two new false positives appeared (see P2). Stone runs out with no forecast (see P1). |
| 3 | Population / housing / labour decisions | 5.0 | 5.5 | **5.5** | The Pause tooltip is now honest, and food is hauled first when stores are low. There is still no labourer reserve. When everyone at full population is employed, recruiting silently needs an idle settler. |
| 4 | Construction satisfaction | 6.5 | 6.5 | **6.5** | No gameplay change. The site footprint is a visual-pass change. |
| 5 | Unit control | 6.5 | 6.5 | **7.0** | Adds a Move targeting mode, a control-group bar with clickable chips, and labelled orders. There is still no select-all-army key and no formation choice. |
| 6 | Combat readability & counters | 4.5 | 6.0 | **6.5** | Coloured discs under each unit (blue for the player, red for enemies) make sides readable in the screenshots. Shields are now a viable choice. But **the triangle breaks at 10v10 and above** (P3), and melee still clumps. |
| 7 | Hero usefulness | 6.5 | 7.0 | **7.0** | Maren is downed only 0–2 times per match (round 2: 2–5 on Hard), but the reason is shorter matches, not a change to her. |
| 8 | Enemy behaviour | 5.5 | 6.5 | **7.0** | Raid targets now vary. Raids have teeth: they destroyed buildings in 3 of 10 runs. The fort runs dry. Its reserves are invisible, raids last only 36–54 s, and the Keep was never touched. |
| 9 | Scenario pacing & win/lose conditions | 6.5 | 6.5 | **7.0** | **Hard now ends**: 4/4 victories in 28.6–31.8 min. The three difficulties now run almost the same length (P5). One Normal seed did not finish because of bot faults (P8). |
| 10 | **Overall gameplay (slice)** | **5.8** | **6.4** | **6.8** | The round-2 blocker is fixed, and most round-2 polish items are partly addressed. There are no new blockers, but there is one counter regression and a new late-game resource cliff. |

**Overall gameplay score: 6.8 / 10.**

This is a solid "good prototype":
- Every difficulty now resolves inside, or right at the edge of, the 15–30 min target.
- Feedback is quieter.
- Control is close to genre-standard.

It is still far from 8.5 because:
- the difficulty modes feel like the same match at slightly different speeds
- the counter system only holds at small squad sizes
- the economy's late game ends at a stone and timber cliff the player is never warned about
- the alert feed still contains two kinds of false alarm

## Evidence summary

| Run | Result | Time (R2) | Timeline notes | Keep min HP | Provisions first 0 | Alerts (per min, peak in 60 s) | Hero downs |
|---|---|---|---|---|---|---|---|
| story 1337 | victory | 23.4 (18.8) | wave1 17.3 (6 raiders) · Warhall 23.4 | 2200 | 22.0 | 38 (1.6, 7) | 1 |
| story 42 | victory | 23.2 | – | 2200 | 22.0 | 37 (1.6, 6) | 0 |
| normal 1337 | victory | 23.9 (24.2) | wave1 16.3 · wave2 21.5 · Warhall 23.9 | 2200 | never | 42 (1.75, 8) | 0 |
| normal 7 | victory | 30.2 (20.3) | 3 waves · Lodge destroyed 28.4 · stone 3 from 20 min | 2200 | 23.5 | 55 (1.8, 5) | 1 |
| normal 99 | victory | 24.8 | – | 2200 | never | 43 (1.7, 7) | 1 |
| normal 42 | **no result at 45 min** | 45+ (24.9) | 4 waves · fort empty (0 enemies) from 36 min · the bot sits on 6 soldiers and 260 iron | 2200 | never | 77 (1.7, 8) | 1 |
| hard 1337 | victory | 28.6 (45+) | waves 11/15/8 · reserves spent (40/40) by 26 min | 2200 | never | 44 (1.5, 6) | 2 |
| hard 42 | victory | 30.1 (45+) | waves 11/15/19 · Lodge destroyed 26.2 | 2200 | never | 60 (2.0, **11**) | 1 |
| hard 7 | victory | 31.8 (45+) | Lodge destroyed 21.0, Quarry 26.6 · stone 1–3 from 20–28 min | 2200 | 28.0 | 56 (1.8, 7) | 1 |
| hard 99 | victory | 29.3 | – | 2200 | 28.0 | 53 (1.8, 7) | 2 |

**Raid duration** (from `ai:wave` to `ai:retreat`) is 36–54 s. Round 2 measured 33–45 s, so the 25% retreat threshold added about 5 s.

**Alert mix** (normal 42, 77 alerts):

| Alert | Count |
|---|---|
| "Woodcutter's Lodge has nothing left…" | 27 |
| "Provisions are running low: # left for # people" | 10 |
| scout sighted | 9 |
| "Goods are piling up…" (combined hint) | 14 |

Normal 1337 shows the same pattern: 19 "nothing left", 6 scout, 8 "piling up". The old "X is full" spam of 18–36 per match is gone.

**Counters.** `balance-duels`, 10v10, rows are the player's units:

| Player units | vs brute | vs reaver | vs slinger |
|---|---|---|---|
| shield | 7-0 | 7-0 | **4-6 at the 120 s timeout** |
| blade | **2-0** | 7-0 | 7-0 |
| fletcher | 9-0 | 0-4 | 5-0 |

At 6v6 all six expected results hold.

**Scaling** (`duel.mjs`, seeds 9/3/77):

| Match-up | N=4 | N=6 | N=8 | N=10 | N=12 |
|---|---|---|---|---|---|
| blade vs brute | 0-2 / 0-1 / 0-2 | 0-3 / 0-2 / 0-3 | 0-2 / **3-0** / 0-2 | **2-0 / 6-0 / 2-0** | **4-0** / 0-3 / **4-0** |
| shield vs slinger | loses | loses | loses | 4-6 (180 s timeout) / 0-3 / 4-6 (180 s timeout) | 0-2 / 1-5 (180 s timeout) / 0-2 |

**Army compositions** against the first-raid mix of 9 (`mix.mjs`):

| Player army | Survivors (R2) | Time |
|---|---|---|
| 9 blades | 7–8 (6) | 14 s |
| 3 / 3 / 3 | 6–7 (6) | – |
| 5 shields / 4 fletchers | 6–7 (5) | – |
| 9 shields | 5 (1) | 32–37 s |
| 9 fletchers | 0–3 (0) | – |

**Economy** (`econ-diag`, normal 1337):

| Time | State |
|---|---|
| 6 min | Mine site 30% built (R2: 0%). Only 1 of 4 producers is `storageFull`. |
| 10 min | Only the Quarry is `storageFull` (R2: Lodge, Quarry and both farms). |

`stone-iron` is complete at 10.1–10.4 min on Normal (R2: 10.6–12.0) and 11.1–12.7 min on Hard (R2: 12.1–13.2).

**Map stone** (scan over seeds 1337, 42 and 7):
- There are 9 rock deposits of 40 each. Six form the home field, 30–47 m from the Keep, for **240 stone in total**.
- The other 3 sit 91–100 m away, at x ≈ 2–9, z ≈ −25…−35, next to the Rustfang lookout tower.
- Bot matches consumed 240–296 stone.

---

## Verified fixed

1. **R2 B1: Hard never ended.**
   - The fix: a finite `reserves` setting (22 / 32 / 40 by difficulty), and no new musters while the Warhall is below 50% HP (`src/ai/index.js:13-15, 205-206`).
   - Result: Hard went from 0/3 finished to **4/4 victories in 28.6–31.8 min**. `spawned` reaches 40 at about 26–28 min, and the camp is empty soon after.
   - Regression check: raids are **not** too weak. Hard waves are 11, 15 and 19 raiders. They destroyed a Lodge and a Quarry on hard 7 and a Lodge on hard 42. Survivors per retreat are 3–8.
2. **R2 P4, mostly: raids repeated the same target.**
   - `pickRaidTarget(…, vary=true)` picks, with a seeded roll, among the 3 most attractive targets (`src/ai/index.js:34-47`). Over the Hard runs, targets vary within and across seeds.
   - The alert now says "raiders".
   - The retreat threshold is 0.25. Raids are still short (see P7).
3. **R2 P1, mostly: "X is full" spam.**
   - The per-building storage-full alert was removed.
   - One `info` hint, "Goods are piling up at … Pause a workplace or build Cottages for more people", fires at most every 3 min (`src/production/index.js:40-44`) and names the real levers.
   - Alerts fell to 1.5–2.0 per minute from 2.2–2.8. The residual noise comes from new sources (P2).
4. **R2 P3, partly: dead mid-game.**
   - The mine is cheaper (25 timber + 15 stone, build time 22 s), and the objective now needs 20 iron instead of 30.
   - The mine site is 30% built at 6 min instead of 0%, and `stone-iron` completes about 0.5–1.5 min earlier.
   - Minutes 5–10 still have no narrative beat.
5. **R2 P6: the Pause tooltip lied.** It now reads "Frees its workers for other work: hauling, building, other workplaces or soldier training" (`src/ui/hud.js:413`), which matches the behaviour. The reserve stepper was not added.
6. **R2 P8: hard-coded hint keys.**
   - `{buildMenu}`, `{abilityFlare}` and `{abilityKindle}` placeholders are resolved through `withKeys()` using the live bindings (`src/ui/hud.js:185-186, 202`; `harrowmere.js:31, 62`).
   - Gaps: `src/ui/menus.js:187` still says "Press B.", and no test checks for stale key letters.
7. **R2 P9, mostly: control gaps.**
   - Move now enters targeting mode with a banner (`input/index.js:124-127`).
   - A control-group bar shows chips like "1 ×6" that select their group when clicked (`hud.js:91-110`).
   - Order buttons carry short text labels.
   - Build and train buttons still show a cost row instead of a label. There is no select-all key.
8. **R2 P10: shields underperformed.**
   - Shieldbearer HP went from 180 to 200, and the Bladesman now costs 20 iron instead of 15.
   - 9 shields now keep 5/9 alive against the first-raid mix (R2: 1/9).
   - Blades are still the best generalist (7–8/9 in 14 s) but now cost 180 iron for 9, twice the iron of 9 shields.
9. **R2 P7, partly: combat readability.**
   - Faction discs are rendered (`selection/view.js`), melee units take ring slots, and separation only pushes apart units on the same side.
   - In `round4/combat-overview.png`, blue and red discs make the sides readable. The melee is still a tight 3–4 m knot, so it is a better blob, not formations.
10. **R2 P5, partly: the hero is downed less.** 0–2 downs per match, but always at the camp. Nothing about the hero changed.
11. **R2 P2, partly: food.**
    - Farmstead output jumps the hauling queue when provisions fall below 2× population (`economy/index.js:86-88`).
    - The warning now fires 45 s before a meal and triggers below 1.5× population. The trigger is miscalibrated (P2).
    - Provisions still reach 0 in **5/10** runs (see P6).

---

## BLOCKERS

None. I checked every match-ending path: all difficulties can be won, Hard ends, and the Keep cannot be lost to a trickle. The one unfinished run (normal 42) is a bot fault, not a game fault (P8). A human would walk into an empty camp.

## POLISH (ranked)

**P1. A late-game resource cliff with no forecast. Stone is finite, and a destroyed Lodge can become impossible to rebuild.**
- **Evidence:**
  - The home rock field holds 240 stone in total. The only other rocks are 91–100 m away, beside the enemy lookout tower.
  - Stock sat at **1–3 stone** from about minute 20 in normal 7 and hard 7, from 26 min in normal 42, and from 28 min in hard 42.
  - A Lodge costs 5 stone (`buildings/defs.js:42`). On hard 7 the raid destroyed a Lodge at 21.0 min and the Quarry at 26.6 min while stock was at 3 stone, so neither could be rebuilt from stock.
  - Nothing tells the player how much a deposit has left. The only signal is the after-the-fact "has nothing left" alert.
- **Fix:**
  - Make the Lodge cost timber only.
  - Add a second reachable rock field of about 160 stone, or make each rock hold 60.
  - Show "Deposits in range: N left (≈ M min)" on the Lodge and Quarry panels, and alert once at 25% remaining.

**P2. Two alert false positives replaced the old spam.**
1. **"Woodcutter's Lodge has nothing left to work nearby"** (19–27 per match).
   - `findDeposit` skips trees reserved by the Lodge's other worker (`production/index.js:53`). When one reachable tree is left, the second forester gets `noDeposit`. The stall clears when the first forester's tree frees up, then sets again, so the alert repeats every 90 s while the Lodge is still producing.
   - Part of the count is bot churn (P8).
   - **Fix:** raise `noDeposit` only when *no* unreserved or reserved deposit is in range (count reserved trees as available). Throttle per building type, not per id, so a replaced Lodge does not restart the throttle.
2. **"Provisions are running low: 68 left for 46 people"** (10× in normal 42).
   - The trigger is `provisions < pop × 1.5` (`population/index.js:98`), so it fires when the next meal *is* covered. The text contradicts itself, and it trains the player to ignore the warning.
   - **Fix:** warn from the net rate, "≈ N min of food at current rates", below 3 minutes, or at least only when `provisions < pop`.
- The scout alert still fires 6–9 times per match. Downgrade repeats to `info`.
- The peak is 11 alerts in one minute (hard 42, during a raid).

**P3. The counter triangle breaks at army sizes a player actually fields.**
- **Evidence:**
  - Bladesmen should lose to Brutes. They do at 4v4 and 6v6, but at N ≥ 8 they win 5 of 9 trials (e.g. 6-0 at 10v10).
  - The likely cause is `2cbf723`: separation now only pushes apart units on the same side, so more blades reach one Brute at a time.
  - Shield vs slinger runs to the 120–180 s timeout at 10–12 units: shields cannot catch kiting slingers, and slingers cannot finish 200-HP shields.
  - `tests/simulation/counters.test.js` only runs 6v6, so the suite stays green.
- **Fix:**
  - Add 10v10 and 12v12 cases to the test.
  - Cap how many attackers can occupy ring slots around one target (for example 4 melee slots, and queue the rest), or give Brutes +2 armour against the melee class.
  - Give slingers a real kiting limit, the same as fletchers (backpedal at 0.7× speed and no firing while retreating), so shields eventually close.

**P4. Fort reserves are an invisible timer. Hard is won by waiting.**
- **Evidence:**
  - In every Hard run, `spawned` hits 40/40 at about 26–28 min, and the bot's assault succeeds 1–4 min later.
  - The player gets no signal that the fort is thinning. The only alerts in `ai/index.js` are gather, march, flee, Vharek and scout.
  - Nothing rewards an early strike, beyond the existing "no musters below 50% Warhall HP" rule.
- **Fix:**
  - Add a line to the Warhall's selection panel: "Garrison: strong / thinning / depleted".
  - Add a scout report after each repelled wave ("The ford fort looks thin: only a handful remain").
  - Add an objective hint once reserves drop below 25%.

**P5. The difficulties converge on the same length.**
- **Evidence:**
  - Story takes 23.2–23.4 min (R2: 18.8), Normal 23.9–30.2, Hard 28.6–31.8.
  - The Keep was untouched (2200/2200) in 10 of 10 runs.
  - A fixed-build-order bot wins Hard 4/4.
- Story is barely shorter than Normal. Its first raid comes at 17.3 because of the 3:00 delay, and it hit 0 provisions at 22.0 in both Story runs.
- Hard differs mainly by being about 5 min longer, not by asking for different play.
- **Fix:**
  - Story: warning at about 11 min with a 2:00 delay, and `firstRaid` 5, so it finishes around 18 min.
  - Hard: one wave with a second target group (a split raid), or target the Keep when the army is away. Hard should threaten something the Normal build order leaves open.
  - Keep the 30 min ceiling.

**P6. Food still runs out late (5/10 runs).**
- **Evidence:** provisions reached 0 at 22.0 (both Story runs), 23.5 (normal 7) and 28.0 (hard 7 and 99). Every time, population had just reached the cap (46–52) with only 2 Farmsteads.
- The hauling priority helps early but cannot fix a production deficit, and the player sees no rate.
- **Fix:** show the net provisions rate ("−3/min") next to the stock in the top bar. The warning from P2 would then catch this.

**P7. Raids are still a 40-second event.**
- Every wave retreats 36–54 s after `ai:wave`, and none got closer to the Keep than the target building.
- **Fix:** add a raid "objective" phase, for example raiders sack the target for 20 s (a burn timer the player must break), or split into two groups, so defending is a manoeuvre rather than one attack-move.

**P8. Recruiting at full population is silently blocked, and the test bot has two faults that distort measurements.**
- **Game:**
  - On normal 42 from 26 min, all 46 settlers are employed. Training requires an idle settler (`noSettler`), so 260 iron piles up.
  - A human must know to pause a workplace.
  - **Fix:** the Train button tooltip or disabled state should say "No idle settler: pause a workplace or build a Cottage". Better, recruiting should pull the lowest-priority worker automatically.
- **Bot:**
  1. The relocation heuristic (`demo/bot.js:74-79`) places the new Lodge at the tree nearest the Keep. That is often a lone tree, so the Lodge dies again within 30–40 s and the bot rebuilds it at the same spot. On normal 42 this burned about 170 timber and 44 stone in 2 minutes (timber 208 → 40, stone 47 → 3), and it added about 12 of the 27 "nothing left" alerts.
  2. The bot never pauses a workplace to free recruits, so it stalls at 6 soldiers, below its assault threshold of 12.
  - **Fix:**
    - Relocate to the densest tree cluster, meaning the most trees within 28 m.
    - Pause a Lodge when there is no idle settler and iron is at least 40.
    - Re-measure normal 42.

**P9. Docs are stale or inconsistent.**
- `GAME_DESIGN.md` gives the Hard first-raid size as 13, but the code uses 11 (`ai/index.js:15`).
- `docs/KNOWN_ISSUES.md` quotes Hard at 28.8 / 40.8 min and Normal at 26.2 min. The measured figures are now 28.6–31.8 and 23.9–30.2.
- `src/ui/menus.js:187` hard-codes "Press B".
- **Fix:** update the numbers, add a test that no scenario or menu text contains a bare bindable key letter, and run the menu text through `withKeys`.

**P10. The hero is still downed at the camp.** 0–2 downs per match, every one during the assault (x ≈ 52–79), then a 140 m walk back. The round-1 and round-2 fixes still apply: a Cleave telegraph, or recovering in place when allies are within 10 m.

**P11. The Hard objective path still arrives late.** `stone-iron` completes at 11.1–12.7 min against the 13.0 warning, and `arms` at 17.0–26.2 min, after wave 1 at 15.1. The Hard player meets the first raid with 1–4 soldiers, and it is the Keep and its archers that hold. Consider warning at 13.5 min on Hard, or granting 2 free shields at the warning.

## Regression checks (asked for explicitly)

| Check | Result |
|---|---|
| Raids too weak now that reserves are finite? | **No.** Hard waves are 11, 15 and 19. Raids destroyed buildings in 3 of 10 runs, and 3–8 raiders survive each retreat. Reserves run out only after about 26 min on Hard. |
| Match length vs the 15–30 min target | Story 23.2–23.4 · Normal 23.9–30.2 (plus one bot stall) · Hard 28.6–31.8. Inside the target, or 2 min over it. |
| Is Hard winnable, and how long does it take? | Yes: 4/4 bot wins, 28.6–31.8 min. The Keep was never damaged. |
| Alert counts | 37–77 per match, 1.5–2.0 per minute (R2: 45–112, 2.2–2.8). Peak 11 in one minute. See P2 for the false positives. |
| Counter triangle | Holds at 6v6 (tests green). **Regressed at 8–12 units** (P3). |
| Food | Hits 0 in 5 of 10 runs, all after 22 min (P6). |
| Resource exhaustion | **New**: stone at 1–3 from minute 20–28 in 4 of 10 runs (P1). |
