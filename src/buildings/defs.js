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
    cost: { timber: 25, stone: 15 }, buildTime: 22, hp: 450, radius: 4, navRadius: 3.2, slots: 1, job: 'miner',
    deposit: 'iron', depositRange: 10, outCap: 8, inCap: 6, door: [0, 4],
  },
  saltworks: {
    id: 'saltworks', name: 'Salt Works', owner: 'p1', buildable: true,
    desc: 'A salter rakes salt from a pan on the shore (within 12 m). Salt pans never run dry; the salt is sold on the road for Taler.',
    cost: { timber: 25, stone: 10 }, buildTime: 18, hp: 320, radius: 3.4, navRadius: 2.8, slots: 1, job: 'salter',
    deposit: 'salt', depositRange: 12, outCap: 30, door: [0, 3.4],
  },
  hunter: {
    id: 'hunter', name: "Hunter's Hut", owner: 'p1', buildable: true,
    desc: 'A hunter stalks the deer herds within 45 m for meat (provisions). Hunting goes on in winter.',
    cost: { timber: 25, stone: 5 }, buildTime: 16, hp: 300, radius: 3.4, navRadius: 2.8, slots: 1, job: 'hunter',
    huntRange: 45, outCap: 8, door: [0, 3.4],
  },
  fisher: {
    id: 'fisher', name: "Fisher's Hut", owner: 'p1', buildable: true,
    desc: 'A fisher casts a line in the river for fish (provisions). Must stand within 30 m of a river or lake; slower when the water is frozen.',
    cost: { timber: 20, stone: 5 }, buildTime: 14, hp: 280, radius: 3.2, navRadius: 2.6, slots: 1, job: 'fisher',
    waterRange: 30, outCap: 8, door: [0, 3.2],
  },
  canteen: {
    id: 'canteen', name: 'Tavern', owner: 'p1', buildable: true,
    desc: 'The cook turns provisions into hot meals: one provision feeds one and a half people, and warm meals lift stability.',
    cost: { timber: 30, stone: 20 }, buildTime: 24, hp: 450, radius: 4.4, navRadius: 3.6, slots: 1, job: 'cook',
    inCap: 10, mealCap: 30, door: [0, 4.4],
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
  brigandhall: {
    id: 'brigandhall', name: 'Greyfen Hold', owner: 'p3', buildable: false,
    desc: "The brigands' timber longhouse in the northern fens.",
    cost: {}, buildTime: 0, hp: 1800, radius: 6.5, navRadius: 5.5, territory: 30, door: [0, 6.8],
  },
  brigandtower: {
    id: 'brigandtower', name: 'Greyfen Watch', owner: 'p3', buildable: false,
    desc: 'A brigand lookout with a keen-eyed poacher on top.',
    cost: {}, buildTime: 0, hp: 450, radius: 2.6, navRadius: 2.2, attack: { damage: 11, range: 15, cooldown: 1.7 }, door: [0, 2.6],
  },
  varrkeep: {
    id: 'varrkeep', name: 'Manor of Varr', owner: 'p2', buildable: false,
    desc: 'The Margravine\'s fortified manor on the eastern rise. Its legion guards the salt road.',
    cost: {}, buildTime: 0, hp: 2800, radius: 7.5, navRadius: 6.5, territory: 32, door: [0, 7.6],
  },
  staghall: {
    id: 'staghall', name: 'Chapterhouse of the White Stag', owner: 'p2', buildable: false,
    desc: 'The Order\'s walled chapterhouse. Its walls shrug off swords and arrows — bring Sappers.',
    cost: {}, buildTime: 0, hp: 3200, radius: 8, navRadius: 7, territory: 34, door: [0, 8.2], walls: 0.3,
  },
  stagtower: {
    id: 'stagtower', name: 'Stag Watchtower', owner: 'p2', buildable: false,
    desc: 'A white-stone tower with a longbowman on the parapet. Its walls stand firm against all but Sappers.',
    cost: {}, buildTime: 0, hp: 600, radius: 2.8, navRadius: 2.4, attack: { damage: 12, range: 18, cooldown: 1.8 }, door: [0, 2.8], walls: 0.5,
  },
  varrtower: {
    id: 'varrtower', name: 'Varr Watchtower', owner: 'p2', buildable: false,
    desc: 'A stone tower with a crossbowman behind its crenels.',
    cost: {}, buildTime: 0, hp: 650, radius: 2.8, navRadius: 2.4, attack: { damage: 13, range: 16, cooldown: 1.9 }, door: [0, 2.8],
  },
  reavertower: {
    id: 'reavertower', name: 'Rustfang Lookout', owner: 'p2', buildable: false,
    desc: 'A crude lookout that pelts intruders with stones.',
    cost: {}, buildTime: 0, hp: 500, radius: 2.6, navRadius: 2.2, attack: { damage: 10, range: 14, cooldown: 1.8 }, door: [0, 2.6],
  },
};

