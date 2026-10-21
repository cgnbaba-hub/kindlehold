import { UPGRADES, BUILDINGS, doorOf } from '../buildings/defs.js';
import { keepOf, HAND, handsOf, handsCap } from '../population/index.js';
// Scripted player ("bot") that plays the scenario only through the public command API.
// Used by the happy-path simulation test, balancing, and verification demo states.
import { PLAYER, ENEMY } from '../core/contracts.js';
import { all, statsOf } from '../world/world.js';
import { checkPlacement, buildCost } from '../construction/index.js';
import { canAfford } from '../economy/stock.js';
import { researchBlocker } from '../technology/index.js';
import { countBuilt, soldierCount } from '../missions/conditions.js';
import { UNITS } from '../units/defs.js';
import { ABILITIES, abilityReady } from '../heroes/index.js';
import { warhallOf } from '../ai/index.js';
import { hostile } from '../diplomacy/index.js';
import { occupiedBy } from '../pois/index.js';
import { checkStretch } from '../transport/roads.js';
import { ROADS } from '../transport/defs.js';

/** Spiral search for a valid building spot near (x,z). */
export function findSpot(world, services, type, x, z, maxR = 34, owner = PLAYER) {
  for (let r = 0; r <= maxR; r += 2) {
    const steps = Math.max(1, Math.round((2 * Math.PI * r) / 3));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const px = Math.round(x + Math.cos(a) * r), pz = Math.round(z + Math.sin(a) * r);
      if (checkPlacement(world, services, owner, type, px, pz).ok) return { x: px, z: pz };
    }
  }
  return null;
}

const SITES = {
  lodge: [-66, 40], farm: [-36, 66], cottage: [-54, 64], quarry: [-28, 68], mine: [-73, 62], barracks: [-34, 38], tower: [-30, 30],
};

const NO_SPOT_WAIT = 3000; // ticks a building type is skipped after no spot was found for it

const isActive = (world, id) => (world.mission.objectives.find((o) => o.id === id) || {}).state === 'active';

/**
 * `transport`: true lays stone roads from the Keep to the workshops and keeps a Donkey Stable,
 * 'roads' or 'donkeys' only one of them (off by default, so balance runs can measure how much
 * they ease the game).
 */
