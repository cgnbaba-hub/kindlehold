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
  maren: { id: 'maren', name: 'Maren Ashgrove', title: 'Lantern Warden', owner: 'p1', cls: 'hero', hp: 420, armor: 4, damage: 20, range: 2.2, cooldown: 1.3, speed: 4.2, sight: 14,
    cost: {}, trainTime: 0, desc: 'Lamplighter of the old roads. Her lantern steadies allies and blinds foes.' },
  // Rustfang Reavers
  reaver: { id: 'reaver', name: 'Reaver', owner: 'p2', cls: 'melee', hp: 120, armor: 1, damage: 14, range: 1.6, cooldown: 1.1, speed: 4.2, sight: 13, cost: {}, desc: 'Axe-raider of the Rustfang.' },
  slinger: { id: 'slinger', name: 'Slinger', owner: 'p2', cls: 'ranged', hp: 80, armor: 0, damage: 10, range: 13, cooldown: 1.7, speed: 3.8, sight: 15, cost: {}, desc: 'Hurls iron shot.' },
  brute: { id: 'brute', name: 'Brute', owner: 'p2', cls: 'defensive', hp: 180, armor: 4, damage: 10, range: 1.9, cooldown: 1.4, speed: 3.2, sight: 12, cost: {}, desc: 'Hide-shielded bruiser with a pike.' },
  vharek: { id: 'vharek', name: 'Vharek the Tollbreaker', owner: 'p2', cls: 'commander', hp: 700, armor: 5, damage: 35, range: 2.4, cooldown: 1.8, speed: 3.8, sight: 14, cost: {}, desc: 'Former bridge-warden turned warlord.' },
};

export const RECRUITABLE = ['shield', 'blade', 'fletcher'];

export const SETTLER = { hp: 60, speed: 3.9 }; // rested settlers (they sleep at night) walk a little faster

export function unitDef(type) {
  const d = UNITS[type];
  if (!d) throw new Error(`unknown unit type ${type}`);
  return d;
}
