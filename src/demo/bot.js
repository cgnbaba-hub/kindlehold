import { UPGRADES, BUILDINGS } from '../buildings/defs.js';
import { keepOf } from '../population/index.js';
// Scripted player ("bot") that plays the scenario only through the public command API.
// Used by the happy-path simulation test, balancing, and verification demo states.
import { PLAYER, ENEMY } from '../core/contracts.js';
import { all } from '../world/world.js';
import { checkPlacement, buildCost } from '../construction/index.js';
import { canAfford } from '../economy/stock.js';
import { researchBlocker } from '../technology/index.js';
import { countBuilt, soldierCount } from '../missions/conditions.js';
import { UNITS } from '../units/defs.js';
import { ABILITIES, abilityReady } from '../heroes/index.js';
import { warhallOf } from '../ai/index.js';

/** Spiral search for a valid building spot near (x,z). */
export function findSpot(world, services, type, x, z, maxR = 34) {
  for (let r = 0; r <= maxR; r += 2) {
    const steps = Math.max(1, Math.round((2 * Math.PI * r) / 3));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const px = Math.round(x + Math.cos(a) * r), pz = Math.round(z + Math.sin(a) * r);
      if (checkPlacement(world, services, PLAYER, type, px, pz).ok) return { x: px, z: pz };
    }
  }
  return null;
}

const SITES = {
  lodge: [-66, 40], farm: [-36, 66], cottage: [-54, 64], quarry: [-28, 68], mine: [-73, 62], barracks: [-34, 38], tower: [-30, 30],
};

