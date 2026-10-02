# Kindlehold — Game Design (Stage 1 vertical slice)

Kindlehold is an original economy-first real-time strategy game. It borrows only
general genre conventions (worker-driven production, housing, territory, small-squad
combat). All names, lore, numbers, layouts and art are original to this project.

## Design rule: challenge before comfort

The economy, transport and battles must stay demanding, scaled by the chosen difficulty.
Story is gentle; Normal asks for planning; Hard punishes waste. A comfort feature is welcome
when it rewards a decision, such as where to put a Storehouse. It must not remove a
bottleneck for free.

Every simplification is weighed openly. Each one names what it costs: materials, upkeep,
research, space or risk. Its effect is measured with the balance bot (`npm run balance`) and
the squad duels (`scripts/balance-duels.mjs`). See also `CLAUDE.md`.

## Setting

**The Harrowmere March** — a river valley on the edge of the old kingdom of Aubreth,
abandoned after the "Long Frost". Its settlements were kindled around hearth-keeps:
stone halls whose central fire marks a claim of land. The player's people, the
**Hearthbound**, return to rekindle the burnt keep of **Kindlehold**.

The **Rustfang Reavers** are toll-raiders who hold the old ford fort to the
north-east under **Vharek the Tollbreaker**, a former bridge-warden turned warlord.

Hero: **Maren Ashgrove, Lantern Warden** — a lamplighter of the old roads who
carries a great iron storm-lantern on a pole. Silhouette: long hooded coat, lantern
pole taller than her head, glowing lantern.

## Scenario — "The Rekindling of Harrowmere" (15–30 min)

| Phase | Trigger | Objective |
|---|---|---|
| 1. Arrival | start | Select Maren, relight the Keep hearth (click Keep → *Rekindle*; costs nothing, teaches selection) |
| 2. Timber & food | phase 1 done | Build a Woodcutter's Lodge and a Farmstead |
| 3. Growth | both complete | Build 2 Cottages; reach 12 settlers |
| 4. Stone & iron | pop ≥ 12 | Build a Quarry and an Iron Mine; produce 20 iron |
| 5. Arms | 20 iron produced | Build a Barracks; recruit 6 soldiers |
| 6. Warning | 6 soldiers or minute 14 | Scouts warn: raid inbound in 2:00. Build a Watchtower (needs March Charter) or position troops |
| 7. Raid | timer | Survive the raid (wave of 8–14 reavers by difficulty) |
| 8. Counter-attack | raid repelled | Destroy the Rustfang Warhall at the ford fort (Vharek defends it) |
| Victory | Warhall destroyed | Victory screen with statistics |
| Defeat | Keep destroyed, or all settlers + soldiers + hero lost | Defeat screen |

Later waves (every ~4 min after the first raid) keep pressure on until victory.

## Resources

| Resource | Source | Primary use |
|---|---|---|
| Timber | Woodcutter's Lodge fells trees in range (≤ 28 m) | Construction, archers, research |
| Stone | Quarry cuts rock outcrops in range (≤ 24 m) | Construction, towers, charter |
| Iron | Iron Mine on an iron vein (≤ 10 m); consumes 1 Provision per 2 Iron | Weapons, research |
| Provisions | Farmstead fields | Settlers eat; mines consume; recruitment |

Starting stock (Normal): Timber 80, Stone 60, Iron 0, Provisions 40 (Story ×1.5, Hard ×0.8).

## Production chain (the complete chain)

Farmstead → **Provisions** → (hauled to Keep store) → hauled to Iron Mine input
→ Mine produces **Iron** → hauled to Keep → consumed by Barracks recruitment and
*Tempered Blades* research → soldiers defend the settlement.

Every step is visible: farmers tend fields, labourers carry sacks, the miner pushes a
cart out of the adit with sparks, labourers carry ingots to the keep.

## Population

- Keep houses 6, each Cottage +5, March Charter +6. Population cap shown as `pop / cap`.
- A new settler walks in from the valley road every 16 s (Normal) when housing is
  free, Provisions ≥ 4 and stability ≥ 30. Arrival costs 2 Provisions.
- Every settler and soldier eats 1 Provision per 90 s from the Keep store.
  Hunger (store empty at meal time) → stability −8 per missed meal.
- **Stability** 0–100: +food satisfied, +housing headroom, −hunger, −buildings burnt,
  −overcrowding. Work speed multiplier `0.6 + 0.4 × stability/100`. Below 30 no one
  arrives; below 15 idle settlers leave.
