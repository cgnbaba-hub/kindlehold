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

  function place(type, near) {
    const world = w();
    if (!canAfford(world, PLAYER, buildCost(world, PLAYER, type))) return false;
    const [x, z] = near || SITES[type];
    const spot = findSpot(world, services, type, x, z);
    if (!spot) { log.push(`${world.tick}: no spot for ${type}`); return false; }
    sim.issue({ type: 'place', buildingType: type, x: spot.x, z: spot.z, rot: Math.atan2(-46 - spot.x, 50 - spot.z) + Math.PI });
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
    if (count('cottage') < 3) { place('cottage', [-40, 74]); return; }
    if (count('barracks') < 1 && (world.stats.produced.iron >= 10 || p.res.iron >= 10)) { place('barracks'); return; }
    if (count('lodge') < 3 && p.res.timber < 30) { place('lodge', [-40, 16]); return; }
    if (count('cottage') < 8 && p.pop >= p.popCap - 2) { place('cottage', [-62, 50]); return; }
    if (!p.research && !researchBlocker(world, PLAYER, 'bracing') && p.res.timber > 90) { sim.issue({ type: 'research', techId: 'bracing' }); return; }
    if (!p.research && !researchBlocker(world, PLAYER, 'blades')) { sim.issue({ type: 'research', techId: 'blades' }); return; }
    if (!p.research && !researchBlocker(world, PLAYER, 'axes') && p.res.timber > 100) { sim.issue({ type: 'research', techId: 'axes' }); return; }
    if (!p.research && !researchBlocker(world, PLAYER, 'charter') && p.res.stone > 100) { sim.issue({ type: 'research', techId: 'charter' }); return; }
    if (p.techs.charter && count('tower') < 1) { place('tower'); return; }
    // exhausted forests: demolish the idle lodge and build a new one next to standing trees
    const dead = all(world, 'building').find((b) => b.owner === PLAYER && b.type === 'lodge' && b.state === 'active' && b.stall === 'noDeposit');
    if (dead && canAfford(world, PLAYER, buildCost(world, PLAYER, 'lodge'))) {
      let best = null, bd = Infinity;
      const trees = all(world, 'deposit').filter((d) => d.type === 'tree' && d.amount > 0);
      for (const d of trees) { if (trees.filter((o) => Math.hypot(o.x - d.x, o.z - d.z) < 18).length < 8) continue; const dd = Math.hypot(d.x + 46, d.z - 50); if (dd < bd) { bd = dd; best = d; } }
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
    if (queued < 2 && idle > 1 && soldiers().length < 20) {
      const n = soldiers().length + queued;
      const type = ['shield', 'blade', 'fletcher', 'fletcher', 'blade', 'shield'][n % 6];
      if (canAfford(world, PLAYER, UNITS[type].cost)) sim.issue({ type: 'recruit', building: barracks.id, unitType: type });
    }
    void p;
  }

  function tacticsStep() {
    const world = w();
    const army = soldiers();
    const h = hero();
    const ids = army.map((u) => u.id).concat(h && !h.downed ? [h.id] : []);
    const raidOn = world.ai.state === 'raid';
    const hall = all(world, 'building').find((b) => b.type === 'warhall' && b.owner === ENEMY && b.state !== 'destroyed');
    if (raidOn) {
      phase = 'defend';
      const raiders = world.ai.raidIds.map((id) => world.entities[id]).filter(Boolean);
      if (raiders.length && world.tick - lastAct > 60) {
        let cx = 0, cz = 0; raiders.forEach((r) => { cx += r.x; cz += r.z; }); cx /= raiders.length; cz /= raiders.length;
        // only engage raiders once they are near the settlement; otherwise hold the north road
        if (Math.hypot(cx + 46, cz - 50) < 55) sim.issue({ type: 'attackMove', ids, x: cx, z: cz });
        else sim.issue({ type: 'move', ids, x: -30, z: 34 });
        lastAct = world.tick;
      }
    } else if (phase === 'defend' || (world.ai.wave >= 1 && aggressive)) {
      phase = 'assault';
      if (hall && army.length >= 12 && world.tick - lastAct > 200) {
        sim.issue({ type: 'attackMove', ids, x: hall.x - 6, z: hall.z + 8 });
        lastAct = world.tick;
      } else if (hall && army.length < 6 && world.tick - lastAct > 200) {
        sim.issue({ type: 'move', ids, x: -26, z: 32 });
        lastAct = world.tick;
      }
    } else if (world.mission.flags.raidWarned && world.tick - lastAct > 400) {
      sim.issue({ type: 'move', ids, x: -26, z: 30 });
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