export function createBot(sim, { aggressive = true } = {}) {
  const w = () => sim.world;
  const services = sim.services;
  const log = [];
  let phase = 'economy';
  let lastAct = -999;

  // the scripted layout was drawn for Harrowmere (keep at -46,50): shift it to this map's town
  const home = services.terrain.map.playerStart;
  const rel = ([x, z]) => [x + 46 + home.x, z - 50 + home.z];

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
    if (!canAfford(world, PLAYER, buildCost(world, PLAYER, type))) return false;
    const [x, z] = rel(near || SITES[type] || [-46, 50]);
    let spot = findSpot(world, services, type, x, z);
    if (!spot) { const c = fallbackCentre(world, type); if (c) spot = findSpot(world, services, type, c[0], c[1], 26); }
    if (!spot) { log.push(`${world.tick}: no spot for ${type}`); return false; }
    sim.issue({ type: 'place', buildingType: type, x: spot.x, z: spot.z, rot: Math.atan2(home.x - spot.x, home.z - spot.z) + Math.PI });
    log.push(`${world.tick}: place ${type} @${spot.x},${spot.z}`);
    return true;
  }

  const count = (type) => all(w(), 'building').filter((b) => b.owner === PLAYER && b.type === type && b.state !== 'destroyed').length;
  const soldiers = () => all(w(), 'unit').filter((u) => u.owner === PLAYER && !u.hero);
  const hero = () => all(w(), 'unit').find((u) => u.owner === PLAYER && u.hero);

  function economyStep() {
    const world = w();
    const p = world.players[PLAYER];
    if (!world.mission.flags.keepLit) { sim.issue({ type: 'rekindle' }); return; }
    const sites = all(world, 'building').filter((b) => b.owner === PLAYER && b.state === 'site').length;
    if (sites >= 2) return;
    if (count('lodge') < 1) { place('lodge'); return; }
    if (count('farm') < 1) { place('farm'); return; }
    if (count('cottage') < 1) { place('cottage'); return; }
    if (count('lodge') < 2) { place('lodge', [-70, 26]); return; }
    if (count('quarry') < 1) { place('quarry'); return; }
    if (count('cottage') < 2) { place('cottage', [-58, 30]); return; }
    if (count('mine') < 1) { place('mine'); return; }
    if (count('farm') < 2) { place('farm', [-60, 78]); return; }
    if (count('hunter') < 1) { place('hunter', [-72, 30]); return; }
    if (count('cottage') < 3) { place('cottage', [-40, 74]); return; }
    // a fisher on the Harrow once the territory reaches the bank (tried now and then)
    if (count('fisher') < 1 && world.tick % 1200 < 20 && place('fisher', [-44, 14])) return;
    if (count('barracks') < 1 && (world.stats.produced.iron >= 10 || p.res.iron >= 10)) { place('barracks'); return; }
    if (count('canteen') < 1 && count('barracks') > 0) { place('canteen', [-54, 38]); return; }
    if (count('lodge') < 3 && (p.res.timber < 30 || count('barracks') > 0)) { place('lodge', [-40, 16]); return; }
    if (count('cottage') < 8 && p.pop >= p.popCap - 2) { place('cottage', [-62, 50]); return; }
    // timber crisis: send spare labourers to fell trees by hand (and call them back later)
    {
      const free = all(world, 'settler').filter((x) => x.owner === PLAYER && !x.job && !x.order && !x.sleep && !x.enlisting && !x.arriving);
      const gatherers = all(world, 'settler').filter((x) => x.owner === PLAYER && x.order);
      if (p.res.timber < 25 && gatherers.length < 3 && free.length >= 4) {
        const k = keepOf(world, PLAYER);
        const tree = k && all(world, 'deposit').filter((d) => d.type === 'tree' && d.amount > 0).sort((a, b) => Math.hypot(a.x - k.x, a.z - k.z) - Math.hypot(b.x - k.x, b.z - k.z))[0];
        if (tree) sim.issue({ type: 'gather', ids: free.slice(0, 2).map((x) => x.id), target: tree.id });
      } else if (p.res.timber > 90 && gatherers.length) sim.issue({ type: 'release', ids: gatherers.map((x) => x.id) });
    }
    // the market: turn surplus stone and Taler into timber when the forests cannot keep up
    if (world.tick % 400 === 0) {
      const trader = all(world, 'poi').find((x) => x.type === 'trader' && x.state !== 'hidden');
      if (trader) {
        if (p.res.timber < 30) {
          if (p.res.stone > 60) sim.issue({ type: 'trade', id: trader.id, deal: 'sellStone' });
          sim.issue({ type: 'trade', id: trader.id, deal: 'buyTimber' });
        }
        // a full treasury buys what the army and the table lack
        if (p.res.taler > 150 && p.res.iron < 25) sim.issue({ type: 'trade', id: trader.id, deal: 'buyIron' });
        if (p.res.taler > 150 && p.res.provisions < 40) sim.issue({ type: 'trade', id: trader.id, deal: 'buyFood' });
      }
    }
    // upgrade workshops once the treasury allows (mine first: iron gates the army)
    for (const type of ['mine', 'lodge', 'quarry']) {
      if (type !== 'mine' && all(world, 'building').some((x) => x.owner === PLAYER && x.type === type && (x.level || 1) > 1)) continue; // one of each is enough
      const b = all(world, 'building').find((x) => x.owner === PLAYER && x.type === type && x.state === 'active' && !x.upgrade && (x.level || 1) === 1);
      if (b && canAfford(world, PLAYER, UPGRADES[type][2].cost) && p.res.timber > 40) { sim.issue({ type: 'upgrade', id: b.id }); return; }
    }
    if (!p.research && !researchBlocker(world, PLAYER, 'bracing') && p.res.timber > 90) { sim.issue({ type: 'research', techId: 'bracing' }); return; }
    // iron goes to soldiers first: military research waits for a first squad
    if (!p.research && soldiers().length >= 6 && !researchBlocker(world, PLAYER, 'blades')) { sim.issue({ type: 'research', techId: 'blades' }); return; }
    if (!p.research && soldiers().length >= 6 && !researchBlocker(world, PLAYER, 'axes') && p.res.timber > 100) { sim.issue({ type: 'research', techId: 'axes' }); return; }
    if (!p.research && !researchBlocker(world, PLAYER, 'charter') && p.res.stone > 100) { sim.issue({ type: 'research', techId: 'charter' }); return; }
    if (p.techs.charter && count('tower') < (world.meta.scenarioId === 'tollbreaker' ? 2 : 1)) { place('tower', count('tower') ? [-50, 20] : null); return; }
    // exhausted forests: demolish the idle lodge and build a new one next to standing trees
    const dead = all(world, 'building').find((b) => b.owner === PLAYER && b.type === 'lodge' && b.state === 'active' && b.stall === 'noDeposit');
    if (dead && canAfford(world, PLAYER, buildCost(world, PLAYER, 'lodge'))) {
      let best = null, bd = Infinity;
      const trees = all(world, 'deposit').filter((d) => d.type === 'tree' && d.amount > 0);
      for (const d of trees) { if (trees.filter((o) => Math.hypot(o.x - d.x, o.z - d.z) < 18).length < 8) continue; const dd = Math.hypot(d.x - home.x, d.z - home.z); if (dd < bd) { bd = dd; best = d; } }
      if (best && place('lodge', [best.x, best.z])) sim.issue({ type: 'demolish', id: dead.id });
    }
  }

  function militaryStep() {
    const world = w();
    const p = world.players[PLAYER];
    const barracks = all(world, 'building').find((b) => b.owner === PLAYER && b.type === 'barracks' && b.state === 'active');
    if (!barracks) return;
    const idle = all(world, 'settler').filter((s) => s.owner === PLAYER && !s.job).length;
    const queued = barracks.queue.length;
    // keep a few labourers free: without carriers the whole economy stalls
    const carriers = all(world, 'settler').filter((s) => s.owner === PLAYER && !s.job && !s.order && !s.enlisting).length;
    if (queued < 2 && idle > 1 && carriers > 4 && soldiers().length < 20) {
      const n = soldiers().length + queued;
      const type = ['shield', 'blade', 'fletcher', 'fletcher', 'blade', 'shield'][n % 6];
      if (canAfford(world, PLAYER, UNITS[type].cost)) sim.issue({ type: 'recruit', building: barracks.id, unitType: type });
    }
    void p;
  }

  // campaign chores: Maren's visit to Millbrook, gifts for the Greyfen
  let heroErrand = false;
  function storyStep() {
    const world = w();
    const active = (id) => (world.mission.objectives.find((o) => o.id === id) || {}).state === 'active';
    const h = hero();
    heroErrand = false;
    if (active('millbrook') && h && !h.downed && world.ai.state !== 'raid') {
      const ham = all(world, 'poi').find((x) => x.type === 'hamlet');
      if (ham) { heroErrand = true; if (Math.hypot(h.x - ham.x, h.z - ham.z) > 4 && (!h.order || h.order.type !== 'move')) sim.issue({ type: 'move', ids: [h.id], x: ham.x, z: ham.z }); }
    }
    if (active('greyfen') && world.players[PLAYER].res.taler >= 50 && world.tick % 600 === 50) sim.issue({ type: 'gift', to: 'p3' });
  }

  function tacticsStep() {
    const world = w();
    const army = soldiers();
    const h = hero();
    const ids = army.map((u) => u.id).concat(h && !h.downed && !heroErrand ? [h.id] : []);
    const raidOn = world.ai.state === 'raid';
    const hall = warhallOf(world);
    if (raidOn) {
      phase = 'defend';
      const raiders = world.ai.raidIds.map((id) => world.entities[id]).filter(Boolean);
      if (raiders.length && world.tick - lastAct > 60) {
        let cx = 0, cz = 0; raiders.forEach((r) => { cx += r.x; cz += r.z; }); cx /= raiders.length; cz /= raiders.length;
        // only engage raiders once they are near the settlement; otherwise hold the north road
        if (Math.hypot(cx - home.x, cz - home.z) < 55) sim.issue({ type: 'attackMove', ids, x: cx, z: cz });
        else { const [gx, gz] = rel([-30, 34]); sim.issue({ type: 'move', ids, x: gx, z: gz }); }
        lastAct = world.tick;
      }
    } else if (phase === 'defend' || (world.ai.wave >= 1 && aggressive)) {
      phase = 'assault';
      if (hall && army.length >= 12 && world.tick - lastAct > 200) {
        sim.issue({ type: 'attackMove', ids, x: hall.x - 6, z: hall.z + 8 });
        lastAct = world.tick;
      } else if (hall && army.length < 6 && world.tick - lastAct > 200) {
        const [gx, gz] = rel([-26, 32]); sim.issue({ type: 'move', ids, x: gx, z: gz });
        lastAct = world.tick;
      }
    } else if (world.mission.flags.raidWarned && world.tick - lastAct > 400) {
      const [gx, gz] = rel([-26, 30]); sim.issue({ type: 'move', ids, x: gx, z: gz });
      lastAct = world.tick;
    }
    // hero abilities when enemies are close
    if (h && !h.downed) {
      let near = null, nd = Infinity;
      for (const u of all(world, 'unit')) {
        if (u.owner !== ENEMY) continue;
        const d = Math.hypot(u.x - h.x, u.z - h.z);
        if (d < nd) { nd = d; near = u; }
      }
      if (near && nd < ABILITIES.flare.range && abilityReady(world, h, 'flare')) sim.issue({ type: 'ability', heroId: h.id, ability: 'flare', x: near.x, z: near.z });
      if (near && nd < 8 && abilityReady(world, h, 'kindle')) sim.issue({ type: 'ability', heroId: h.id, ability: 'kindle' });
    }
  }

  return {
    log,
    get phase() { return phase; },
    step() {
      const world = w();
      if (world.tick % 20 === 0) economyStep();
      if (world.tick % 20 === 10) militaryStep();
      if (world.tick % 10 === 3) tacticsStep();
      if (world.tick % 100 === 50 && world.meta.scenarioId !== 'harrowmere') storyStep();
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
      const p = world.players[PLAYER];
      return {
        tick: world.tick, minutes: +(world.tick / 1200).toFixed(1), result: world.mission.result, reason: world.mission.endReason,
        res: p.res, pop: p.pop, cap: p.popCap, stability: Math.round(p.stability), techs: Object.keys(p.techs),
        buildings: all(world, 'building').filter((b) => b.owner === PLAYER).map((b) => `${b.type}:${b.state}`),
        soldiers: soldierCount(world, PLAYER), enemies: all(world, 'unit').filter((u) => u.owner === ENEMY).length,
        wave: world.ai.wave, aiState: world.ai.state,
        objectives: world.mission.objectives.map((o) => `${o.id}:${o.state}${o.doneTick ? '@' + (o.doneTick / 1200).toFixed(1) : ''}`),
        stats: world.stats, built: countBuilt(world, PLAYER, 'cottage'),
      };
    },
  };
}
