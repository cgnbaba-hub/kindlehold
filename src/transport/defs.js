// Transport numbers shared by the simulation, the views and the HUD.

// Stone roads: laid by the player cell by cell (2 m nav cells), paid on the spot. Everyone walks
// faster on them, raiders included. The price rises with the difficulty (CLAUDE.md,
// "Schwierigkeit": a road saves walking, so it must cost planning).
// Measured with the bot (scripts/balance-seeds.mjs, KH_TRANSPORT=1, roads and a stable together,
// chapter one): at 2 stone per cell and two donkeys Normal was won 3 minutes sooner (27.7 -> 24.5
// over 16 seeds) and the town grew to 48 people instead of 33. With the prices below Normal stays
// at 27.6 and Hard at 12 of 20 won (13 without); Story gets much easier (25.9 -> 18.7), on purpose.
export const ROADS = {
  speed: 1.5,          // walking speed on a road cell
  donkeySpeed: 1.2,    // pack donkeys plod on: a road helps them less
  stone: { story: 1, normal: 3, hard: 4 }, // per cell
  taler: { story: 0, normal: 1, hard: 2 }, // per cell: the paviours' wages
  perCommand: 48,      // cells in one stretch (about 96 m)
  maxCells: 1200,      // per world
  clearOfDeposits: 1.4, // metres a road keeps from trees and rocks
};

/** Stone for one road cell in this game. */
export function roadStone(world) {
  const d = world.meta && world.meta.difficulty;
  return Object.hasOwn(ROADS.stone, d) ? ROADS.stone[d] : ROADS.stone.normal;
}
/** What one road cell costs in this game. */
export function roadCellCost(world) {
  const d = world.meta && world.meta.difficulty;
  const taler = Object.hasOwn(ROADS.taler, d) ? ROADS.taler[d] : ROADS.taler.normal;
  return taler ? { stone: roadStone(world), taler } : { stone: roadStone(world) };
}

// Donkey stable: a few pack donkeys that only carry, twice a carrier's load at a slower walk:
// workshop goods to the store and a workshop's inputs from it (on Story also building materials
// to the sites). They take no house, but eat at every meal and rest at night. Fewer donkeys and
// more fodder on harder difficulties (CLAUDE.md, "Schwierigkeit").
// Measured with the bot (scripts/balance-seeds.mjs, KH_TRANSPORT=donkeys): supplying building
// sites made them strong (Normal 26.7 -> 24.0 min, Hard 13 -> 18 of 20 won), so on Normal and Hard
// the sites stay the carriers' work and each stable keeps a single donkey.
export const DONKEYS = {
  count: { story: 3, normal: 1, hard: 1 }, // per stable
  eat: { story: 1, normal: 2, hard: 3 },   // provisions per donkey and meal
  sites: { story: true, normal: false, hard: false }, // also bring building materials to sites
  load: 12,        // goods on one trip (a carrier takes 6)
  deliver: 6,      // to a workshop's inputs (a carrier takes 3)
  speed: 2.6,      // m/s (a settler walks 3.9)
  wage: { story: 0, normal: 3, hard: 4 }, // Taler per donkey each payday (the drover's pay)
  price: 40,       // Taler for a new donkey when one was lost (plunderers drive them off)
};

const pick = (table, world) => {
  const d = world.meta && world.meta.difficulty;
  return Object.hasOwn(table, d) ? table[d] : table.normal;
};
export const donkeysPerStable = (world) => pick(DONKEYS.count, world);
export const donkeyFodder = (world) => pick(DONKEYS.eat, world);
export const donkeysSupplySites = (world) => pick(DONKEYS.sites, world);
export const donkeyWage = (world) => pick(DONKEYS.wage, world);
