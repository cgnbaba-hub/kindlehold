// The cast: which body, head, headgear, cloak, weapons and colours every figure style wears when the
// KayKit characters are drawn (see skinned-figures.js). Five modelled characters share one skeleton,
// so bodies and heads mix freely, and tint slots recolour skin, hair, cloth, metal and leather:
// that is how a handful of models becomes settlers, three armies and four enemy factions.

const BLUE = '#2f6f8f', CREAM = '#e3d6b0';
export const SETTLER_TUNICS = ['#8a6f4e', '#6f7b5a', '#9b7c52', '#5f6f7a', '#7a5f4e', '#8e8a6a', '#8a4e4a', '#4e6a7a'];
const HAIR = ['#4a3222', '#2a1e16', '#b8914e', '#8a4a24', '#6a5a4a', '#c8c0b0', '#3a2a1e', '#a0522d'];
const SKIN = ['#f5c6a5', '#f0c8a4', '#d9a57c', '#c48a60', '#a8704a', '#8a5638', '#e8bf9a'];
const TROUSERS = ['#5b4b3c', '#4a4a3e', '#6a5a44', '#3e4652', '#5a4632'];
const FUR = ['#7a6a5e', '#8a7a62', '#6a5a4a'];

/** Tools of the trade, by job (right hand). */
export const TOOL = { forester: 'axe', quarrier: 'pick', miner: 'pick', farmer: 'sickle', hunter: 'spear', fisher: 'rod', salter: 'rake', cook: 'ladle', smith: 'hammer' };
/** Work headwear, by job (drawn on the head bone). */
export const HAT = { farmer: 'strawhat', cook: 'toque', baker: 'toque' };

// soldiers and leaders: body/head/headgear/cloak, weapons, colours, how they fight
const S = {
  shield: { body: 'Knight', head: 'Knight_Head', rigid: ['Knight_Helmet'], right: 'spear', left: 'Badge_Shield', tints: { clothA: BLUE, clothB: CREAM }, weapon: 'thrust', guard: 'Blocking' },
  blade: { body: 'Knight', head: 'Knight_Head', rigid: ['Knight_Helmet'], right: '1H_Sword', tints: { clothA: BLUE, clothB: '#5d93ab' }, weapon: 'slash' },
  fletcher: { body: 'Rogue', head: 'Rogue_Head_Hooded', right: 'bow', tints: { clothA: '#4f6f4a', clothB: '#3f5a3c' }, weapon: 'bow' },
  crossbow: { body: 'Rogue', head: 'Knight_Head', rigid: ['Knight_Helmet'], right: '2H_Crossbow', tints: { clothA: '#3f5a6a', clothB: CREAM, clothC: '#4d4338' }, weapon: 'crossbow' },
  halberd: { body: 'Knight', head: 'Knight_Head', rigid: ['Knight_Helmet', 'Knight_Cape'], right: 'halberd', tints: { clothA: '#2a5a7a', clothB: '#d1a54a' }, weapon: 'thrust2' },
  sapper: { body: 'Barbarian', head: 'Barbarian_Head', right: 'maul', tints: { clothA: '#6e5a40', clothB: '#4d4338', clothC: BLUE, hair: '#5a4030' }, weapon: 'heavy' },
  maren: { body: 'Rogue', head: 'Rogue_Head_Hooded', rigid: ['Rogue_Cape'], right: 'pole', tints: { clothA: '#384a5c', clothB: '#24505e', clothC: '#3a3028', skin: '#f5c6a5' }, weapon: 'slash', hero: true },
  wren: { body: 'Rogue', head: 'Rogue_Head', rigid: ['Rogue_Cape'], right: 'bow', tints: { clothA: '#5a6a3e', clothB: '#6a5a3a', hair: '#a8622e', skin: '#e8bf9a' }, weapon: 'bow', scale: 1.08, hero: true },
  // the Rustfang reavers
  reaver: { body: 'Barbarian', head: 'Barbarian_Head', rigid: ['Barbarian_Hat'], right: '1H_Axe', tints: { clothA: '#8c3b2a', clothB: '#3a302a', hair: '#6a2e18' }, weapon: 'slash' },
  slinger: { body: 'Rogue', head: 'Rogue_Head_Hooded', right: 'sling', tints: { clothA: '#7a5a3e', clothB: '#5b2a20' }, weapon: 'sling' },
  brute: { body: 'Barbarian', head: 'Barbarian_Head', rigid: ['Barbarian_Hat'], right: 'spear', left: 'Barbarian_Round_Shield', tints: { clothA: '#5b2a20', clothB: '#3a302a', clothC: '#6a5040', hair: '#3a2a1e' }, weapon: 'thrust', scale: 1.06 },
  vharek: { body: 'Barbarian', head: 'Barbarian_Head', rigid: ['Barbarian_Hat', 'Barbarian_Cape'], right: '2H_Axe', tints: { clothA: '#3a302a', clothB: '#2a2420', clothC: '#6e2a1c', hair: '#8c3b1f' }, weapon: 'heavy', scale: 1.28 },
  // the Legion of Varr
  varrspear: { body: 'Knight', head: 'Knight_Head', rigid: ['Knight_Helmet'], right: 'spear', left: 'Rectangle_Shield', tints: { clothA: '#8a1c2c', clothB: '#d8d0c0' }, weapon: 'thrust', guard: 'Blocking' },
  varrbow: { body: 'Rogue', head: 'Knight_Head', rigid: ['Knight_Helmet'], right: '2H_Crossbow', tints: { clothA: '#6a2430', clothB: '#d8d0c0', clothC: '#3a3a3c' }, weapon: 'crossbow' },
  varrknight: { body: 'Knight', head: 'Knight_Head', rigid: ['Knight_Helmet', 'Knight_Cape'], right: '1H_Sword', left: 'Badge_Shield', tints: { clothA: '#8a1c2c', clothB: '#d8d0c0' }, weapon: 'slash', scale: 1.06 },
  ysolde: { body: 'Knight', head: 'Rogue_Head', rigid: ['Knight_Cape'], right: '1H_Sword', left: 'Badge_Shield', tints: { clothA: '#8a1c2c', clothB: '#e8d8b0', hair: '#c8a060' }, weapon: 'slash', scale: 1.2, hero: true },
  // the Greyfen brigands
  brigand: { body: 'Barbarian', head: 'Barbarian_Head', right: '1H_Axe', left: 'Round_Shield', tints: { clothA: '#5a6a44', clothB: '#3a3428', clothC: '#6e5037', hair: '#5a4030' }, weapon: 'slash' },
  poacher: { body: 'Rogue', head: 'Rogue_Head_Hooded', right: 'bow', tints: { clothA: '#4a5638', clothB: '#6a5a3a' }, weapon: 'bow' },
  morwen: { body: 'Rogue', head: 'Rogue_Head_Hooded', rigid: ['Rogue_Cape'], right: 'bow', tints: { clothA: '#3e4a30', clothB: '#44582e' }, weapon: 'bow', scale: 1.15, hero: true },
  // the Order of the White Stag
  staghalberd: { body: 'Knight', head: 'Knight_Head', rigid: ['Knight_Helmet'], right: 'halberd', tints: { clothA: '#2e5a3a', clothB: '#e8e4d8' }, weapon: 'thrust2' },
  stagarcher: { body: 'Rogue', head: 'Rogue_Head_Hooded', right: 'bow', tints: { clothA: '#3a5a3a', clothB: '#e8e4d8' }, weapon: 'bow' },
  stagwarden: { body: 'Knight', head: 'Knight_Head', rigid: ['Knight_Helmet', 'Knight_Cape'], right: '1H_Sword', left: 'Badge_Shield', tints: { clothA: '#e8e4d8', clothB: '#2e5a3a' }, weapon: 'slash', scale: 1.06 },
  vane: { body: 'Knight', head: 'Barbarian_Head', rigid: ['Knight_Helmet', 'Knight_Cape'], right: '1H_Sword', left: 'Badge_Shield', tints: { clothA: '#e8e4d8', clothB: '#2e5a3a', hair: '#9a9088' }, weapon: 'slash', scale: 1.22, hero: true },
  // House Morrow
  ironguard: { body: 'Knight', head: 'Knight_Head', rigid: ['Knight_Helmet'], right: 'spear', left: 'Rectangle_Shield', tints: { clothA: '#d0a030', clothB: '#2a2a30', metal: '#5a5c62' }, weapon: 'thrust', guard: 'Blocking', scale: 1.05 },
  arbalest: { body: 'Rogue', head: 'Knight_Head', rigid: ['Knight_Helmet'], right: '2H_Crossbow', tints: { clothA: '#4a4038', clothB: '#2e2e34', clothC: '#2a2a2e', metal: '#5a5c62' }, weapon: 'crossbow' },
  delver: { body: 'Barbarian', head: 'Barbarian_Head', right: 'pick', tints: { clothA: '#5a4a36', clothB: '#3a3028', clothC: '#d0a030', hair: '#3a2a1e' }, weapon: 'heavy' },
  ismay: { body: 'Knight', head: 'Rogue_Head', rigid: ['Knight_Cape'], right: '1H_Sword', left: 'Badge_Shield', tints: { clothA: '#2e2e34', clothB: '#d0a030', hair: '#1e1a18', metal: '#6a6c72' }, weapon: 'slash', scale: 1.2, hero: true },
};

