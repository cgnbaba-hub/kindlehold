// Population: settlers arriving, housing capacity, meals (provisions), stability,
// automatic worker assignment and fleeing from raiders.
import { EV, PLAYER, DT } from '../core/contracts.js';
import { spawn, remove, all, emit, alert, worldRng } from '../world/world.js';
import { BUILDINGS, doorOf } from '../buildings/defs.js';
import { SETTLER } from '../units/defs.js';
import { TECH_EFFECTS } from '../technology/defs.js';
import { addRes } from '../economy/stock.js';
import { walkTo, stopWalking } from '../navigation/agent.js';

export const MEAL_INTERVAL = 90 * 20;
export const ARRIVAL_COST = 2;
export const MIN_FREE_LABOURERS = 2;

const DIFF = {
  story: { arrival: 12 * 20 },
  normal: { arrival: 16 * 20 },
  hard: { arrival: 20 * 20 },
};

export function spawnSettler(world, owner, x, z, extra = {}) {
  return spawn(world, {
    kind: 'settler', owner, x, z, heading: 0,
    hp: SETTLER.hp, maxHp: SETTLER.hp,
    job: null, workplace: null, task: null, carry: null,
    anim: 'idle', animT: 0, moving: false, path: null, dest: null,
    ...extra,
  });
}

export function housingCap(world, owner) {
  let cap = 0;
  for (const b of all(world, 'building')) {
    if (b.owner !== owner || b.state !== 'active') continue;
    cap += BUILDINGS[b.type].housing || 0;
    if (b.type === 'keep' && world.players[owner].techs.charter) cap += TECH_EFFECTS.charterHousing;
  }
  return cap;
}

/** Population counts settlers and soldiers (heroes excluded). */
export function populationOf(world, owner) {
  let n = 0;
  for (const s of all(world, 'settler')) if (s.owner === owner) n++;
  for (const u of all(world, 'unit')) if (u.owner === owner && !u.hero) n++;
  // settlers that entered the barracks for training still count
  for (const b of all(world, 'building')) if (b.owner === owner && b.queue) for (const q of b.queue) if (q.training) n++;
  return n;
}

export function isIdleLabourer(s) {
  return s.kind === 'settler' && !s.job && !s.carry && (!s.task || s.task.type === 'idle') && !s.arriving && !s.fleeing;
}

/** Work-speed multiplier from stability (0.6 .. 1.0). */
export function stabilityFactor(world, owner) {
  const p = world.players[owner];
  return 0.6 + 0.4 * (p ? p.stability / 100 : 1);
}

export function keepOf(world, owner) {
  for (const b of all(world, 'building')) if (b.type === 'keep' && b.owner === owner && b.state !== 'destroyed') return b;
  return null;
}