// Upgrades (levels 2 and 3). Each entry lists the bonuses gained on reaching that level;
// bonuses add up. `requires` gates a level behind another building's level.
const WORKSHOP_L2 = { name: null, cost: { timber: 20, stone: 25, taler: 25 }, time: 30, slots: 1, speed: 1.2, hp: 150, desc: 'One more worker and 20% faster work.' };
export const UPGRADES = {
  keep: {
    2: { name: 'Kindlehold Castle', cost: { timber: 40, stone: 80, taler: 60 }, time: 60, territory: 14, housing: 4, hp: 600, tax: 0.25,
      desc: 'Curtain walls and a second tower: territory +14 m, +4 housing, +25% taxes.' },
    3: { name: 'Kindlehold Fortress', cost: { timber: 60, stone: 140, iron: 20, taler: 120 }, time: 90, territory: 12, housing: 4, hp: 800, tax: 0.25, requiresTech: 'charter',
      desc: 'Gatehouse and great tower: territory +12 m, +4 housing, +25% taxes. Needs the March Charter.' },
  },
  cottage: {
    2: { name: 'Stone House', cost: { stone: 20, taler: 15 }, time: 25, housing: 3, hp: 150, desc: 'Stone walls and a slate roof: +3 housing.' },
    3: { name: 'Townhouse', cost: { timber: 15, stone: 30, taler: 30 }, time: 30, housing: 3, hp: 150, requiresKeep: 2, desc: 'A wing and dormers: +3 housing. Needs the Castle.' },
  },
  lodge: { 2: { ...WORKSHOP_L2, name: "Woodcutter's Hall" } },
  quarry: { 2: { ...WORKSHOP_L2, name: 'Stoneworks' } },
  farm: { 2: { ...WORKSHOP_L2, name: 'Manor Farm' } },
  mine: { 2: { ...WORKSHOP_L2, name: 'Deep Mine', cost: { timber: 30, stone: 30, taler: 35 } } },
  hunter: { 2: { ...WORKSHOP_L2, name: 'Hunting Lodge' } },
  fisher: { 2: { ...WORKSHOP_L2, name: 'Fishery' } },
  saltworks: { 2: { ...WORKSHOP_L2, name: 'Salt House' } },
  barracks: { 2: { name: 'Drill Yard', cost: { timber: 40, stone: 30, iron: 20, taler: 60 }, time: 45, speed: 1.25, hp: 250, desc: 'Unlocks Crossbowmen, Halberdiers and Sappers; training 25% faster.' } },
  canteen: { 2: { ...WORKSHOP_L2, name: 'Inn', desc: 'A second cook and 20% faster cooking.' } },
};

export function levelOf(b) { return b.level || 1; }
/** The next upgrade for a building (or null at the top level). */
export function nextUpgrade(b) { const u = UPGRADES[b.type]; return (u && u[levelOf(b) + 1]) || null; }
/** Sum of an upgrade bonus up to the building's current level. */
export function upgradeBonus(b, key) {
  const u = UPGRADES[b.type];
  if (!u) return 0;
  let s = 0;
  for (let l = 2; l <= levelOf(b); l++) if (u[l] && u[l][key]) s += u[l][key];
  return s;
}
export function slotsOf(b) { return (BUILDINGS[b.type].slots || 0) + upgradeBonus(b, 'slots'); }
export function workSpeedOf(b) { return b && levelOf(b) > 1 && UPGRADES[b.type] && UPGRADES[b.type][2].speed ? UPGRADES[b.type][2].speed : 1; }
export function displayName(b) {
  const u = UPGRADES[b.type];
  for (let l = levelOf(b); l >= 2; l--) if (u && u[l] && u[l].name) return u[l].name;
  return BUILDINGS[b.type].name;
}

export const PLAYER_BUILD_ORDER = ['cottage', 'lodge', 'farm', 'hunter', 'fisher', 'canteen', 'quarry', 'mine', 'saltworks', 'barracks', 'tower'];

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
