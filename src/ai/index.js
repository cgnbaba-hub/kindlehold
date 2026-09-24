// Rustfang Reavers AI: camp garrison, spawning, scouting, raids in waves, target
// selection, retreat/regroup, camp defence and difficulty scaling.
// Fairness: the AI reads the world state directly (no fog of war exists in the slice for
// either side); its only non-player advantage is the documented Hard HP bonus and
// scripted reinforcements that march in from the north-east road during raids.
import { EV, PLAYER, ENEMY } from '../core/contracts.js';
import { all, emit, alert } from '../world/world.js';
import { doorOf, BUILDINGS } from '../buildings/defs.js';
import { spawnUnit, isAlive } from '../units/sim.js';
import { UNITS } from '../units/defs.js';

export const AI_DIFFICULTY = {
  story: { firstRaid: 6, growth: 2, spawnInterval: 50, waveInterval: 300, garrisonCap: 8, hpMult: 1, raidDelay: 180 },
  normal: { firstRaid: 9, growth: 3, spawnInterval: 35, waveInterval: 240, garrisonCap: 12, hpMult: 1, raidDelay: 120 },
  hard: { firstRaid: 11, growth: 4, spawnInterval: 24, waveInterval: 210, garrisonCap: 16, hpMult: 1.1, raidDelay: 105 },
};

const SPAWN_CYCLE = ['reaver', 'reaver', 'slinger', 'brute', 'reaver', 'slinger'];
const TARGET_PRIORITY = { lodge: 0, farm: 0, quarry: 0, mine: 0, cottage: 1, barracks: 1, tower: 2, keep: 3 };
const RETREAT_AT = 0.35;

export function aiSettings(world) { return Object.hasOwn(AI_DIFFICULTY, world.meta.difficulty) ? AI_DIFFICULTY[world.meta.difficulty] : AI_DIFFICULTY.normal; }

export function warhallOf(world) { return all(world, 'building').find((b) => b.type === 'warhall' && b.owner === ENEMY && b.state !== 'destroyed') || null; }

export function spawnEnemy(world, type, x, z) {
  const u = spawnUnit(world, type, ENEMY, x, z);
  if (!u) return null;
  const m = aiSettings(world).hpMult;
  if (m !== 1) { u.maxHp = Math.round(u.maxHp * m); u.hp = u.maxHp; }
  return u;
}

export function pickRaidTarget(world, fromX, fromZ) {
  let best = null, bestScore = Infinity;
  for (const b of all(world, 'building')) {
    if (b.owner !== PLAYER || b.state === 'destroyed') continue;
    const pr = TARGET_PRIORITY[b.type] ?? 2;
    const score = pr * 1000 + Math.hypot(b.x - fromX, b.z - fromZ);
    if (score < bestScore) { bestScore = score; best = b; }
  }
  return best;
}

