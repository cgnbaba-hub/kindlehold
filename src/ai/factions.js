// Enemy factions the AI can lead. A scenario picks one (scenario.enemy.faction); it is stored in
// world.ai.faction so saves keep it. Everything faction-specific the AI, missions and HUD need
// (hall, towers, muster cycle, commander, wording) lives here.

export const FACTIONS = {
  morrow: {
    id: 'morrow', name: 'House Morrow', short: 'Morrow', color: '#d0a030',
    hall: 'morrowhold', tower: 'morrowtower', hallName: 'Hold', fort: 'hold',
    cycle: ['ironguard', 'delver', 'arbalest', 'delver', 'ironguard', 'arbalest'],
    garrison: ['ironguard', 'ironguard', 'arbalest', 'delver', 'arbalest', 'ironguard'],
    commander: 'ismay', leader: 'Lady Ismay Morrow', leaderShort: 'Lady Ismay', portrait: 'ismay',
    fighters: 'householders',
    truceNote: 'House Morrow calls it interest on the debt. Paid, it buys a few quiet minutes.',
  },
  rustfang: {
    id: 'rustfang', name: 'Rustfang Reavers', short: 'Rustfang', color: '#8c3b2a',
    hall: 'warhall', tower: 'reavertower', hallName: 'Warhall', fort: 'ford fort',
    cycle: ['reaver', 'reaver', 'slinger', 'brute', 'reaver', 'slinger'],
    garrison: ['reaver', 'reaver', 'slinger', 'brute', 'reaver', 'slinger'],
    commander: 'vharek', leader: 'Vharek the Tollbreaker', leaderShort: 'Vharek', portrait: 'vharek',
    fighters: 'reavers',
    truceNote: 'Vharek never makes peace, but for a toll he keeps his reavers at home for a while.',
  },
  varr: {
    id: 'varr', name: 'Legion of Varr', short: 'Varr', color: '#8a1c2c',
    hall: 'varrkeep', tower: 'varrtower', hallName: 'Manor', fort: 'manor',
    cycle: ['varrspear', 'varrbow', 'varrknight', 'varrspear', 'varrbow', 'varrknight'],
    garrison: ['varrspear', 'varrspear', 'varrbow', 'varrknight', 'varrbow', 'varrspear'],
    commander: 'ysolde', leader: 'Ysolde, Margravine of Varr', leaderShort: 'the Margravine', portrait: 'ysolde',
    fighters: 'legionaries',
    truceNote: 'The Margravine calls it tribute. Paid, it keeps her legion behind the manor walls for a while.',
  },
  stag: {
    id: 'stag', name: 'Order of the White Stag', short: 'Stag', color: '#e8e4d8',
    hall: 'staghall', tower: 'stagtower', hallName: 'Chapterhouse', fort: 'chapterhouse',
    cycle: ['staghalberd', 'stagarcher', 'stagwarden', 'stagarcher', 'staghalberd', 'stagwarden'],
    garrison: ['staghalberd', 'staghalberd', 'stagarcher', 'stagwarden', 'stagarcher', 'stagwarden'],
    commander: 'vane', leader: 'Master Edric Vane', leaderShort: 'Master Vane', portrait: 'vane',
    fighters: 'wardens',
    truceNote: 'The Order sells peace like everything else: by the hour, paid in advance.',
  },
};

export function enemyFaction(world) {
  const id = world && world.ai && world.ai.faction;
  return (id && Object.hasOwn(FACTIONS, id)) ? FACTIONS[id] : FACTIONS.rustfang;
}

/** Is this building type the seat of an enemy faction (a hall the AI musters at)? */
export function isFactionHall(type) { return Object.values(FACTIONS).some((f) => f.hall === type); }
