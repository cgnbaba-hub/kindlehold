// Free-play setup ("skirmish lobby"): the choices a player makes before a free game. They live in
// world.meta.skirmish and are applied once by the scenario setup (missions/setup.js).
// The defaults are the game as before. Rich goods and a long peace make the game easier, lean goods
// and a short peace harder (CLAUDE.md, "Schwierigkeit"): the menu says so next to each choice, and
// scripts/balance-seeds.mjs can measure them (KH_GOODS, KH_PEACE).
// Measured with the bot on Free Play Harrowmere (16 Normal / 20 Hard seeds; minutes to victory,
// wins): standard 26.7 min / 15 of 20; rich 22.1 / 19; lean (×0.5) 29.9 (one loss) / 12; short
// peace 27.2 / 12. A long peace makes the bot slower (31.6 / 15: it attacks on the raid rhythm),
// for a player it is breathing room before the first raid. Lean at ×0.7 was hardly felt (25.9 / 14).
import { FACTIONS } from '../ai/factions.js';

export const SKIRMISH_GOODS = {
  lean: { name: 'Lean', mult: 0.5, note: 'harder' },
  standard: { name: 'Standard', mult: 1, note: '' },
  rich: { name: 'Rich', mult: 1.5, note: 'easier' },
};
// the time before the first warning, the first raid and the first plunderers (or the rival's first attack)
export const SKIRMISH_PEACE = {
  short: { name: 'Short', mult: 0.65, note: 'harder' },
  standard: { name: 'Standard', mult: 1, note: '' },
  long: { name: 'Long', mult: 1.6, note: 'easier' },
};
/** Whom you face: the lord's fortified seat and its raids, or a rival town that grows as you do (src/rival). */
export const SKIRMISH_OPPONENTS = {
  seat: { name: "Lord's seat", note: 'raids from a fortified seat' },
  rival: { name: 'Rival town', note: 'a second Warden builds and attacks' },
};
/** Who holds a random valley: drawn from the seed, or one lord picked by the player. */
export const SKIRMISH_FACTIONS = ['random', ...Object.keys(FACTIONS).sort()];

export const SKIRMISH_DEFAULT = { goods: 'standard', peace: 'standard', faction: 'random', opponent: 'seat' };

/** Only known choices survive (menus, saves, URL parameters). */
export function sanitizeSkirmish(s) {
  const src = s && typeof s === 'object' ? s : {};
  return {
    goods: Object.hasOwn(SKIRMISH_GOODS, src.goods) ? src.goods : SKIRMISH_DEFAULT.goods,
    peace: Object.hasOwn(SKIRMISH_PEACE, src.peace) ? src.peace : SKIRMISH_DEFAULT.peace,
    faction: SKIRMISH_FACTIONS.includes(src.faction) ? src.faction : SKIRMISH_DEFAULT.faction,
    opponent: Object.hasOwn(SKIRMISH_OPPONENTS, src.opponent) ? src.opponent : SKIRMISH_DEFAULT.opponent,
  };
}

/** A seed the player typed: letters, digits and dashes, at most 16; empty means "draw one". */
export function cleanSeed(text) {
  const s = String(text ?? '').trim().replace(/[^A-Za-z0-9-]/g, '').slice(0, 16);
  return s || null;
}