- Professions: **Labourer** (idle settlers haul and build), **Forester**, **Quarrier**,
  **Farmer**, **Miner** (assigned to a workplace, one or two slots each).
- Recruiting a soldier turns an idle settler into a soldier — defence competes with
  the economy for people.

## Buildings (8)

| Building | Cost (T/S/I/P) | Build (s) | Slots | HP | Notes |
|---|---|---|---|---|---|
| Keep | pre-placed | — | — | 1600 | Store, research, settler spawn, territory 34 m |
| Cottage | 20/10/0/0 | 20 | — | 300 | +5 housing |
| Woodcutter's Lodge | 25/5/0/0 | 18 | 2 | 350 | Needs trees ≤ 28 m |
| Quarry | 30/0/0/0 | 20 | 2 | 400 | Needs rock ≤ 24 m |
| Farmstead | 30/10/0/0 | 22 | 2 | 350 | 4 field plots, grows visibly |
| Iron Mine | 30/20/0/0 | 26 | 1 | 450 | Must sit ≤ 10 m from an iron vein |
| Barracks | 40/40/10/0 | 30 | — | 700 | Recruits soldiers |
| Watchtower | 20/40/5/0 | 24 | — | 600 | Needs March Charter; shoots 16 m; territory 20 m |

Placement rules: inside own territory, slope ≤ 0.35, no water, no overlap with other
footprints or deposits, not within 6 m of enemy units. Construction costs are paid when the
site is placed; labourers then carry the goods from the Keep. Cancelling refunds all
undelivered goods, and delivered goods fully before work starts or at 50% after. Demolition refunds 30% of cost.
Damaged buildings can be repaired by labourers (costs 25% of the missing fraction).

## Technology (researched at the Keep, one at a time)

| Tech | Cost | Time | Requires | Visible effect |
|---|---|---|---|---|
| Keen Axes (economy) | 40 T, 10 I | 40 s | — | Foresters chop 35% faster; axes glint |
| Braced Timber (construction) | 50 T, 30 S | 45 s | — | Construction and repair 40% faster, cottages −5 T |
| Tempered Blades (military) | 20 T, 40 I | 50 s | Barracks | Soldiers +25% damage; blades turn blue-steel |
| March Charter (settlement) | 60 T, 80 S, 20 I | 60 s | Braced Timber | Keep grows a banner tower, +6 housing, territory +10 m, unlocks Watchtower |

## Military (3 classes + hero)

| Unit | Cost (T/S/I/P) + 1 settler | HP | Armour | Dmg | Range | Cooldown | Speed | Counter |
|---|---|---|---|---|---|---|---|---|
| Shieldbearer (defensive) | 5/0/10/5 | 200 | 5 | 10 | 1.8 m | 1.2 s | 3.4 m/s | ×2.0 vs melee |
| Bladesman (melee) | 0/0/20/5 | 140 | 2 | 16 | 1.6 m | 1.0 s | 4.3 m/s | ×1.75 vs ranged |
| Fletcher (ranged) | 15/0/0/5 | 90 | 0 | 12 | 15 m | 1.6 s | 3.8 m/s | ×2.0 vs defensive (arcing fire) |

Damage = max(1, dmg × counter × techBonus × (1 − 5% per armour point, max 75%)). Ranged units step back (at 78% speed) from melee attackers within 3.4 m, so they escape nothing faster than a shield line but can be run down by blades and reavers. Counters are regression-tested at 6v6 and 10v10. Units auto-acquire targets
within 12 m (ranged 16 m) unless given a plain move order.

Commands: move, attack, attack-move, patrol, stop, hold, context right-click;
control groups Ctrl+1–9. Group moves use a formation (ranged behind melee).

### Hero — Maren Ashgrove

- HP 420, armour 4, lantern-pole strike 20 dmg, 1.3 s, 2.2 m.
- Passive **Hearthlight**: allies within 10 m regenerate 1 HP/s and take 10% less damage.
- Active **Beacon Flare** (Q, cooldown 30 s, range 14 m, radius 6 m): lantern bursts;
  enemies in the radius take 40 damage and are dazzled (−60% attack speed) for 5 s.
- Active **Kindle the Line** (W, cooldown 45 s, self-centred radius 9 m): allies
  gain a 60 HP ward for 8 s and +20% move speed.
- Defeated heroes kneel and recover at the Keep after 40 s (not a defeat).

### Enemy — Rustfang Reavers

- Reaver (melee 120 HP), Slinger (ranged 80 HP), Brute (defensive 220 HP) — the
  enemy mirrors the counter triangle.