// everyday folk: five looks (women in tunic or long dress, men with and without beard)
const FOLK = [
  { body: 'Rogue', head: 'Rogue_Head' },
  { body: 'Barbarian', head: 'Knight_Head' },
  { body: 'Mage', head: 'Rogue_Head' },
  { body: 'Barbarian', head: 'Barbarian_Head' },
  { body: 'Rogue', head: 'Mage_Head' },
];

const cache = new Map();
/**
 * The costume of a figure. Soldiers wear their style's; settlers vary by id (look, colours, hair,
 * skin), and carry the tool of their job.
 * @returns {{ body: string, head: string, rigid: string[], right: string|null, left: string|null, tints: object, weapon: string, scale: number, guard?: string }}
 */
export function costume(style, phase = 0, tunic = null) {
  if (style !== 'settler') {
    const s = S[style] || S.shield;
    return s.cooked || (s.cooked = { rigid: [], right: null, left: null, scale: 1, ...s });
  }
  const key = `${phase}|${tunic}`;
  let c = cache.get(key);
  if (!c) {
    const look = FOLK[phase % FOLK.length];
    const cloth = tunic || SETTLER_TUNICS[phase % SETTLER_TUNICS.length];
    c = {
      ...look, rigid: [], right: null, left: null, weapon: 'unarmed', scale: 1,
      tints: { clothA: cloth, clothB: SETTLER_TUNICS[(phase * 3 + 1) % SETTLER_TUNICS.length], clothC: look.body === 'Barbarian' ? FUR[phase % FUR.length] : TROUSERS[phase % TROUSERS.length], hair: HAIR[phase % HAIR.length], skin: SKIN[(phase * 5 + 1) % SKIN.length], metal: '#8a8d92' },
    };
    if (cache.size > 2000) cache.clear();
    cache.set(key, c);
  }
  return c;
}

export const STYLES = Object.keys(S);