export function createBot(sim, { aggressive = true, transport = false, priority = false, owner = PLAYER, foe = null, state = null, assault = null } = {}) {
  const w = () => sim.world;
  const services = sim.services;
  const log = [];
  // whose town this is: the player's (tests, balance, demos) or a rival's (free play, src/rival)
  const me = owner;
  const issue = (cmd) => sim.issue(me === PLAYER ? cmd : { ...cmd, owner: me });
  // phase and the last order: a rival keeps them in the world (state), so a save continues identically
  const local = { phase: 'economy', lastAct: -999 };
  const S = () => (state ? state(sim.world) : local);

  // the scripted layout was drawn for Harrowmere (keep at -46,50): shift it to this town
  const ownKeep = keepOf(sim.world, me);
  const home = me === PLAYER || !ownKeep ? services.terrain.map.playerStart : { x: ownKeep.x, z: ownKeep.z };
  const rel = ([x, z]) => [x + 46 + home.x, z - 50 + home.z];
  const abs = (x, z) => [x - 46 - home.x, z + 50 - home.z]; // world position -> layout coordinates for place()

  /** Fallback search centre: next to the nearest deposit the building needs, or the nearest water. */
  function fallbackCentre(world, type) {
    const def = BUILDINGS[type];
    if (def.deposit) {
      let best = null, bd = Infinity;
      for (const d of all(world, 'deposit')) {
        if (d.type !== def.deposit || d.amount <= 0) continue;
        const dd = Math.hypot(d.x - home.x, d.z - home.z);
        if (dd < bd) { bd = dd; best = d; }
      }
      return best ? [best.x, best.z] : null;
    }
    if (def.waterRange) {
      const wtr = services.terrain.nearestWater(home.x, home.z, 110);
      if (!wtr) return null;
      const len = wtr.d || 1;
      return [wtr.x + ((home.x - wtr.x) / len) * 16, wtr.z + ((home.z - wtr.z) / len) * 16];
    }
    return null;
  }

  function place(type, near) {
    const world = w();
    if (!canAfford(world, me, buildCost(world, me, type))) return false;
    const [x, z] = rel(near || SITES[type] || [-46, 50]);
    let spot = findSpot(world, services, type, x, z, 34, me);
    if (!spot) { const c = fallbackCentre(world, type); if (c) spot = findSpot(world, services, type, c[0], c[1], 26, me); }
    if (!spot) {
      // nowhere to put it (out of reach of its deposit, or no room): skip this step for a while
      log.push(`${world.tick}: no spot for ${type}`);
      (S().noSpot ||= {})[type] = world.tick;
      return false;
    }
    issue({ type: 'place', buildingType: type, x: spot.x, z: spot.z, rot: Math.atan2(home.x - spot.x, home.z - spot.z) + Math.PI });
    log.push(`${world.tick}: place ${type} @${spot.x},${spot.z}`);
    return true;
  }

  /** Not lately found to have no spot anywhere (see place). */
  const can = (type) => !(S().noSpot && w().tick - (S().noSpot[type] ?? -1e9) < NO_SPOT_WAIT);
  const count = (type) => all(w(), 'building').filter((b) => b.owner === me && b.type === type && b.state !== 'destroyed').length;
  const soldiers = () => all(w(), 'unit').filter((u) => u.owner === me && !u.hero);
  const hero = () => all(w(), 'unit').find((u) => u.owner === me && u.type === 'maren');
  const wren = () => all(w(), 'unit').find((u) => u.owner === me && u.type === 'wren');

  // roads: one workshop at a time, along the route its carriers walk, while stone allows
  const roadDone = new Set();
  const ROAD_TO = ['lodge', 'quarry', 'farm', 'mine', 'hunter', 'fisher', 'saltworks', 'mill', 'bakery', 'smithy', 'canteen', 'storehouse'];
  function roadStep(world, p) {
    const k = keepOf(world, me);
    if (!k || p.res.stone < 60) return;
    const kd = doorOf(k);
    const b = all(world, 'building').filter((x) => x.owner === me && x.state === 'active' && ROAD_TO.includes(x.type) && !roadDone.has(x.id))
      .sort((a, c) => Math.hypot(a.x - k.x, a.z - k.z) - Math.hypot(c.x - k.x, c.z - k.z))[0];
    if (!b) return;
    roadDone.add(b.id);
    const d = doorOf(b);
    const route = services.nav.grid().findPath(kd.x, kd.z + 1.5, d.x, d.z);
    if (!route) return;
    let [ax, az] = [kd.x, kd.z + 1.5];
    const pieces = [];
    for (const [bx, bz] of route.points) {
      // long legs go in pieces the command accepts
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / ((ROADS.perCommand - 4) * 2));
      for (let i = 1; i <= n; i++) pieces.push([ax + ((bx - ax) * (i - 1)) / n, az + ((bz - az) * (i - 1)) / n, ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
      ax = bx; az = bz;
    }
    for (const [x0, z0, x1, z1] of pieces) {
      const chk = checkStretch(world, services, me, x0, z0, x1, z1);
      if (!chk.ok || p.res.stone - chk.stone < 40) continue;
      issue({ type: 'buildRoad', ax: x0, az: z0, bx: x1, bz: z1 });
    }
    log.push(`${world.tick}: road to ${b.type}`);
  }

  function economyStep() {
    const world = w();
    const p = world.players[me];
    { const k = keepOf(world, me); if (me === PLAYER ? !world.mission.flags.keepLit : k && !k.lit) { issue({ type: 'rekindle' }); return; } }
    if ((transport === true || transport === 'roads') && world.tick % 200 === 100) roadStep(world, p);
    // priority: the Barracks site while it is being built
    if (priority && world.tick % 200 === 60) {
      const want = all(world, 'building').filter((b) => b.owner === me && b.type === 'barracks' && b.state === 'site');
      for (const b of all(world, 'building')) if (b.owner === me && b.priority && !want.includes(b)) issue({ type: 'setPriority', id: b.id, on: false });
      for (const b of want) if (!b.priority) issue({ type: 'setPriority', id: b.id, on: true });
    }
    if ((transport === true || transport === 'donkeys') && count('donkeystable') < 1 && count('mine') >= 1 && count('cottage') >= 3 && p.res.taler >= 120 && place('donkeystable', [-38, 58])) return;
    // Hearthhands: a few more as the town grows, while the treasury can spare them
    if (world.tick % 400 === 7) {
      const built = all(world, 'building').filter((b) => b.owner === me && b.state === 'active').length;
      if (handsOf(world, me) < Math.min(handsCap(world, me), 2 + Math.floor(built / 4)) && p.res.taler >= HAND.cost.taler + 40) issue({ type: 'hireHand' });
    }
    const sites = all(world, 'building').filter((b) => b.owner === me && b.state === 'site').length;
    if (sites >= 2) return;
    if (can('lodge') && count('lodge') < 1) { place('lodge'); return; }
    if (can('farm') && count('farm') < 1) { place('farm'); return; }
    if (can('cottage') && count('cottage') < 1) { place('cottage'); return; }
    if (count('fisher') < 1 && isActive(world, 'hartsgate') && place('fisher', [-44, 14])) return;
    if (can('lodge') && count('lodge') < 2) { place('lodge', [-70, 26]); return; }
    if (can('quarry') && count('quarry') < 1) { place('quarry'); return; }
    // the Drill Yard, once the story asks for Sappers (stone is saved up for it)
    if (isActive(world, 'sappers')) {
      const bk = all(world, 'building').find((x) => x.owner === me && x.type === 'barracks' && x.state === 'active' && !x.upgrade && (x.level || 1) === 1);
      if (bk) { if (canAfford(world, me, UPGRADES.barracks[2].cost)) issue({ type: 'upgrade', id: bk.id }); else if (p.res.stone < 30 || p.res.taler < 60) return; }
    }
    // where the map has salt pans, salt works pay for everything else
    if (can('saltworks') && count('saltworks') < 2 && all(world, 'deposit').some((d) => d.type === 'salt')) { place('saltworks'); return; }
    if (can('cottage') && count('cottage') < 2) { place('cottage', [-58, 30]); return; }
    if (can('mine') && count('mine') < 1) { place('mine'); return; }
    if (count('mine') < 2 && isActive(world, 'foothold')) {
      // the second mine goes to the next free iron vein
      const taken = all(world, 'building').filter((b) => b.owner === me && b.type === 'mine');
      const vein = all(world, 'deposit').filter((d) => d.type === 'iron' && d.amount > 0 && taken.every((m) => Math.hypot(m.x - d.x, m.z - d.z) > 14))
        .sort((a, b) => Math.hypot(a.x - home.x, a.z - home.z) - Math.hypot(b.x - home.x, b.z - home.z))[0];
      if (vein) { place('mine', abs(vein.x, vein.z)); return; }
    }
    if (can('farm') && count('farm') < 2) { place('farm', [-60, 78]); return; }
    if (can('hunter') && count('hunter') < 1) { place('hunter', [-72, 30]); return; }
    if (can('cottage') && count('cottage') < 3) { place('cottage', [-40, 74]); return; }
    // a Well or two once motivation sags (high taxes, plain food)
    if (can('well') && count('well') < 2 && p.stability < 80 && p.res.stone >= 60) { place('well', [-50, 60]); return; }
    // a fisher on the Harrow once the territory reaches the bank (tried now and then)
    if (count('fisher') < 1 && world.tick % 1200 < 20 && place('fisher', [-44, 14])) return;
    if (can('barracks') && count('barracks') < 1 && (statsOf(world, me).produced.iron >= 10 || p.res.iron >= 10)) { place('barracks'); return; }
    if (can('canteen') && count('canteen') < 1 && count('barracks') > 0) { place('canteen', [-54, 38]); return; }
    if (can('lodge') && count('lodge') < 3 && (p.res.timber < 30 || count('barracks') > 0)) { place('lodge', [-40, 16]); return; }
    if (can('cottage') && count('cottage') < 8 && p.pop >= p.popCap - 2) { place('cottage', [-62, 50]); return; }
    // timber crisis: send spare labourers to fell trees by hand (and call them back later)
    {
      const free = all(world, 'settler').filter((x) => x.owner === me && !x.job && !x.order && !x.sleep && !x.enlisting && !x.arriving);
      const gatherers = all(world, 'settler').filter((x) => x.owner === me && x.order);
      if (p.res.timber < 25 && gatherers.length < 3 && free.length >= 4) {
        const k = keepOf(world, me);
        const tree = k && all(world, 'deposit').filter((d) => d.type === 'tree' && d.amount > 0).sort((a, b) => Math.hypot(a.x - k.x, a.z - k.z) - Math.hypot(b.x - k.x, b.z - k.z))[0];
        if (tree) issue({ type: 'gather', ids: free.slice(0, 2).map((x) => x.id), target: tree.id });
      } else if (p.res.timber > 90 && gatherers.length) issue({ type: 'release', ids: gatherers.map((x) => x.id) });
      // stone crisis (quarry exhausted and too little stone to move it): break rock by hand
      const quarryDead = all(world, 'building').some((b) => b.owner === me && b.type === 'quarry' && b.state === 'active' && b.stall === 'noDeposit')
        && !all(world, 'building').some((b) => b.owner === me && b.type === 'quarry' && b.stall !== 'noDeposit');
      if (quarryDead && p.res.stone < 25 && gatherers.length < 3 && free.length >= 3) {
        const k = keepOf(world, me);
        const rock = k && all(world, 'deposit').filter((d) => d.type === 'rock' && d.amount > 0).sort((a, b) => Math.hypot(a.x - k.x, a.z - k.z) - Math.hypot(b.x - k.x, b.z - k.z))[0];
        if (rock) issue({ type: 'gather', ids: free.slice(0, 2).map((x) => x.id), target: rock.id });
      }
    }
    // an exhausted quarry moves to the nearest rock outcrop that is still standing
    const deadQ = all(world, 'building').find((b) => b.owner === me && b.type === 'quarry' && b.state === 'active' && b.stall === 'noDeposit');
    if (deadQ && canAfford(world, me, buildCost(world, me, 'quarry'))) {
      const rock = all(world, 'deposit').filter((d) => d.type === 'rock' && d.amount > 0 && Math.hypot(d.x - deadQ.x, d.z - deadQ.z) > 14)
        .sort((a, b) => Math.hypot(a.x - home.x, a.z - home.z) - Math.hypot(b.x - home.x, b.z - home.z))[0];
      if (rock && place('quarry', abs(rock.x, rock.z))) issue({ type: 'demolish', id: deadQ.id });
    }
    // the market: turn surplus stone and Taler into timber when the forests cannot keep up
    if (world.tick % 400 === 0) {
      const trader = all(world, 'poi').find((x) => x.type === 'trader' && x.state !== 'hidden');
      if (trader) {
        if (p.res.timber < 30) {
          if (p.res.stone > 60) issue({ type: 'trade', id: trader.id, deal: 'sellStone' });
          issue({ type: 'trade', id: trader.id, deal: 'buyTimber' });
        }
        // a full treasury buys what the army and the table lack
        if (p.res.taler > 150 && p.res.iron < 25) issue({ type: 'trade', id: trader.id, deal: 'buyIron' });
        if (p.res.taler > 150 && p.res.provisions < 40) issue({ type: 'trade', id: trader.id, deal: 'buyFood' });
        // the Drill Yard needs stone and silver: buy the stone, keep the silver
        if (isActive(world, 'sappers') && p.res.stone < 30 && p.res.taler > 100) issue({ type: 'trade', id: trader.id, deal: 'buyStone' });
      }
    }
    // upgrade workshops once the treasury allows (mine first: iron gates the army)
    for (const type of transport ? ['mine', 'lodge', 'quarry', 'donkeystable'] : ['mine', 'lodge', 'quarry']) {
      if (type !== 'mine' && all(world, 'building').some((x) => x.owner === me && x.type === type && (x.level || 1) > 1)) continue; // one of each is enough
      const b = all(world, 'building').find((x) => x.owner === me && x.type === type && x.state === 'active' && !x.upgrade && (x.level || 1) === 1);
      if (b && canAfford(world, me, UPGRADES[type][2].cost) && p.res.timber > 40) { issue({ type: 'upgrade', id: b.id }); return; }
    }
    if (!p.research && !researchBlocker(world, me, 'bracing') && p.res.timber > 90) { issue({ type: 'research', techId: 'bracing' }); return; }
    // iron goes to soldiers first: military research waits for a first squad
    if (!p.research && soldiers().length >= 6 && !researchBlocker(world, me, 'blades')) { issue({ type: 'research', techId: 'blades' }); return; }
    if (!p.research && soldiers().length >= 6 && !researchBlocker(world, me, 'axes') && p.res.timber > 100) { issue({ type: 'research', techId: 'axes' }); return; }
    if (!p.research && !researchBlocker(world, me, 'charter') && p.res.stone > 100) { issue({ type: 'research', techId: 'charter' }); return; }
    if (p.techs.charter && count('tower') < (world.meta.scenarioId === 'tollbreaker' ? 2 : 1)) { place('tower', count('tower') ? [-50, 20] : null); return; }
    // exhausted forests: demolish the idle lodge and build a new one next to standing trees
    const dead = all(world, 'building').find((b) => b.owner === me && b.type === 'lodge' && b.state === 'active' && b.stall === 'noDeposit');
    if (dead && canAfford(world, me, buildCost(world, me, 'lodge'))) {
      let best = null, bd = Infinity;
      const trees = all(world, 'deposit').filter((d) => d.type === 'tree' && d.amount > 0);
      for (const d of trees) { if (trees.filter((o) => Math.hypot(o.x - d.x, o.z - d.z) < 18).length < 8) continue; const dd = Math.hypot(d.x - home.x, d.z - home.z); if (dd < bd) { bd = dd; best = d; } }
      if (best && place('lodge', abs(best.x, best.z))) issue({ type: 'demolish', id: dead.id });
    }
  }

  function militaryStep() {
    const world = w();
    const p = world.players[me];
    const barracks = all(world, 'building').find((b) => b.owner === me && b.type === 'barracks' && b.state === 'active');
    if (!barracks) return;
    const idle = all(world, 'settler').filter((s) => s.owner === me && !s.job).length;
    const queued = barracks.queue.length;
    // keep a few labourers free: without carriers the whole economy stalls
    const carriers = all(world, 'settler').filter((s) => s.owner === me && !s.job && !s.order && !s.enlisting).length;
    // Sappers for the Order's walls: four of them, as soon as the Drill Yard stands (even past the usual army size)
    const sappers = soldiers().filter((u) => u.type === 'sapper').length + barracks.queue.filter((q) => q.unitType === 'sapper').length;
    const wantSapper = (barracks.level || 1) >= 2 && sappers < 4 && (isActive(world, 'sappers') || isActive(world, 'chapterhouse'));
    if (queued < 2 && idle > 1 && carriers > (wantSapper ? 2 : 4) && soldiers().length < (wantSapper ? 26 : 20)) {
      const n = soldiers().length + queued;
      const type = wantSapper ? 'sapper' : ['shield', 'blade', 'fletcher', 'fletcher', 'blade', 'shield'][n % 6];
      if (canAfford(world, me, UNITS[type].cost)) issue({ type: 'recruit', building: barracks.id, unitType: type });
    }
    void p;
  }

  // campaign chores: Maren's visit to Millbrook, gifts for the Greyfen, occupied villages
  let heroErrand = false;
  let wrenErrand = false;
  let villageTarget = null;
  function storyStep() {
    const world = w();
    const active = (id) => (world.mission.objectives.find((o) => o.id === id) || {}).state === 'active';
    const h = hero();
    heroErrand = false;
    if ((active('millbrook') || active('pannholt')) && h && !h.downed && world.ai.state !== 'raid') {
      const ham = all(world, 'poi').find((x) => x.type === 'hamlet');
      if (ham) { heroErrand = true; if (Math.hypot(h.x - ham.x, h.z - ham.z) > 4 && (!h.order || h.order.type !== 'move')) issue({ type: 'move', ids: [h.id], x: ham.x, z: ham.z }); }
    }
    // Whitehart: free the villages one by one (nearest first) — the army clears the outpost, Maren follows
    villageTarget = null;
    if ((active('ashby') || active('villages') || active('delvholm')) && world.ai.state !== 'raid') {
      const open = all(world, 'poi').filter((x) => x.type === 'hamlet' && x.state !== 'done').sort((a, b) => Math.hypot(a.x - home.x, a.z - home.z) - Math.hypot(b.x - home.x, b.z - home.z));
      const next = open[0];
      if (next && occupiedBy(world, next)) {
        // march on the nearest occupier (a bastion can stand beyond sight of the village square)
        const occ = [...all(world, 'unit'), ...all(world, 'building')].filter((e) => e.owner === ENEMY && !e.downed && e.state !== 'destroyed' && Math.hypot(e.x - next.x, e.z - next.z) < 24)
          .sort((a, b) => Math.hypot(a.x - home.x, a.z - home.z) - Math.hypot(b.x - home.x, b.z - home.z))[0];
        villageTarget = occ || next;
      }
      else if (next && h && !h.downed) { heroErrand = true; if (Math.hypot(h.x - next.x, h.z - next.z) > 4 && (!h.order || h.order.type !== 'move')) issue({ type: 'move', ids: [h.id], x: next.x, z: next.z }); }
    }
    // the Iron March: Wren lights the border beacons, nearest first
    wrenErrand = false;
    const wr = wren();
    if (active('beacons') && wr && !wr.downed && world.ai.state !== 'raid') {
      const beacon = all(world, 'poi').filter((x) => x.type === 'cairn' && x.state !== 'done').sort((a, b) => Math.hypot(a.x - wr.x, a.z - wr.z) - Math.hypot(b.x - wr.x, b.z - wr.z))[0];
      if (beacon) { wrenErrand = true; if (Math.hypot(wr.x - beacon.x, wr.z - beacon.z) > 4 && (!wr.order || wr.order.type !== 'move' || Math.hypot(wr.order.x - beacon.x, wr.order.z - beacon.z) > 2)) issue({ type: 'move', ids: [wr.id], x: beacon.x, z: beacon.z }); }
    }
    if (active('greyfen') && world.players[me].res.taler >= 50 && world.tick % 600 === 50) issue({ type: 'gift', to: 'p3' });
  }

  /**
   * A war between two towns (free play against a rival): beat off whoever comes near home, and
   * march on the foe's Keep once the company is big enough. `assault` (object or function of the
   * world): { size, regroup, notBefore } — soldiers to set out, fewer than which turn back, and the
   * first tick an attack may start.
   */
  function foeTactics(world, army, ids) {
    const st = S();
    const a = { size: 12, regroup: 5, notBefore: 0, ...(typeof assault === 'function' ? assault(world) : assault || {}) };
    let tx = 0, tz = 0, n = 0;
    for (const u of all(world, 'unit')) {
      if (u.downed || !hostile(world, me, u.owner) || Math.hypot(u.x - home.x, u.z - home.z) > 50) continue;
      tx += u.x; tz += u.z; n++;
    }
    if (n) {
      st.phase = 'defend';
      if (world.tick - st.lastAct > 60) { issue({ type: 'attackMove', ids, x: tx / n, z: tz / n }); st.lastAct = world.tick; }
      return;
    }
    const target = keepOf(world, foe);
    if (!target || !ids.length) return;
    // the muster ground: a little way out from home towards the foe
    const rx = home.x + (target.x - home.x) * 0.15, rz = home.z + (target.z - home.z) * 0.15;
    if (world.tick - st.lastAct <= 200) return;
    if (st.phase === 'assault' && army.length < a.regroup) {
      st.phase = 'economy';
      issue({ type: 'move', ids, x: rx, z: rz });
    } else if ((army.length >= a.size && world.tick >= a.notBefore) || st.phase === 'assault') {
      st.phase = 'assault';
      issue({ type: 'attackMove', ids, x: target.x, z: target.z });
    } else {
      st.phase = 'economy';
      issue({ type: 'move', ids, x: rx, z: rz });
    }
    st.lastAct = world.tick;
  }

  function tacticsStep() {
    const world = w();
    const army = soldiers();
    const h = hero();
    const wr = wren();
    const ids = army.map((u) => u.id).concat(h && !h.downed && !heroErrand ? [h.id] : [], wr && !wr.downed && !wrenErrand ? [wr.id] : []);
    const raidOn = world.ai.state === 'raid';
    const hall = warhallOf(world);
    if (foe) foeTactics(world, army, ids);
    else if (raidOn) {
      S().phase = 'defend';
      const raiders = world.ai.raidIds.map((id) => world.entities[id]).filter(Boolean);
      if (raiders.length && world.tick - S().lastAct > 60) {
        let cx = 0, cz = 0; raiders.forEach((r) => { cx += r.x; cz += r.z; }); cx /= raiders.length; cz /= raiders.length;
        // only engage raiders once they are near the settlement; otherwise hold the north road
        if (Math.hypot(cx - home.x, cz - home.z) < 55) issue({ type: 'attackMove', ids, x: cx, z: cz });
        else { const [gx, gz] = rel([-30, 34]); issue({ type: 'move', ids, x: gx, z: gz }); }
        S().lastAct = world.tick;
      }
    } else if (villageTarget) {
      // march on the occupied village once the company is big enough (the later ones are better held)
      const freed = all(world, 'poi').filter((x) => x.type === 'hamlet' && x.state === 'done').length;
      if (army.length >= (freed ? 14 : 8) && world.tick - S().lastAct > 200) {
        issue({ type: 'attackMove', ids, x: villageTarget.x, z: villageTarget.z });
        S().lastAct = world.tick;
      }
    } else if ((world.meta.scenarioId === 'whitestag' && !isActive(world, 'chapterhouse')) || (world.meta.scenarioId === 'irondebt' && !isActive(world, 'hold'))) {
      // the chapterhouse walls wait for the villages and the Sappers
      if (world.tick - S().lastAct > 400) { const [gx, gz] = rel([-26, 30]); issue({ type: 'move', ids, x: gx, z: gz }); S().lastAct = world.tick; }
    } else if (S().phase === 'defend' || (world.ai.wave >= 1 && aggressive) || isActive(world, 'chapterhouse') || (world.meta.scenarioId === 'irondebt' && isActive(world, 'hold'))) {
      S().phase = 'assault';
      if (hall && army.length >= 12 && world.tick - S().lastAct > 200) {
        issue({ type: 'attackMove', ids, x: hall.x - 6, z: hall.z + 8 });
        S().lastAct = world.tick;
      } else if (hall && army.length < 6 && world.tick - S().lastAct > 200) {
        const [gx, gz] = rel([-26, 32]); issue({ type: 'move', ids, x: gx, z: gz });
        S().lastAct = world.tick;
      }
    } else if (world.mission.flags.raidWarned && world.tick - S().lastAct > 400) {
      const [gx, gz] = rel([-26, 30]); issue({ type: 'move', ids, x: gx, z: gz });
      S().lastAct = world.tick;
    }
    // hero abilities when enemies are close
    if (h && !h.downed) {
      let near = null, nd = Infinity;
      for (const u of all(world, 'unit')) {
        if ((foe ? !hostile(world, me, u.owner) : u.owner !== ENEMY) || u.downed) continue;
        const d = Math.hypot(u.x - h.x, u.z - h.z);
        if (d < nd) { nd = d; near = u; }
      }
      if (near && nd < ABILITIES.flare.range && abilityReady(world, h, 'flare')) issue({ type: 'ability', heroId: h.id, ability: 'flare', x: near.x, z: near.z });
      if (near && nd < 8 && abilityReady(world, h, 'kindle')) issue({ type: 'ability', heroId: h.id, ability: 'kindle' });
    }
    // Wren: mark the nearest enemy group, then rain arrows on it
    if (wr && !wr.downed) {
      let near = null, nd = Infinity;
      for (const u of all(world, 'unit')) {
        if ((foe ? !hostile(world, me, u.owner) : u.owner !== ENEMY) || u.downed) continue;
        const d = Math.hypot(u.x - wr.x, u.z - wr.z);
        if (d < nd) { nd = d; near = u; }
      }
      if (near && nd < ABILITIES.mark.range && abilityReady(world, wr, 'mark')) issue({ type: 'ability', heroId: wr.id, ability: 'mark', x: near.x, z: near.z });
      else if (near && nd < ABILITIES.volley.range && abilityReady(world, wr, 'volley')) issue({ type: 'ability', heroId: wr.id, ability: 'volley', x: near.x, z: near.z });
    }
  }

  return {
    log,
    get phase() { return S().phase; },
    step() {
      const world = w();
      if (world.tick % 20 === 0) economyStep();
      if (world.tick % 20 === 10) militaryStep();
      if (world.tick % 10 === 3) tacticsStep();
      if (me === PLAYER && world.tick % 100 === 50 && world.meta.scenarioId !== 'harrowmere') storyStep();
    },
    /** Run until the mission ends or maxTicks. */
    play(maxTicks, onTick = null) {
      for (let i = 0; i < maxTicks && !w().mission.result; i++) {
        this.step();
        sim.step();
        if (onTick) onTick(w());
      }
      return w().mission.result;
    },
    summary() {
      const world = w();
      const p = world.players[me];
      return {
        tick: world.tick, minutes: +(world.tick / 1200).toFixed(1), result: world.mission.result, reason: world.mission.endReason,
        res: p.res, pop: p.pop, cap: p.popCap, stability: Math.round(p.stability), techs: Object.keys(p.techs),
        buildings: all(world, 'building').filter((b) => b.owner === me).map((b) => `${b.type}:${b.state}`),
        soldiers: soldierCount(world, me), enemies: all(world, 'unit').filter((u) => u.owner === ENEMY).length,
        wave: world.ai.wave, aiState: world.ai.state,
        objectives: world.mission.objectives.map((o) => `${o.id}:${o.state}${o.doneTick ? '@' + (o.doneTick / 1200).toFixed(1) : ''}`),
        stats: world.stats, built: countBuilt(world, me, 'cottage'),
      };
    },
  };
}