- **Vharek the Tollbreaker** (commander): 700 HP, cleave 35 dmg, *War Horn* rallies
  nearby reavers (+20% damage, 8 s) once per 40 s. Stays at the Warhall until the
  Warhall is attacked or the final wave.
- Enemy AI: camp musters units from the Warhall at a difficulty-scaled rate out of finite reserves (none while the Warhall is below half health), sends a
  scout toward the player's territory every ~3 min, assembles a raid at a gather point,
  gathers visibly outside the gate for 20 s, targets one of the most valuable buildings (production first, then Keep; seeded variety), retreats when
  the wave loses 75% of its strength, regroups and returns later.

## Difficulty

| | Story | Normal | Hard |
|---|---|---|---|
| First raid size | 6 | 9 | 11 |
| Enemy spawn interval | 50 s | 35 s | 24 s |
| Garrison cap | 8 | 12 | 16 |
| Fort reserves (total musters) | 22 | 32 | 40 |
| Raid warning (if not triggered earlier) | 18 min | 14 min | 11 min |
| Warning → raid delay | 3:00 | 2:00 | 1:30 |
| Starting resources | ×1.5 | ×1 | ×0.8 |
| AI advantage | none | none | +10% enemy HP (documented, exposed in menu) |

## Seasons, exploration and direct orders (Level 2 additions)

- **Seasons** (`src/weather/`): deterministic schedule — first winter at 17:00, winters last
  3 min, summers 8 min. Winter: snow cover, crops grow at 50%, the Harrow freezes after 30 s
  and becomes walkable everywhere (for both sides); a warning 20 s before the thaw; walkers
  caught on the ice are pushed ashore and lose 25% of their max HP.
- **Exploration** (`src/exploration/`): 64×64 explored bitset in the world, revealed by the
  player's units (20 m, hero 26 m), settlers (14 m) and buildings (20 m, Keep 52 m, tower 34 m). The ford fort is revealed
  when the counter-attack objective starts (the scouts report it).
  Unexplored land is drawn dark and hidden on the minimap. The AI is not affected.
- **Direct labourer orders** (`gather` / `release` commands): selected labourers fell trees
  (2 timber per 6.5 s trip) or cut rock (2 stone per 7.5 s) by hand within 16 m of the
  clicked deposit and carry it to the Keep.
- **Dialogue portraits**: every speaker has an original portrait in the dialogue box.
- **Taler, taxes and payday** (`src/population/index.js`): every 2 min settlers pay taxes
  (Low 1 / Fair 2 / High 3 Taler each; stability target +8 / 0 / −12), soldiers draw 1 Taler
  pay each (unpaid: stability −6). Start 60 Taler (×difficulty). The Keep hires a labourer
  for 40 Taler when housing is free. Save schema 3 (migration from 2 adds the fields).

## Level 2.5 additions

- **Upgrades** (`UPGRADES` in `src/buildings/defs.js`): Keep → Castle (+14 m territory, +4 housing,
  +25% taxes) → Fortress (+12 m, +4, +25%; needs the Charter); Cottage → Stone House → Townhouse
  (+3/+3 housing; townhouse needs the Castle); workshops level 2 (+1 slot, +20% speed). Paid up
  front, progress automatically (Braced Timber speeds them up), the building keeps working.
- **Military research:** Steel Mail (+20% HP, +2 armour), Veteran Drill (+15% attack rate,
  +10% speed; needs the Castle).
- **Day and night** (`src/population/daily.js`): settlers sleep 22:00–05:00 in the nearest house
  (staggered), are hidden and safe and do not eat; nights pass at double speed; settlers are
  "rested" (+18% work speed, faster walking); the Barracks rouses sleepers for training.
- **Wildlife and food chain:** deer herds (graze, flee within 7 m, breed while ≥2 remain);
  Hunter's Hut (45 m range, 4 provisions per kill, works in winter); Tavern (cook: 2 provisions →
  3 hot meals, served first, up to +8 stability target).
- **Points of interest** (`src/pois/`): trader (4 fixed trades), lookout cairn (reveals 70 m),
  old watch ruins (120 Taler + 25 iron), Millbrook (Maren visits → up to 3 settlers, 30
  provisions, tithe of 8 provisions + 10 Taler every payday).
- Forester trip 4 timber (was 3). Deliveries: an empty mine is served before the Tavern.

## Level 2.8 additions — "The wide valley"

- **Map** 384 × 384 m (`half: 192`): Westmarch hills with a second iron vein (-118, 22), the
  Greyfen fens (NW), Saltbridge downs with Saltford (E), Barrowmoor (SW); 9 deer herds.
