# Kindlehold — Game Design (Stage 1 vertical slice)

Kindlehold is an original economy-first real-time strategy game. It borrows only
general genre conventions (worker-driven production, housing, territory, small-squad
combat). All names, lore, numbers, layouts and art are original to this project.

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
| 4. Stone & iron | pop ≥ 12 | Build a Quarry and an Iron Mine; stock 30 iron |
| 5. Arms | 30 iron | Build a Barracks; recruit 6 soldiers |
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
| Shieldbearer (defensive) | 5/0/10/5 | 180 | 5 | 11 | 1.8 m | 1.2 s | 3.4 m/s | ×1.5 vs Blade |
| Bladesman (melee) | 0/0/15/5 | 140 | 2 | 16 | 1.6 m | 1.0 s | 4.0 m/s | ×1.5 vs ranged |
| Fletcher (ranged) | 15/0/0/5 | 90 | 0 | 12 | 15 m | 1.6 s | 3.8 m/s | ×1.5 vs Shield (arcing fire) |

Damage = max(1, dmg × counter × techBonus − armour). Units auto-acquire targets
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
- Enemy AI: camp spawns units from the Warhall at a difficulty-scaled rate, sends a
  scout toward the player's territory every ~3 min, assembles a raid at a gather point,
  targets the nearest valuable building (production first, then Keep), retreats when
  the wave loses 65% of its strength, regroups and returns later.

## Difficulty

| | Story | Normal | Hard |
|---|---|---|---|
| First raid size | 6 | 9 | 13 |
| Enemy spawn interval | 50 s | 35 s | 24 s |
| Garrison cap | 8 | 12 | 16 |
| Raid warning (if not triggered earlier) | 18 min | 14 min | 11 min |
| Warning → raid delay | 3:00 | 2:00 | 1:30 |
| Starting resources | ×1.5 | ×1 | ×0.8 |
| AI advantage | none | none | +10% enemy HP (documented, exposed in menu) |

## Controls (default)

Camera: arrow keys / screen edges pan, Q/E rotate (or middle-drag), mouse wheel or +/− zoom,
Space centre on selection, Home centre on Keep. Left-click select, drag box-select,
Shift adds, double-click selects the same type. Right-click context order (move /
attack / rally). A = attack-move, P = patrol, S = stop, H = hold. Hero: F = Beacon Flare,
G = Kindle the Line. B build menu. Esc pause menu. F5 quick-save, F9 quick-load.
[ / ] game speed. Ctrl+1–9 set control groups. All keys are rebindable in Settings →
Controls. (WASD is not used for panning because A/S are unit orders.)

## Out of scope for Stage 1

Diplomacy, trading, weather gameplay effects (weather is visual only), multiple
maps, skirmish, map editor, multiplayer.
