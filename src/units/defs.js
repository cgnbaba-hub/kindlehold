// Unit definitions (data). Balance values are original to Kindlehold.

export const UNIT_CLASSES = ['melee', 'ranged', 'defensive', 'hero', 'commander'];

/** attacker class -> defender class -> multiplier */
export const COUNTERS = {
  melee: { ranged: 1.75 },
  ranged: { defensive: 2.0 },
  defensive: { melee: 2.0 },
};

export const UNITS = {
  // Hearthbound
  shield: { id: 'shield', name: 'Shieldbearer', owner: 'p1', cls: 'defensive', hp: 200, armor: 5, damage: 10, range: 1.8, cooldown: 1.2, speed: 3.4, sight: 12,
    cost: { timber: 5, iron: 10, provisions: 5 }, trainTime: 8, desc: 'Sturdy spear-and-shield line. Strong against blades.' },
  blade: { id: 'blade', name: 'Bladesman', owner: 'p1', cls: 'melee', hp: 140, armor: 2, damage: 16, range: 1.6, cooldown: 1.0, speed: 4.3, sight: 12,
    cost: { iron: 20, provisions: 5 }, trainTime: 8, desc: 'Fast swordsman. Cuts down archers and slingers.' },
  fletcher: { id: 'fletcher', name: 'Fletcher', owner: 'p1', cls: 'ranged', hp: 90, armor: 0, damage: 12, range: 15, cooldown: 1.6, speed: 3.8, sight: 16,
    cost: { timber: 15, provisions: 5 }, trainTime: 8, desc: 'Longbow archer. Arcing shots pierce shield lines.' },
  crossbow: { id: 'crossbow', name: 'Crossbowman', owner: 'p1', cls: 'ranged', hp: 110, armor: 2, damage: 22, range: 17, cooldown: 2.4, speed: 3.5, sight: 17, requiresLevel: 2,
    pierce: 0.5, cost: { timber: 20, iron: 15, provisions: 5 }, trainTime: 10, desc: 'Heavy bolts that punch through armour and shields. Slow to reload. Needs the Drill Yard.' },
  halberd: { id: 'halberd', name: 'Halberdier', owner: 'p1', cls: 'defensive', hp: 250, armor: 7, damage: 16, range: 2.5, cooldown: 1.4, speed: 3.2, sight: 12, requiresLevel: 2,
    cost: { timber: 10, iron: 30, provisions: 5 }, trainTime: 10, desc: 'Armoured elite with a long halberd: holds any line against blades and raiders. Needs the Drill Yard.' },
  sapper: { id: 'sapper', name: 'Sapper', owner: 'p1', cls: 'melee', hp: 120, armor: 1, damage: 12, range: 1.7, cooldown: 1.4, speed: 3.8, sight: 12, requiresLevel: 2,
    vsBuildings: 4, cost: { timber: 20, iron: 10, provisions: 5 }, trainTime: 10, desc: 'Siege engineer with a heavy maul: breaks gates and walls four times faster than any soldier, but is no match for them in the field. Needs the Drill Yard.' },
  maren: { id: 'maren', name: 'Maren Ashgrove', title: 'Lantern Warden', owner: 'p1', cls: 'hero', hp: 420, armor: 4, damage: 20, range: 2.2, cooldown: 1.3, speed: 4.2, sight: 14,
    cost: {}, trainTime: 0, desc: 'Lamplighter of the old roads. Her lantern steadies allies and blinds foes.' },
  // Rustfang Reavers
  reaver: { id: 'reaver', name: 'Reaver', owner: 'p2', cls: 'melee', hp: 120, armor: 1, damage: 14, range: 1.6, cooldown: 1.1, speed: 4.2, sight: 13, cost: {}, desc: 'Axe-raider of the Rustfang.' },
  slinger: { id: 'slinger', name: 'Slinger', owner: 'p2', cls: 'ranged', hp: 80, armor: 0, damage: 10, range: 13, cooldown: 1.7, speed: 3.8, sight: 15, cost: {}, desc: 'Hurls iron shot.' },
  brute: { id: 'brute', name: 'Brute', owner: 'p2', cls: 'defensive', hp: 180, armor: 4, damage: 10, range: 1.9, cooldown: 1.4, speed: 3.2, sight: 12, cost: {}, desc: 'Hide-shielded bruiser with a pike.' },
  // Greyfen brigands (p3)
  brigand: { id: 'brigand', name: 'Greyfen Brigand', owner: 'p3', cls: 'melee', hp: 115, armor: 1, damage: 13, range: 1.6, cooldown: 1.05, speed: 4.4, sight: 13, cost: {}, desc: 'Marsh outlaw with a hatchet and a quick temper.' },
  poacher: { id: 'poacher', name: 'Greyfen Poacher', owner: 'p3', cls: 'ranged', hp: 80, armor: 0, damage: 11, range: 15, cooldown: 1.6, speed: 3.9, sight: 16, cost: {}, desc: 'Deer-hunter turned outlaw. A keen shot.' },
  morwen: { id: 'morwen', name: 'Morwen Greyfen', owner: 'p3', cls: 'commander', hp: 520, armor: 3, damage: 24, range: 15, cooldown: 1.5, speed: 4.2, sight: 16, cost: {}, desc: 'Chieftain of the Greyfen brigands. Proud, clever, and owes the Rustfang a blood debt.' },
  // the Legion of Varr (p2 in chapter four): disciplined lowland troops
  varrspear: { id: 'varrspear', name: 'Varr Pikeman', owner: 'p2', cls: 'defensive', hp: 170, armor: 4, damage: 11, range: 2.3, cooldown: 1.4, speed: 3.3, sight: 12, cost: {}, desc: 'A legion pikeman behind a crimson kite shield.' },
  varrbow: { id: 'varrbow', name: 'Varr Crossbowman', owner: 'p2', cls: 'ranged', hp: 85, armor: 1, damage: 15, range: 14, cooldown: 2.2, speed: 3.6, sight: 15, pierce: 0.4, cost: {}, desc: 'Slow to reload; the bolts punch through armour.' },
  varrknight: { id: 'varrknight', name: 'Knight of Varr', owner: 'p2', cls: 'melee', hp: 210, armor: 5, damage: 18, range: 1.7, cooldown: 1.3, speed: 3.6, sight: 13, cost: {}, desc: 'Mailed swordsman of the Margravine\'s household.' },
  ysolde: { id: 'ysolde', name: 'Ysolde of Varr', owner: 'p2', cls: 'commander', hp: 760, armor: 6, damage: 30, range: 2.2, cooldown: 1.4, speed: 3.9, sight: 15, cost: {}, desc: 'Margravine of Varr. She believes every road leads to her treasury.' },
  // the Order of the White Stag (p2 in chapter five): merchant-knights of the lowland roads
  staghalberd: { id: 'staghalberd', name: 'Stag Halberdier', owner: 'p2', cls: 'defensive', hp: 180, armor: 4, damage: 13, range: 2.5, cooldown: 1.4, speed: 3.3, sight: 12, cost: {}, desc: 'A long halberd and a white tabard: the Order\'s road-wardens.' },
  stagarcher: { id: 'stagarcher', name: 'Stag Longbowman', owner: 'p2', cls: 'ranged', hp: 90, armor: 1, damage: 13, range: 17, cooldown: 1.7, speed: 3.8, sight: 17, cost: {}, desc: 'Forest archer with a yew longbow. Outranges every bow of the valley.' },
  stagwarden: { id: 'stagwarden', name: 'Warden of the Stag', owner: 'p2', cls: 'melee', hp: 200, armor: 5, damage: 17, range: 1.7, cooldown: 1.2, speed: 3.7, sight: 13, cost: {}, desc: 'Knight-brother of the Order in green enamel mail.' },
  vane: { id: 'vane', name: 'Master Edric Vane', owner: 'p2', cls: 'commander', hp: 800, armor: 6, damage: 28, range: 2.4, cooldown: 1.3, speed: 3.8, sight: 15, cost: {}, desc: 'Master of the Order of the White Stag. Every toll on every lowland road ends in his ledger.' },
  vharek: { id: 'vharek', name: 'Vharek the Tollbreaker', owner: 'p2', cls: 'commander', hp: 700, armor: 5, damage: 35, range: 2.4, cooldown: 1.8, speed: 3.8, sight: 14, cost: {}, desc: 'Former bridge-warden turned warlord.' },
};

export const RECRUITABLE = ['shield', 'blade', 'fletcher', 'crossbow', 'halberd', 'sapper'];

export const SETTLER = { hp: 60, speed: 3.9 }; // rested settlers (they sleep at night) walk a little faster

export function unitDef(type) {
  const d = UNITS[type];
  if (!d) throw new Error(`unknown unit type ${type}`);
  return d;
}