export function createAiModule() {
  let ctx = null;

  function campAnchor(world, u, hall) {
    const ang = (u.id * 2.399) % (Math.PI * 2);
    const r = 11 + (u.id % 3) * 2.5;
    return [hall.x + Math.sin(ang) * r, hall.z + Math.cos(ang) * r];
  }

  function guard(world, u, hall) {
    const [ax, az] = campAnchor(world, u, hall);
    u.order = { type: 'guard', ax, az, leash: 28 };
    u.retreating = false;
  }

  function garrison(world) {
    return all(world, 'unit').filter((u) => u.owner === ENEMY && !u.commander && !world.ai.raidIds.includes(u.id) && u.id !== world.ai.scoutId);
  }

  /** Raids are formed only from the camp garrison (no units appear from nowhere), so
   *  harassing the camp really does shrink the next raid. Too small a garrison delays it. */
  function startRaid(world, hall) {
    const cfg = aiSettings(world);
    const ai = world.ai;
    const size = cfg.firstRaid + ai.wave * cfg.growth;
    const pool = garrison(world).filter((u) => !u.downed);
    if (pool.length < Math.ceil(size * 0.6) && (ai.postponed || 0) < 2) {
      ai.postponed = (ai.postponed || 0) + 1;
      ai.raidTick = world.tick + 45 * 20;
      ai.nextSpawnTick = Math.min(ai.nextSpawnTick, world.tick + 5 * 20);
      emit(world, 'ai:raid-delayed', { garrison: pool.length, wanted: size });
      return;
    }
    const raid = pool.slice(0, size);
    if (!raid.length) { ai.raidTick = world.tick + 60 * 20; return; }
    ai.postponed = 0;
    // gather outside the gate for 20 s, visibly, before marching
    const keep = all(world, 'building').find((b) => b.type === 'keep' && b.owner === PLAYER);
    const dirX = keep ? keep.x - hall.x : -1, dirZ = keep ? keep.z - hall.z : 1;
    const len = Math.hypot(dirX, dirZ) || 1;
    const gx = hall.x + (dirX / len) * 34, gz = hall.z + (dirZ / len) * 34;
    raid.forEach((u, i) => {
      const ang = (i / raid.length) * Math.PI * 2;
      u.order = { type: 'move', x: gx + Math.sin(ang) * 3, z: gz + Math.cos(ang) * 3, ax: gx, az: gz };
      u.target = null; u.path = null; u.dest = null;
    });
    ai.raidIds = raid.map((u) => u.id);
    ai.raidStartStrength = raid.reduce((s, u) => s + u.hp, 0);
    ai.state = 'gather';
    ai.gatherUntil = world.tick + 20 * 20;
    ai.gatherPoint = [gx, gz];
    ai.raidTick = null;
    alert(world, 'danger', `${raid.length} Rustfang raiders are gathering at the ford fort!`, gx, gz);
    emit(world, 'ai:gather', { size: raid.length, x: gx, z: gz });
  }

  function launchRaid(world, hall) {
    const ai = world.ai;
    const raid = ai.raidIds.map((id) => world.entities[id]).filter((u) => u && isAlive(u));
    const target = pickRaidTarget(world, hall.x, hall.z);
    if (!target || !raid.length) { ai.state = 'build'; ai.raidIds = []; ai.raidTick = world.tick + 60 * 20; return; }
    ai.raidTarget = target.id;
    ai.state = 'raid';
    ai.raidStartedTick = world.tick;
    orderRaid(world, raid, target);
    emit(world, EV.AI_WAVE, { wave: ai.wave + 1, size: raid.length, target: target.id, x: target.x, z: target.z });
    alert(world, 'danger', `Rustfang raid! ${raid.length} reavers are marching on your ${BUILDINGS[target.type].name}.`, target.x, target.z);
  }

  function orderRaid(world, raid, target) {
    const d = doorOf(target);
    raid.forEach((u, i) => {
      const ang = (i / Math.max(1, raid.length)) * Math.PI * 2;
      u.order = { type: 'attackMove', x: d.x + Math.sin(ang) * 3, z: d.z + Math.cos(ang) * 3, ax: u.x, az: u.z, targetBuilding: target.id };
      u.target = null;
      u.path = null; u.dest = null;
    });
  }

  function updateRaid(world, hall) {
    const ai = world.ai;
    const raid = ai.raidIds.map((id) => world.entities[id]).filter((u) => u && isAlive(u));
    ai.raidIds = raid.map((u) => u.id);
    const strength = raid.reduce((s, u) => s + u.hp, 0);
    if (ai.state === 'raid') {
      if (raid.length === 0 || strength <= ai.raidStartStrength * RETREAT_AT) {
        ai.state = 'retreat';
        ai.retreatTick = world.tick;
        for (const u of raid) {
          const [ax, az] = hall ? campAnchor(world, u, hall) : [u.x, u.z];
          u.order = { type: 'move', x: ax, z: az, ax, az };
          u.target = null; u.retreating = true; u.path = null; u.dest = null;
        }
        if (raid.length) alert(world, 'success', 'The raiders are breaking and fleeing back to the ford!');
        emit(world, 'ai:retreat', { wave: ai.wave + 1, survivors: raid.length });
        return;
      }
      let target = world.entities[ai.raidTarget];
      if (!target || target.state === 'destroyed') {
        target = pickRaidTarget(world, raid[0].x, raid[0].z);
        if (target) { ai.raidTarget = target.id; orderRaid(world, raid, target); }
      } else {
        // re-issue for units that arrived and went idle
        for (const u of raid) if (u.order.type === 'idle' && u.target == null) { const d = doorOf(target); u.order = { type: 'attackMove', x: d.x, z: d.z, ax: u.x, az: u.z, targetBuilding: target.id }; u.target = target.id; }
      }
    } else if (ai.state === 'retreat') {
      const home = raid.every((u) => u.order.type !== 'move') || world.tick - ai.retreatTick > 90 * 20;
      if (home) {
        for (const u of raid) if (hall) guard(world, u, hall);
        ai.raidIds = [];
        ai.state = 'build';
        ai.wave++;
        ai.raidTick = world.tick + aiSettings(world).waveInterval * 20;
        emit(world, 'ai:regrouped', { wave: ai.wave });
      }
    }
  }

  function updateDefence(world, hall) {
    const ai = world.ai;
    // intruders near the camp
    let intruder = null, bestD = Infinity;
    for (const u of all(world, 'unit')) {
      if (u.owner !== PLAYER || u.downed) continue;
      const d = Math.hypot(u.x - hall.x, u.z - hall.z);
      if (d < 34 && d < bestD) { bestD = d; intruder = u; }
    }
    const hallHit = world.tick - hall.lastHitTick < 100;
    if (!intruder && !hallHit) return;
    for (const u of garrison(world)) {
      if (u.target != null) continue;
      u.order = { type: 'guard', ax: u.order.ax ?? u.x, az: u.order.az ?? u.z, leash: 40 };
      u.target = intruder ? intruder.id : null;
    }
    const cmdr = all(world, 'unit').find((u) => u.commander && u.owner === ENEMY);
    if (cmdr && cmdr.target == null && (hall.hp < hall.maxHp * 0.6 || bestD < 20) && intruder) {
      cmdr.order = { type: 'guard', ax: hall.x, az: hall.z + 8, leash: 36 };
      cmdr.target = intruder.id;
      if (!ai.commanderEngaged) { ai.commanderEngaged = true; alert(world, 'danger', 'Vharek the Tollbreaker enters the fight!', cmdr.x, cmdr.z); }
    }
  }

  return {
    id: 'ai',
    kind: 'sim',
    init(c) { ctx = c; },
    update() {
      const world = ctx.world;
      const ai = world.ai;
      const hall = warhallOf(world);
      if (!hall || world.mission.result) return;
      const cfg = aiSettings(world);
      // spawning
      if (world.tick >= ai.nextSpawnTick) {
        ai.nextSpawnTick = world.tick + cfg.spawnInterval * 20;
        const g = garrison(world);
        if (g.length < cfg.garrisonCap + ai.wave * 2) {
          const d = doorOf(hall);
          const type = SPAWN_CYCLE[(ai.spawned || 0) % SPAWN_CYCLE.length];
          ai.spawned = (ai.spawned || 0) + 1;
          const u = spawnEnemy(world, type, d.x, d.z);
          if (u) guard(world, u, hall);
        }
      }
      // healing at camp
      if (world.tick % 20 === 0) {
        for (const u of all(world, 'unit')) {
          if (u.owner !== ENEMY || u.downed || u.hp >= u.maxHp) continue;
          if (world.tick - (u.lastHitTick || -9999) > 100 && Math.hypot(u.x - hall.x, u.z - hall.z) < 26) u.hp = Math.min(u.maxHp, u.hp + 2);
        }
      }
      // scouting
      if (world.tick >= ai.nextScoutTick && ai.state === 'build') {
        ai.nextScoutTick = world.tick + 180 * 20;
        const scout = garrison(world).find((u) => UNITS[u.type].cls === 'ranged');
        const keep = all(world, 'building').find((b) => b.type === 'keep' && b.owner === PLAYER);
        if (scout && keep) {
          const dx = hall.x - keep.x, dz = hall.z - keep.z, len = Math.hypot(dx, dz);
          const sx = keep.x + (dx / len) * 48, sz = keep.z + (dz / len) * 48;
          scout.order = { type: 'move', x: sx, z: sz, ax: sx, az: sz };
          scout.path = null; scout.dest = null;
          ai.scoutId = scout.id;
          ai.scoutStage = 'out';
          emit(world, 'ai:scout', { id: scout.id, x: sx, z: sz });
        }
      }
      if (ai.scoutId != null) {
        const s = world.entities[ai.scoutId];
        if (!s || !isAlive(s)) { ai.scoutId = null; }
        else if (ai.scoutStage === 'out' && s.order.type !== 'move') {
          ai.spottedTick = world.tick;
          ai.scoutStage = 'back';
          const [ax, az] = campAnchor(world, s, hall);
          s.order = { type: 'move', x: ax, z: az, ax, az };
          if (world.tick > 60 * 20) alert(world, 'warn', 'A Rustfang scout was seen near your borders.', s.x, s.z);
        } else if (ai.scoutStage === 'back' && s.order.type !== 'move') { guard(world, s, hall); ai.scoutId = null; }
      }
      // raids
      if (ai.state === 'build' && ai.raidTick != null && world.tick >= ai.raidTick) startRaid(world, hall);
      if (ai.state === 'gather' && world.tick >= ai.gatherUntil) launchRaid(world, hall);
      if ((ai.state === 'raid' || ai.state === 'retreat') && world.tick % 10 === 0) updateRaid(world, hall);
      if (ai.state === 'gather') { ai.raidIds = ai.raidIds.filter((id) => world.entities[id] && isAlive(world.entities[id])); if (!ai.raidIds.length) { ai.state = 'build'; ai.raidTick = world.tick + 60 * 20; } }
      if (world.tick % 20 === 7) updateDefence(world, hall);
    },
  };
}

