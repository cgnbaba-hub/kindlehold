// Technology tree (data). Researched at the Keep, one at a time.

export const TECHS = {
  axes: {
    id: 'axes', name: 'Keen Axes', branch: 'economy', cost: { timber: 40, iron: 10 }, time: 40, requires: [],
    desc: 'Foresters chop 35% faster. Their axes gain a bright edge.',
  },
  bracing: {
    id: 'bracing', name: 'Braced Timber', branch: 'construction', cost: { timber: 50, stone: 30 }, time: 45, requires: [],
    desc: 'Construction and repair 40% faster. Cottages cost 5 less timber.',
  },
  blades: {
    id: 'blades', name: 'Tempered Blades', branch: 'military', cost: { timber: 20, iron: 40 }, time: 50, requires: [], requiresBuilding: 'barracks',
    desc: 'Soldiers deal 25% more damage. Their blades turn blue-steel.',
  },
  charter: {
    id: 'charter', name: 'March Charter', branch: 'settlement', cost: { timber: 60, stone: 80, iron: 20 }, time: 60, requires: ['bracing'],
    desc: 'The Keep raises a banner tower: +6 housing, territory +10 m, unlocks the Watchtower.',
  },
};

export const TECH_ORDER = ['axes', 'bracing', 'blades', 'charter'];

export const TECH_EFFECTS = {
  chopSpeed: 1 / 0.65,   // axes: work time x0.65
  buildSpeed: 1.4,       // bracing
  cottageTimberDiscount: 5,
  damage: 1.25,          // blades
  charterHousing: 6,
  charterTerritory: 10,
};

export function hasTech(world, owner, id) {
  const p = world.players[owner];
  return !!(p && p.techs[id]);
}
