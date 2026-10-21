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
// Measured with the player bot against it (scripts/balance-seeds.mjs free-<map>-rival, 4 maps x 16
// seeds): Story 63/64 won in ~20 min, Normal 60/64 in ~28, Hard 45/64 in ~34 (against the lord's
// seat: Normal 16/16 in 26.7, Hard 15/20 in 34.5). Without towers and bonus goods it was far too easy
// (Hard 44/48 won).
export const RIVAL_DIFFICULTY = {
  story: { goods: 0.8, slow: 2, firstAttack: 20 * 60, size: 8, grow: 2, regroup: 3, towers: 0, hpMult: 1 },
  normal: { goods: 1.15, slow: 1, firstAttack: 15 * 60, size: 9, grow: 3, regroup: 4, towers: 2, hpMult: 1 },
  hard: { goods: 1.5, slow: 1, firstAttack: 11 * 60, size: 10, grow: 3, regroup: 4, towers: 2, hpMult: 1.1 },
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
