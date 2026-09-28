// Rustfang Reavers AI: camp garrison, spawning, scouting, raids in waves, target
// selection, retreat/regroup, camp defence and difficulty scaling.
// Fairness: the AI reads the world state directly (no fog of war exists in the slice for
// either side); its only non-player advantage is the documented Hard HP bonus and
// scripted reinforcements that march in from the north-east road during raids.
import { EV, PLAYER, ENEMY } from '../core/contracts.js';
import { all, emit, alert, worldRng } from '../world/world.js';
import { doorOf, BUILDINGS } from '../buildings/defs.js';
import { spawnUnit, isAlive } from '../units/sim.js';
import { UNITS } from '../units/defs.js';
import { enemyFaction } from './factions.js';

export const AI_DIFFICULTY = {
  // harass: first plunder party (minutes), interval between parties (minutes), party size
  story: { harassAt: 11, harassEvery: 6, harassSize: 2, firstRaid: 6, growth: 2, spawnInterval: 50, waveInterval: 300, garrisonCap: 8, hpMult: 1, raidDelay: 180, reserves: 22 },
  normal: { harassAt: 8, harassEvery: 4.5, harassSize: 2, firstRaid: 9, growth: 3, spawnInterval: 35, waveInterval: 240, garrisonCap: 12, hpMult: 1, raidDelay: 120, reserves: 32 },
  hard: { harassAt: 6, harassEvery: 3.5, harassSize: 3, firstRaid: 11, growth: 4, spawnInterval: 24, waveInterval: 210, garrisonCap: 16, hpMult: 1.1, raidDelay: 105, reserves: 40 },
};

const TARGET_PRIORITY = { lodge: 0, farm: 0, quarry: 0, mine: 0, cottage: 1, barracks: 1, tower: 2, keep: 3 };
const RETREAT_AT = 0.25;

export function aiSettings(world) {
  const base = Object.hasOwn(AI_DIFFICULTY, world.meta.difficulty) ? AI_DIFFICULTY[world.meta.difficulty] : AI_DIFFICULTY.normal;
  const m = world.ai && world.ai.mods;
  if (!m) return base;
  // a chapter can field a stronger host: multipliers on the difficulty table
  return {
    ...base,
    reserves: Math.round(base.reserves * (m.reserves || 1)),
    hpMult: base.hpMult * (m.hpMult || 1),
    spawnInterval: base.spawnInterval * (m.spawnInterval || 1),
    waveInterval: base.waveInterval * (m.waveInterval || 1),
    garrisonCap: Math.round(base.garrisonCap * (m.garrisonCap || 1)),
    growth: base.growth + (m.growth || 0),
    firstRaid: base.firstRaid + (m.firstRaid || 0),
  };
}

export function warhallOf(world) { const hall = enemyFaction(world).hall; return all(world, 'building').find((b) => b.type === hall && b.owner === ENEMY && b.state !== 'destroyed') || null; }

export function spawnEnemy(world, type, x, z) {
  const u = spawnUnit(world, type, ENEMY, x, z);
  if (!u) return null;
  const m = aiSettings(world).hpMult;
  if (m !== 1) { u.maxHp = Math.round(u.maxHp * m); u.hp = u.maxHp; }
  return u;
}