- **Greyfen brigands** (`src/brigands/`, player `p3`): Brigand Hall (1800 HP) + 2 towers,
  Morwen Greyfen (commander), brigands (melee) and poachers (ranged); muster one fighter every
  40 s from a pool of 30 (garrison cap 9). Neutral: guard the hold; a player building within
  48 m costs 30 relation (once per building). War: a raid of up to 5 every 5 minutes (first
  90 s after war begins). Allied: 4 fighters answer every Rustfang wave; 12 timber +
  8 provisions every payday. Destroying the hall: 150 Taler.
- **Diplomacy** (`src/diplomacy/`): relation per pair −100..100; war ≤ −30, allied ≥ 60, truce
  overrides. `hostile()` decides who fights; striking a non-hostile faction sets −80.
  Commands: `gift` (50 Taler, +18, 30 s cooldown), `peace` (80 Taler → −25), `declareWar`,
  `truce` with the Rustfang only (120 Taler, 5 min, not during a gathering or raid; delays raids
  and plunderers). Relations drift 1 point per 5 s back to 0 (p1|p3); p2|p3 feud at −70.
- **Market** (`src/pois/`): 7 trades incl. selling stone and iron; each buy × 1.12, each sell
  × 0.9 on that good's price (0.5–2.5), relaxing 0.02 per 10 s towards 1. Saltbridge Market
  trades at a 20 % discount.

## Level 2.9 additions

- **Ranks** (`RANKS` in `src/combat/index.js`): 3 kills → Veteran (×1.1 damage and max HP),
  8 kills → Elite (×1.2). Heroes and commanders do not rank up. Saved as `xp` and `rank`.
- **Rain** (`RAIN` in `src/weather/index.js`): pure function of the tick, 75 s every 5 min in
  summer after minute 3; crops ×1.35 while it rains; `weather.wet` for the view.
- **Fisher's Hut:** `waterRange` 30 m (placement checks the distance to the river polyline),
  3 provisions per 7-s catch, ×0.5 on ice; the spot is the dry bank nearest the hut.
- **Job assignment:** workplaces without a worker first, then the scarcest output resource.

## Campaign (Level 3)

- `CAMPAIGN` in `src/missions/index.js`: harrowmere → greyfen → tollbreaker. Progress (unlocked,
  won, the Greyfen choice) lives in localStorage (`src/app/campaign.js`), not in saves; the save
  carries `meta.scenarioId` and `meta.campaign`.
- Scenario fields: `setup` (keepLevel, keepLit, techs, settlers, soldiers, buildings placed with
  `findSpot`), `ai` (multipliers on the difficulty table), `enemy` (extraTowers, garrison of
  sentinels that never raid, commanderLate, hallBarred), `events` (one-shot: say, alert, grant,
  flag/unflag, reveal, relation, raidSoon, spawnHost), `raidWarnAfter`, `winWhen`, `cinematic`.
- New conditions: minutes, stance, poiDone, unitGone, veterans (+rank), winter, not, hostSpent.

## Chapter 4 additions

- **Maps** (`src/world/maps/index.js`): harrowmere, saltmere. A scenario names its map
  (`map`); loaded saves use their scenario's map. Terrain supports `lakes` and `islands`
  (ellipses); `nearestWater` serves fishers and placement.
- **Factions** (`src/ai/factions.js`): rustfang, varr — hall, tower, muster cycle, garrison,
  commander and wording. `scenario.enemy.faction` → `world.ai.faction` (saved).
- **Varr units:** Pikeman (defensive, 170 HP, armour 4), Crossbowman (ranged 14 m, pierce 0.4),
  Knight (melee, 210 HP, armour 5), Ysolde (commander, 760 HP). Manor 2800 HP; towers 13 dmg / 16 m.
- **Salt:** deposit `salt` (never depletes), Salt Works (25 timber, 10 stone; 12 m), salter
  earns 3 Taler per 8-s trip.

## Production chains (save schema 4)

- **Goods:** `flour`, `bread`, `tools` join the Keep store (RESOURCES). They show in the HUD
  ribbon once the player has the building that makes them (or some in store).
- **Windmill** (30 timber, 15 stone; miller): 2 provisions → 2 flour in 8 s. Inputs up to 8
  provisions; labourers deliver grain only while the Keep holds more than `pop` + 5 provisions.
  The sails turn while the miller works (view part in `buildings/view.js`).
- **Bakery** (25 timber, 25 stone; baker): 2 flour + 1 timber → 2 bread in 9 s. Stores 8 flour,
  4 timber.