export function createPopulationModule() {
  let ctx = null;
  const unsub = [];
  const enemyBuf = [];

  function updatePlayer(world, owner) {
    const p = world.players[owner];
    const keep = keepOf(world, owner);
    p.popCap = housingCap(world, owner);
    const prevPop = p.pop;
    p.pop = populationOf(world, owner);
    if (p.pop !== prevPop) emit(world, EV.POPULATION_CHANGED, { owner, pop: p.pop, cap: p.popCap });
    const diff = DIFF[world.meta.difficulty] || DIFF.normal;

    // arrivals
    if (keep && keep.lit && world.tick >= p.nextSettlerTick) {
      p.nextSettlerTick = world.tick + diff.arrival;
      if (p.pop < p.popCap && p.res.provisions >= ARRIVAL_COST + 2 && p.stability >= 30) {
        const entry = world.mapEntry || { x: -96, z: 96 };
        const s = spawnSettler(world, owner, entry.x, entry.z, { arriving: true });
        if (s) {
          addRes(world, owner, 'provisions', -ARRIVAL_COST, 'arrival');
          world.stats.consumed.provisions += ARRIVAL_COST;
          world.stats.settlersArrived++;
          emit(world, EV.SETTLER_ARRIVED, { id: s.id });
        }
      } else if (p.pop >= p.popCap && world.tick % 1200 === 0) {
        alert(world, 'info', 'Housing is full — build Cottages so more settlers can come.', keep.x, keep.z);
      }
    }

    // warn half a minute before a meal the stores cannot cover
    if (keep && p.nextMealTick - world.tick === 900 && p.res.provisions < p.pop) {
      alert(world, 'warn', `Provisions are running low: ${Math.floor(p.res.provisions)} left for ${p.pop} people at the next meal. Build or staff Farmsteads.`, keep.x, keep.z);
    }
    // meals
    if (world.tick >= p.nextMealTick) {
      p.nextMealTick = world.tick + MEAL_INTERVAL;
      const need = p.pop;
      const eat = Math.min(need, Math.floor(p.res.provisions));
      if (eat > 0) { addRes(world, owner, 'provisions', -eat, 'meal'); world.stats.consumed.provisions += eat; }
      p.lastMealFed = need > 0 ? eat / need : 1;
      if (p.lastMealFed < 1) {
        p.stability = Math.max(0, p.stability - 8 * (1 - p.lastMealFed));
        alert(world, 'warn', 'Your people went hungry. Build or staff Farmsteads.', keep ? keep.x : 0, keep ? keep.z : 0);
      }
      emit(world, 'population:meal', { owner, need, eaten: eat });
    }

    // stability drifts toward a target every second
    if (world.tick % 20 === 0) {
      const headroom = p.popCap - p.pop;
      const target = Math.max(0, Math.min(100,
        40 + 35 * p.lastMealFed + (headroom >= 1 ? 10 : 0) + (headroom < 0 ? -20 : 0) + (keep && keep.lit ? 10 : -10) - p.burnPenalty));
      const step = 0.5;
      if (p.stability < target) p.stability = Math.min(target, p.stability + step);
      else if (p.stability > target) p.stability = Math.max(target, p.stability - step);
      p.burnPenalty = Math.max(0, p.burnPenalty - 0.1);
      p.stabilityTarget = target;
    }

    // departures when stability collapses
    if (p.stability < 15 && world.tick % 600 === 0) {
      const leaver = all(world, 'settler').find((s) => s.owner === owner && isIdleLabourer(s));
      if (leaver) { leaver.leaving = true; leaver.task = null; alert(world, 'danger', 'A settler has given up and is leaving Kindlehold.', leaver.x, leaver.z); }
    }

    // job assignment once per second
    if (world.tick % 20 === 5) assignJobs(world, owner);
  }

  function assignJobs(world, owner) {
    const idle = all(world, 'settler').filter((s) => s.owner === owner && isIdleLabourer(s) && !s.leaving);
    let free = idle.length;
    const labourers = all(world, 'settler').filter((s) => s.owner === owner && !s.job).length;
    // keep enough labourers free to haul and build: 2 plus one per two workplaces
    let workplaces = 0;
    for (const b of all(world, 'building')) if (b.owner === owner && b.state === 'active' && BUILDINGS[b.type].slots) workplaces++;
    const minFree = MIN_FREE_LABOURERS + Math.floor(workplaces / 2);
    for (const b of all(world, 'building')) {
      if (b.owner !== owner || b.state !== 'active') continue;
      const def = BUILDINGS[b.type];
      if (!def.slots || b.paused) continue;
      // drop workers that no longer exist
      b.workers = b.workers.filter((id) => world.entities[id] && world.entities[id].workplace === b.id);
      while (b.workers.length < def.slots) {
        if (free <= 0 || labourers - (idle.length - free) <= minFree) break;
        // nearest idle settler
        let best = null, bestD = Infinity;
        for (const s of idle) {
          if (s.job) continue;
          const d = (s.x - b.x) ** 2 + (s.z - b.z) ** 2;
          if (d < bestD) { bestD = d; best = s; }
        }
        if (!best) break;
        best.job = def.job;
        best.workplace = b.id;
        best.task = null;
        stopWalking(best);
        b.workers.push(best.id);
        free--;
        emit(world, 'worker:assigned', { id: best.id, building: b.id, job: def.job });
      }
      const noWorker = b.workers.length === 0;
      if (noWorker && b.stall !== 'noWorker') { b.stall = 'noWorker'; emit(world, EV.PRODUCTION_STALLED, { id: b.id, reason: 'noWorker' }); }
      else if (!noWorker && b.stall === 'noWorker') b.stall = null;
    }
  }

  function updateSettlers(world) {
    const nav = ctx.services.nav;
    const spatial = ctx.services.spatial;
    for (const s of all(world, 'settler')) {
      s.px = s.x; s.pz = s.z;
      const keep = keepOf(world, s.owner);
      // arrival walk
      if (s.arriving) {
        const door = keep ? doorOf(keep) : { x: 0, z: 0 };
        const r = walkTo(nav, s, door.x + ((s.id % 5) - 2) * 1.2, door.z + 2 + (s.id % 3), SETTLER.speed, DT, 1.2);
        s.anim = r === 'walking' ? 'walk' : 'idle';
        if (r === 'arrived' || r === 'fail') s.arriving = false;
        continue;
      }
      if (s.leaving) {
        const entry = world.mapEntry || { x: -96, z: 96 };
        const r = walkTo(nav, s, entry.x, entry.z, SETTLER.speed, DT, 2);
        s.anim = 'walk';
        if (r === 'arrived' || r === 'fail') remove(world, s.id, 'left');
        continue;
      }
      // flee from nearby enemies (checked every 10 ticks)
      if ((world.tick + s.id) % 10 === 0 && spatial) {
        spatial.query(s.x, s.z, 9, enemyBuf, (e) => e.kind === 'unit' && e.owner !== s.owner && !e.downed);
        if (enemyBuf.length > 0 && keep) {
          if (!s.fleeing) {
            s.fleeing = world.tick + 120;
            stopWalking(s);
            if (s.carry && !s.job) s.carry = null;
            // interrupt the current task so reservations are released by economy
            s.interrupted = true;
          } else s.fleeing = world.tick + 120;
        }
      }
      if (s.fleeing) {
        if (world.tick > s.fleeing) { s.fleeing = false; stopWalking(s); continue; }
        const door = keep ? doorOf(keep) : { x: 0, z: 0 };
        const r = walkTo(nav, s, door.x, door.z + 1.5, SETTLER.speed * 1.25, DT, 2);
        s.anim = r === 'walking' ? 'run' : 'cower';
      }
    }
  }

  return {
    id: 'population',
    kind: 'sim',
    init(c) { ctx = c; },
    update() {
      const world = ctx.world;
      for (const owner in world.players) {
        if (world.players[owner].ai) continue;
        updatePlayer(world, owner);
      }
      updateSettlers(world);
    },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
    // test helpers
    assignJobs: (owner = PLAYER) => assignJobs(ctx.world, owner),
    rngCheck: () => worldRng(ctx.world),
  };
}