export function pickRaidTarget(world, fromX, fromZ, vary = false) {
  const cands = [];
  for (const b of all(world, 'building')) {
    if (b.owner !== PLAYER || b.state === 'destroyed') continue;
    const pr = TARGET_PRIORITY[b.type] ?? 2;
    // the Rustfang prefer what nobody guards: every defender nearby makes a target less tempting
    let guards = 0;
    for (const u of all(world, 'unit')) if (u.owner === PLAYER && !u.downed && Math.hypot(u.x - b.x, u.z - b.z) < 22) guards++;
    cands.push({ b, score: pr * 1000 + Math.hypot(b.x - fromX, b.z - fromZ) + guards * 45 });
  }
  if (!cands.length) return null;
  cands.sort((a, c) => a.score - c.score || a.b.id - c.b.id);
  if (!vary) return cands[0].b;
  // vary between the few most attractive targets (seeded, deterministic)
  const top = cands.slice(0, Math.min(3, cands.length));
  return top[Math.floor(worldRng(world).next() * top.length)].b;
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
    const h = world.ai.harass;
    return all(world, 'unit').filter((u) => u.owner === ENEMY && !u.commander && !u.host && !u.sentinel && !world.ai.raidIds.includes(u.id) && u.id !== world.ai.scoutId && !(h && h.ids.includes(u.id)));
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
    const fac = enemyFaction(world);
    alert(world, 'danger', `${raid.length} ${fac.short} ${fac.fighters} are gathering at the ${fac.fort}!`, gx, gz);
    emit(world, 'ai:gather', { size: raid.length, x: gx, z: gz });
  }

  /** Plunder parties: a few raiders slip out to hit an outlying workshop, then run home. */
  function startHarass(world, hall) {
    const cfg = aiSettings(world);
    const ai = world.ai;
    const pool = garrison(world).filter((u) => !u.downed && UNITS[u.type].cls !== 'defensive');
    if (pool.length < cfg.harassSize + 3) return; // keep the fort manned
    // the least-defended workshop, farthest from the Keep
    const keep = all(world, 'building').find((b) => b.type === 'keep' && b.owner === PLAYER);
    let best = null, bs = -Infinity;
    for (const b of all(world, 'building')) {
      if (b.owner !== PLAYER || b.state === 'destroyed' || !(TARGET_PRIORITY[b.type] === 0)) continue;
      let guards = 0;
      for (const u of all(world, 'unit')) if (u.owner === PLAYER && !u.downed && Math.hypot(u.x - b.x, u.z - b.z) < 22) guards++;
      const s = (keep ? Math.hypot(b.x - keep.x, b.z - keep.z) : 0) - guards * 40 - Math.hypot(b.x - hall.x, b.z - hall.z) * 0.3;
      if (s > bs) { bs = s; best = b; }
    }
    if (!best) return;
    const party = pool.slice(0, cfg.harassSize);
    const d = doorOf(best);
    party.forEach((u, i) => {
      u.order = { type: 'attackMove', x: d.x + i * 1.5, z: d.z + 1, ax: u.x, az: u.z, targetBuilding: best.id };
      u.target = null; u.path = null; u.dest = null;
    });
    ai.harass = { ids: party.map((u) => u.id), target: best.id, until: world.tick + 75 * 20 }; // hit and run
    alert(world, 'danger', `${enemyFaction(world).short} plunderers are heading for your ${BUILDINGS[best.type].name}!`, best.x, best.z);
    emit(world, 'ai:harass', { size: party.length, target: best.id, x: best.x, z: best.z });
  }

  function updateHarass(world, hall) {
    const h = world.ai.harass;
    if (!h) return;
    const party = h.ids.map((id) => world.entities[id]).filter((u) => u && isAlive(u));
    const target = world.entities[h.target];
    const done = !party.length || !target || target.state === 'destroyed' || world.tick > h.until
      || party.reduce((s, u) => s + u.hp / u.maxHp, 0) < party.length * 0.5;
    if (!done) return;
    for (const u of party) { guard(world, u, hall); u.path = null; u.dest = null; }
    world.ai.harass = null;
  }

  function launchRaid(world, hall) {
    const ai = world.ai;
    const raid = ai.raidIds.map((id) => world.entities[id]).filter((u) => u && isAlive(u));
    const target = pickRaidTarget(world, hall.x, hall.z, true);
    if (!target || !raid.length) { ai.state = 'build'; ai.raidIds = []; ai.raidTick = world.tick + 60 * 20; return; }
    ai.raidTarget = target.id;
    ai.state = 'raid';
    ai.raidStartedTick = world.tick;
    orderRaid(world, raid, target);
    emit(world, EV.AI_WAVE, { wave: ai.wave + 1, size: raid.length, target: target.id, x: target.x, z: target.z });
    alert(world, 'danger', `${enemyFaction(world).short} attack! ${raid.length} ${enemyFaction(world).fighters} are marching on your ${BUILDINGS[target.type].name}.`, target.x, target.z);
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
        if (raid.length) alert(world, 'success', `The ${enemyFaction(world).fighters} are breaking and fleeing back to the ${enemyFaction(world).fort}!`);
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
      if (!ai.commanderEngaged) { ai.commanderEngaged = true; alert(world, 'danger', `${enemyFaction(world).leader} enters the fight!`, cmdr.x, cmdr.z); }
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
        // the fort's reserves are finite, and nobody new musters while the Warhall burns
        if ((ai.spawned || 0) < cfg.reserves && hall.hp > hall.maxHp * 0.5 && g.length < cfg.garrisonCap + ai.wave * 2) {
          const d = doorOf(hall);
          const cycle = enemyFaction(world).cycle;
          const type = cycle[(ai.spawned || 0) % cycle.length];
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
          if (world.tick > 60 * 20) alert(world, 'warn', `A ${enemyFaction(world).short} scout was seen near your borders.`, s.x, s.z);
        } else if (ai.scoutStage === 'back' && s.order.type !== 'move') { guard(world, s, hall); ai.scoutId = null; }
      }
      // plunder parties until the great raid is announced
      if (ai.nextHarassTick == null) ai.nextHarassTick = Math.round(cfg.harassAt * 1200);
      if (!ai.harass && ai.state === 'build' && !world.mission.flags.raidWarned && ai.wave === 0 && world.tick >= ai.nextHarassTick) {
        ai.nextHarassTick = world.tick + Math.round(cfg.harassEvery * 1200);
        startHarass(world, hall);
      }
      if (ai.harass && world.tick % 10 === 3) updateHarass(world, hall);
      // raids
      if (ai.state === 'build' && ai.raidTick != null && world.tick >= ai.raidTick) startRaid(world, hall);
      if (ai.state === 'gather' && world.tick >= ai.gatherUntil) launchRaid(world, hall);
      if ((ai.state === 'raid' || ai.state === 'retreat') && world.tick % 10 === 0) updateRaid(world, hall);
      if (ai.state === 'gather') { ai.raidIds = ai.raidIds.filter((id) => world.entities[id] && isAlive(world.entities[id])); if (!ai.raidIds.length) { ai.state = 'build'; ai.raidTick = world.tick + 60 * 20; } }
      if (world.tick % 20 === 7) updateDefence(world, hall);
    },
  };
}