- **Smithy** (25 timber, 20 stone, 5 iron; smith): 2 iron + 1 timber → 1 tool in 10 s. Stores
  6 iron, 4 timber. Timber deliveries keep 12 in the Keep for building, iron 4.
- **Meals:** hot meals first, then bread (1 loaf = 2 portions, `BREAD_STABILITY` = +6 on the
  stability target when everyone ate bread), then provisions.
- **Level 3** for every workshop (lodge, quarry, farm, mine, hunter, fisher, salt works, tavern,
  mill, bakery): 15 timber, 30 stone, 4 tools, 40 Taler; speed ×1.25 on top of level 2's ×1.2
  (`workSpeedOf` multiplies the levels).
- **Deliveries** are generic: a building's `inputs` lists goods and store sizes;
  `stock.inIncoming` counts goods on the way per kind (was one number for provisions).

## Settler comfort

- **Storehouse** (35 timber, 25 stone): `isStore`/`pickStore` in `economy/index.js`. Fetch trips
  use the store with the shortest way labourer → store → target; drop-offs go to the store
  nearest the goods. Stock stays one pool per player (no per-store inventories).
- **Idle hands** (`AUTO_GATHER`): an idle labourer (checked every 2 s) fells a tree / cuts stone
  within 45 m of a store while timber < 120 or stone < 80, one trip (`order.auto`), at most a third
  of the labourers, one always left idle. Toggle per player: command `setAutoGather`
  (`player.autoGather`, saved).
- **Move** (command `move`): new site with all materials supplied, level kept (`movedLevel`),
  goods in the old building go to the store; not the Keep, not during an upgrade.
- **Healing**: player soldiers not hit for 5 s heal 3 hp/s within 26 m of the Keep, 18 m of a
  Barracks, 14 m of a Watchtower (`HOME_HEAL`, `HEAL_AT` in `units/sim.js`).

## Random maps (free play "Wildlands")

- `src/world/maps/wild.js` generates a map from a seed (the world's `meta.seed`, so saves need
  nothing extra; `mapById('wild', seed)`, terrain cached per seed in `simulation.js`).
- Layout: the two seats face each other across the centre (100–118 m out); a river winds
  across the axis with a ford near the middle and up to two more; 1–3 lakes (half of them salt
  lakes with pans), 10 hills plus rim hills, 13 forests, 8 rock clusters, 4 iron veins, trader,
  hamlet, two cairns and a ruin, a road from home over the middle ford to the enemy.
- Guarantees: forest 36–46 m, rock 34–42 m and an iron terrace 40–52 m from home; a pond near
  home when the river is far; nothing in water; tested over many seeds
  (`tests/simulation/wild.test.js`).
- Scenario `free-wild`: `enemy.faction: 'random'` (drawn from the seed in `missions/setup.js`),
  objective `{ destroyedSeat: true }`, home cottages placed relative to the Keep. Restart keeps
  the seed.

## Controls (default)

Camera: right-drag grabs and moves the map (a short right-click stays the context order), arrow keys pan, screen-edge scrolling is optional (off by default), Q/E or middle-drag rotate, mouse wheel zooms towards the cursor,
Space centre on selection, Home centre on Keep. Left-click select, drag box-select,
Shift adds, double-click selects the same type. Right-click context order (move /
attack / rally). A = attack-move, P = patrol, S = stop, H = hold. Hero: F = Beacon Flare,
G = Kindle the Line. B build menu. Esc pause menu. F5 quick-save, F9 quick-load.
[ / ] game speed. Ctrl+1–9 set control groups. All keys are rebindable in Settings →
Controls. (WASD is not used for panning because A/S are unit orders.)

## Out of scope for Stage 1

Diplomacy, trading, rain/other weather, multiple maps, skirmish, map editor, multiplayer.

## Watchtower upgrades

| Level | Name | Cost | Time | Bonus |
|---|---|---|---|---|
| 2 | Stone Watchtower | 15 T, 40 S, 5 I, 30 taler | 35 s | range +4 m (20 m), damage +4, territory +6 m, +250 hp |
| 3 | Bastion Tower | 50 S, 10 I, 2 tools, 50 taler; needs the Castle | 45 s | reload ×0.7, damage +6, territory +6 m, +300 hp |

Upgrades that add range, damage or a faster reload stack through `attackOf(b)` in
`buildings/defs.js`, which combat and the selection panel both use. Towers are the
Settlers-like way to grow the land, so each level also widens the territory.

