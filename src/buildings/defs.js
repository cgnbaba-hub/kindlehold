// Building definitions (data only; shared by simulation, UI and rendering).
// Values are original to Kindlehold (see GAME_DESIGN.md).

/**
 * @typedef {Object} BuildingDef
 * @property {string} id
 * @property {string} name
 * @property {string} desc
 * @property {Record<string, number>} cost
 * @property {number} buildTime seconds with one builder
 * @property {number} hp
 * @property {number} radius footprint radius (m) used for placement/collision
 * @property {number} navRadius radius blocked on the nav grid
 * @property {number} [slots] worker slots
 * @property {string} [job] profession of workers
 * @property {number} [housing]
 * @property {number} [territory]
 * @property {string} [requiresTech]
 * @property {string} [deposit] deposit type needed within depositRange
 * @property {number} [depositRange]
 * @property {number} [outCap]
 * @property {string} owner 'p1' | 'p2' | 'any'
 * @property {boolean} [buildable] player can place it
 * @property {number} door [dx, dz] door offset in local space (for workers)
 */

export const BUILDINGS = {
  keep: {
    id: 'keep', name: 'Kindlehold Keep', owner: 'p1', buildable: false,
    desc: 'The hearth-keep. Stores all goods, houses settlers, researches improvements.',
    cost: {}, buildTime: 0, hp: 2200, radius: 7.5, navRadius: 6.5, housing: 6, territory: 34, door: [0, 7.8],
    attack: { damage: 9, range: 15, cooldown: 1.8, requiresLit: true }, damageTaken: 0.7,
  },
  cottage: {
    id: 'cottage', name: 'Cottage', owner: 'p1', buildable: true,
    desc: 'A thatched home for five settlers.',
    cost: { timber: 20, stone: 10 }, buildTime: 20, hp: 300, radius: 3.6, navRadius: 3, housing: 5, door: [0, 3.6],
  },
  lodge: {
    id: 'lodge', name: "Woodcutter's Lodge", owner: 'p1', buildable: true,
    desc: 'Foresters fell nearby trees (within 28 m) for timber.',
    cost: { timber: 25, stone: 5 }, buildTime: 18, hp: 350, radius: 4, navRadius: 3.2, slots: 2, job: 'forester',
    deposit: 'tree', depositRange: 28, outCap: 8, door: [0, 4],
  },
  quarry: {
    id: 'quarry', name: 'Quarry', owner: 'p1', buildable: true,
    desc: 'Quarriers cut stone from outcrops within 24 m.',
    cost: { timber: 30 }, buildTime: 20, hp: 400, radius: 4.2, navRadius: 3.2, slots: 2, job: 'quarrier',
    deposit: 'rock', depositRange: 24, outCap: 8, door: [0, 4.2],
  },
  farm: {
    id: 'farm', name: 'Farmstead', owner: 'p1', buildable: true,
    desc: 'Farmers sow and harvest the surrounding plots for provisions.',
    cost: { timber: 30, stone: 10 }, buildTime: 22, hp: 350, radius: 4.5, navRadius: 3.5, slots: 2, job: 'farmer',
    outCap: 10, plotRadius: 10, door: [0, 4.5],
  },
  mine: {
    id: 'mine', name: 'Iron Mine', owner: 'p1', buildable: true,
    desc: 'Built against an iron vein (within 10 m). Miners eat 1 provision per 2 iron.',
    cost: { timber: 30, stone: 20 }, buildTime: 26, hp: 450, radius: 4, navRadius: 3.2, slots: 1, job: 'miner',
    deposit: 'iron', depositRange: 10, outCap: 8, inCap: 6, door: [0, 4],
  },
  barracks: {
    id: 'barracks', name: 'Barracks', owner: 'p1', buildable: true,
    desc: 'Trains idle settlers into soldiers.',
    cost: { timber: 40, stone: 40, iron: 10 }, buildTime: 30, hp: 700, radius: 5.5, navRadius: 4.6, door: [0, 5.5],
  },
  tower: {
    id: 'tower', name: 'Watchtower', owner: 'p1', buildable: true, requiresTech: 'charter',
    desc: 'Shoots raiders within 16 m and extends your territory.',
    cost: { timber: 20, stone: 40, iron: 5 }, buildTime: 24, hp: 600, radius: 2.8, navRadius: 2.4, territory: 20,
    attack: { damage: 14, range: 16, cooldown: 1.5 }, door: [0, 2.8],
  },
  // --- Rustfang Reavers (enemy) ---
  warhall: {
    id: 'warhall', name: 'Rustfang Warhall', owner: 'p2', buildable: false,
    desc: "Vharek's war-hall at the ford fort. Destroy it to free the March.",
    cost: {}, buildTime: 0, hp: 2400, radius: 7, navRadius: 6, territory: 30, door: [0, 7.2],
  },
  reavertower: {
    id: 'reavertower', name: 'Rustfang Lookout', owner: 'p2', buildable: false,
    desc: 'A crude lookout that pelts intruders with stones.',
    cost: {}, buildTime: 0, hp: 500, radius: 2.6, navRadius: 2.2, attack: { damage: 10, range: 14, cooldown: 1.8 }, door: [0, 2.6],
  },
};

export const PLAYER_BUILD_ORDER = ['cottage', 'lodge', 'farm', 'quarry', 'mine', 'barracks', 'tower'];

export function buildingDef(type) {
  const d = BUILDINGS[type];
  if (!d) throw new Error(`unknown building type ${type}`);
  return d;
}

/** Door position in world space for a building entity. */
export function doorOf(b) {
  const d = BUILDINGS[b.type];
  const [dx, dz] = d.door || [0, d.radius];
  const c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0);
  return { x: b.x + dx * c + dz * s, z: b.z - dx * s + dz * c };
}
