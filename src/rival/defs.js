// A rival town in free play: a second Warden settles where the lord's seat would stand and plays the
// same economy as the player (the scripted bot of src/demo/bot.js, as owner p4), then marches on
// the player's Keep. The numbers below decide how hard that is (CLAUDE.md, "Schwierigkeit"):
//   goods       its starting goods (×, on top of the scenario's)
//   slow        it thinks every n-th second only (Story: half as often, so it grows slower)
//   firstAttack seconds before its army may first set out (× the peace-time choice)
//   size, grow  soldiers it waits for before an attack, and how many more for each later one
//   regroup     fewer soldiers than this turn back home
//   towers      Watchtowers by its Keep from the start (the raiders' seat has two as well)
//   hpMult      health of its soldiers (Hard: +10%, the same documented AI advantage as the raiders')
//   transport   it lays stone roads to its workshops and keeps a Donkey Stable, as a player would
//   hero        a Warden of its own (Maren's match: Beacon Flare, Kindle the Line)
// Measured with the player bot against it (scripts/balance-seeds.mjs free-<map>-rival, 4 maps x 16
// seeds): Story 62/64 won in ~20 min, Normal 61/64 in ~29, Hard 38/64 in ~31 (against the lord's
// seat: Normal 16/16 in 26.7, Hard 15/20 in 34.5). Notes from the tuning:
//   - without towers and bonus goods it was far too easy (Hard 44/48 won);
//   - roads and a Donkey Stable measured neutral (Hard 47/64 against 45/64);
//   - its own Warden outweighs everything else (with towers and bonus goods: Normal 12/32, Hard
//     2/32 won), so only Hard has one, and then neither towers nor bonus goods;
//   - plunder parties and attacks sweeping inward from the outskirts made it weaker (it spreads its
//     strength; Hard 30/32 won on two maps against 25/32), so it does not use them.
export const RIVAL_DIFFICULTY = {
  story: { goods: 0.8, slow: 2, firstAttack: 20 * 60, size: 8, grow: 2, regroup: 3, towers: 0, hpMult: 1, transport: true, hero: false },
  normal: { goods: 1.15, slow: 1, firstAttack: 15 * 60, size: 9, grow: 3, regroup: 4, towers: 2, hpMult: 1, transport: true, hero: false },
  hard: { goods: 1, slow: 1, firstAttack: 11 * 60, size: 10, grow: 3, regroup: 4, towers: 0, hpMult: 1, transport: true, hero: true },
};

export const RIVAL_COLOR = '#8a5bc4';

// the rival's town and Warden, drawn from the seed
export const RIVAL_TOWNS = [
  { town: 'Brackwater', lord: 'Edric Brack' },
  { town: 'Thornby', lord: 'Maud Thorne' },
  { town: 'Ashford', lord: 'Corwin Ash' },
  { town: 'Coldharbour', lord: 'Isolde Cole' },
  { town: 'Wyrmley', lord: 'Osmund Wyre' },
];

/** A rival soldier as it joins: on Hard a little tougher. */
export function rivalRecruit(world, u) {
  const m = rivalSettings(world).hpMult;
  if (u && m !== 1) { u.maxHp = Math.round(u.maxHp * m); u.hp = u.maxHp; }
  return u;
}

export function rivalSettings(world) {
  const d = world.meta && world.meta.difficulty;
  return Object.hasOwn(RIVAL_DIFFICULTY, d) ? RIVAL_DIFFICULTY[d] : RIVAL_DIFFICULTY.normal;
}

/** The rival's town and lord for this game ({ town, lord }), or null when there is none. */
export function rivalOf(world) {
  if (!world.rival) return null;
  return RIVAL_TOWNS[world.rival.name % RIVAL_TOWNS.length] || RIVAL_TOWNS[0];
}
