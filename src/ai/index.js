// Rustfang Reavers AI: camp garrison, spawning, scouting, raids in waves, target
// selection, retreat/regroup, camp defence and difficulty scaling.
// Fairness: the AI reads the world state directly (no fog of war exists in the slice for
// either side); its only non-player advantage is the documented Hard HP bonus and
// scripted reinforcements that march in from the north-east road during raids.
import { EV, PLAYER, ENEMY } from '../core/contracts.js';
import { all, emit, alert, worldRng, remove } from '../world/world.js';
import { addRes } from '../economy/stock.js';
import { DONKEYS } from '../transport/defs.js';
import { doorOf, BUILDINGS } from '../buildings/defs.js';
import { spawnUnit, isAlive, formationOrder } from '../units/sim.js';
import { formationSlots } from '../navigation/index.js';
import { UNITS } from '../units/defs.js';
import { enemyFaction } from './factions.js';
import { isFastHour, NIGHT_PACE } from '../core/daytime.js';

export const AI_DIFFICULTY = {
  // harass: first plunder party (minutes), interval between parties (minutes), party size
  // siegeFrom: the first raid (0 = the first) that brings siege engines, null = never; siegeMax: at most this many;
  // escort: shields or blades told off to guard each engine; retreatAt: a raid turns back below this share of its strength
  story: { harassAt: 11, harassEvery: 6, harassSize: 2, firstRaid: 6, growth: 2, spawnInterval: 50, waveInterval: 300, garrisonCap: 8, hpMult: 1, raidDelay: 180, reserves: 22, siegeFrom: null, siegeMax: 0, escort: 0, retreatAt: 0.25 },
  normal: { harassAt: 8, harassEvery: 4.5, harassSize: 2, firstRaid: 9, growth: 3, spawnInterval: 35, waveInterval: 240, garrisonCap: 12, hpMult: 1, raidDelay: 120, reserves: 32, siegeFrom: 3, siegeMax: 1, escort: 1, retreatAt: 0.25 },
  hard: { harassAt: 6, harassEvery: 3.5, harassSize: 3, firstRaid: 11, growth: 5, spawnInterval: 24, waveInterval: 210, garrisonCap: 18, hpMult: 1.1, raidDelay: 105, reserves: 48, siegeFrom: 1, siegeMax: 2, escort: 2, retreatAt: 0.2 },
};
// an engine draws this many places from the fort's reserves
export const ENGINE_RESERVE = 2;
// More varied raids (the counterweight to roads, donkeys and priorities; CLAUDE.md, "Schwierigkeit"):
// laterHarass — plunder parties also between the great raids, every `harassEvery` × this;
// plunder — goods a party carries off from a Storehouse; flankFrom — from this raid on, a third of
// the raid swings round and strikes a second target from the side (null = never);
// nightFrom — from this raid on, every other raid comes at dusk (null = never).
// Flankers come on top of the raid (spare men from the garrison), and plunder parties go out
// between raids only while the next raid stays full, so neither weakens the main blow.
// Measured (bot, chapter one, 40 Hard seeds): 20/40 won with and without these, 22/40 with the bot
// using roads and a stable either way. The bot builds compactly and keeps its stores at the Keep,
// so the plunderers find little; they are aimed at spread-out towns.
export const RAID_VARIETY = {
  story: { laterHarass: null, plunder: 0, flankFrom: null, nightFrom: null },
  normal: { laterHarass: 1.6, plunder: 15, flankFrom: 3, nightFrom: null },
  hard: { laterHarass: 1.2, plunder: 25, flankFrom: 1, nightFrom: 2 },
};
export function raidVariety(world) {
  return Object.hasOwn(RAID_VARIETY, world.meta.difficulty) ? RAID_VARIETY[world.meta.difficulty] : RAID_VARIETY.normal;
}
/** Ticks from now until the clock next shows `hour` (the dark hours pass NIGHT_PACE times faster). */
export function ticksUntilHour(world, hour) {
  const D = world.time.dayLengthTicks;
  let h = world.time.hour, t = 0;
  for (let i = 0; i < 4000; i++) {
    const step = 20;
    const nh = h + (24 / D) * (isFastHour(h) ? NIGHT_PACE : 1) * step;
    if ((h < hour && nh >= hour) || (nh >= 24 && nh - 24 >= hour)) return t + step;
    h = nh % 24; t += step;
  }
  return null;
}
// plunder parties go for outlying workshops, and also for what a spread-out town leans on
const PLUNDER_TARGETS = new Set(['storehouse', 'donkeystable', 'well']);

const TARGET_PRIORITY = { lodge: 0, farm: 0, quarry: 0, mine: 0, cottage: 1, barracks: 1, tower: 2, keep: 3 };

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
    siegeFrom: base.siegeFrom == null ? null : Math.max(0, base.siegeFrom + (m.siegeFrom || 0)),
    siegeMax: base.siegeFrom == null ? 0 : base.siegeMax + (m.siegeMax || 0),
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

const isEngine = (u) => UNITS[u.type].cls === 'siege';

/** What a raid's engines shoot at: the tower (or lit Keep) guarding the raid's target that lies
 *  nearest the approach, otherwise the target itself. */
export function siegeTargetFor(world, target, fromX, fromZ) {
  let best = null, bd = Infinity;
  for (const b of all(world, 'building')) {
    if (b.owner !== PLAYER || b.state !== 'active' || !BUILDINGS[b.type].attack) continue;
    if (Math.hypot(b.x - target.x, b.z - target.z) > 34) continue;
    const d = Math.hypot(b.x - fromX, b.z - fromZ);
    if (d < bd) { bd = d; best = b; }
  }
  return best || target;
}

export function createAiModule() {
  let ctx = null;

  function walkableNear(x, z) {
    const nav = ctx.services && ctx.services.nav;
    if (!nav || nav.walkable(x, z)) return [x, z];
    const p = nav.nearestWalkablePoint(x, z, 4);
    return p ? [p.x, p.z] : [x, z];
  }

  /** Engines for this raid: the ones already at the fort, and new ones rolled out of it while
   *  the reserves last (each costs ENGINE_RESERVE places). Later raids bring more. */
  function rollOutEngines(world, hall, cfg) {
    const ai = world.ai;
    if (cfg.siegeFrom == null || ai.wave < cfg.siegeFrom || cfg.siegeMax <= 0) return [];
    const want = Math.min(cfg.siegeMax, 1 + Math.floor((ai.wave - cfg.siegeFrom) / 2));
    const out = all(world, 'unit').filter((u) => u.owner === ENEMY && !u.downed && isEngine(u)).slice(0, want);
    const fac = enemyFaction(world), d = doorOf(hall);
    while (out.length < want && (ai.spawned || 0) + ENGINE_RESERVE <= cfg.reserves && hall.hp > hall.maxHp * 0.5) {
      const type = fac.engines[(ai.enginesBuilt || 0) % fac.engines.length];
      const u = spawnEnemy(world, type, d.x + out.length * 2.5, d.z);
      if (!u) break;
      ai.spawned = (ai.spawned || 0) + ENGINE_RESERVE;
      ai.enginesBuilt = (ai.enginesBuilt || 0) + 1;
      out.push(u);
      alert(world, 'danger', `The ${fac.short} are rolling a ${UNITS[type].name} out of the ${fac.fort}! Engines cannot fight up close: meet it with blades.`, u.x, u.z);
      emit(world, 'ai:engine', { id: u.id, type });
    }
    return out;
  }

  function campAnchor(world, u, hall) {
    const ang = (u.id * 2.399) % (Math.PI * 2);
    const r = 11 + (u.id % 3) * 2.5;
    return [hall.x + Math.sin(ang) * r, hall.z + Math.cos(ang) * r];
  }

  function guard(world, u, hall) {
    const [ax, az] = campAnchor(world, u, hall);
    u.order = { type: 'guard', ax, az, leash: 28 };
    u.retreating = false;
    u.escort = null;
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
    const pool = garrison(world).filter((u) => !u.downed && !isEngine(u));
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
    // a flank comes on top of the raid, from what the garrison can spare beyond it
    const rv = raidVariety(world);
    for (const u of pool) delete u.flanker;
    if (rv.flankFrom != null && ai.wave >= rv.flankFrom && raid.length >= 6) {
      const spare = pool.slice(size).filter((u) => UNITS[u.type].cls !== 'defensive').slice(0, Math.ceil(size / 3));
      if (spare.length >= 2) { for (const u of spare) u.flanker = true; raid.push(...spare); }
    }
    raid.push(...rollOutEngines(world, hall, cfg));
    // gather outside the gate for 20 s, visibly, before marching
    const keep = all(world, 'building').find((b) => b.type === 'keep' && b.owner === PLAYER);
    const dirX = keep ? keep.x - hall.x : -1, dirZ = keep ? keep.z - hall.z : 1;
    const len = Math.hypot(dirX, dirZ) || 1;
    const gx = hall.x + (dirX / len) * 34, gz = hall.z + (dirZ / len) * 34;
    // form up in the faction's formation, facing the Keep: shields first, archers and engines behind
    const { sorted, inner } = formationOrder(raid);
    const slots = formationSlots(sorted.length, gx, gz, hall.x, hall.z, 2, enemyFaction(world).formation, inner);
    sorted.forEach((u, i) => {
      const [sx, sz] = walkableNear(slots[i][0], slots[i][1]);
      u.order = { type: 'move', x: sx, z: sz, ax: gx, az: gz };
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
    const pool = garrison(world).filter((u) => !u.downed && UNITS[u.type].cls !== 'defensive' && !isEngine(u));
    if (pool.length < cfg.harassSize + 3) return; // keep the fort manned
    // between the great raids only what the next one can spare goes plundering
    if (world.ai.wave > 0 && garrison(world).filter((u) => !u.downed && !isEngine(u)).length < cfg.firstRaid + world.ai.wave * cfg.growth + cfg.harassSize) return;
    // the least-defended workshop, farthest from the Keep
    const keep = all(world, 'building').find((b) => b.type === 'keep' && b.owner === PLAYER);
    let best = null, bs = -Infinity;
    const later = world.ai.wave > 0;
    for (const b of all(world, 'building')) {
      if (b.owner !== PLAYER || b.state === 'destroyed' || !(TARGET_PRIORITY[b.type] === 0 || (later && PLUNDER_TARGETS.has(b.type) && b.state === 'active'))) continue;
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
    const what = best.type === 'storehouse' ? ' to carry off its goods' : best.type === 'donkeystable' ? ' to drive off a donkey' : '';
    alert(world, 'danger', `${enemyFaction(world).short} plunderers are heading for your ${BUILDINGS[best.type].name}${what}!`, best.x, best.z);
    emit(world, 'ai:harass', { size: party.length, target: best.id, x: best.x, z: best.z });
  }

  function updateHarass(world, hall) {
    const h = world.ai.harass;
    if (!h) return;
    const party = h.ids.map((id) => world.entities[id]).filter((u) => u && isAlive(u));
    const target = world.entities[h.target];
    // at a Storehouse or a Donkey Stable they grab what they came for and run
    if (!h.grabbed && target && target.state === 'active' && (target.type === 'storehouse' || target.type === 'donkeystable')
      && party.some((u) => Math.hypot(u.x - target.x, u.z - target.z) < BUILDINGS[target.type].radius + 3.5)) {
      h.grabbed = true;
      h.until = Math.min(h.until, world.tick + 20);
      plunder(world, target);
    }
    const done = !party.length || !target || target.state === 'destroyed' || world.tick > h.until
      || party.reduce((s, u) => s + u.hp / u.maxHp, 0) < party.length * 0.5;
    if (!done) return;
    for (const u of party) { guard(world, u, hall); u.path = null; u.dest = null; }
    world.ai.harass = null;
  }

  function plunder(world, b) {
    const short = enemyFaction(world).short;
    if (b.type === 'storehouse') {
      const p = world.players[b.owner];
      const n = raidVariety(world).plunder;
      let good = null;
      for (const r of ['provisions', 'iron', 'stone', 'timber']) if (!good || p.res[r] > p.res[good]) good = r;
      const amt = Math.min(n, Math.floor(p.res[good] || 0));
      if (amt <= 0) return;
      addRes(world, b.owner, good, -amt, 'plundered');
      alert(world, 'danger', `${short} plunderers carried off ${amt} ${good} from the Storehouse!`, b.x, b.z);
      emit(world, 'ai:plunder', { id: b.id, res: good, amt });
    } else {
      const dn = all(world, 'donkey').find((d) => d.stable === b.id);
      if (!dn) return;
      remove(world, dn.id, 'stolen');
      alert(world, 'danger', `${short} plunderers drove off a donkey from the stable! The stable buys a new one for ${DONKEYS.price} Taler when it can.`, b.x, b.z);
      emit(world, 'ai:plunder', { id: b.id, donkey: true });
    }
  }

  /** From the wave the difficulty sets on, a third of the raid (no engines, no shields) breaks
   *  away and comes at a second target from the side, so one guarded gate is not enough. */
  function splitFlank(world, raid, target, hall) {
    const ai = world.ai;
    ai.flankIds = []; ai.flankTarget = null;
    const able = raid.filter((u) => u.flanker && !isEngine(u));
    for (const u of able) delete u.flanker;
    // without a second target worth a detour the spare men stay at the fort
    const stayHome = () => { for (const u of able) { guard(world, u, hall); u.path = null; u.dest = null; raid.splice(raid.indexOf(u), 1); } ai.raidIds = raid.map((u) => u.id); return null; };
    if (able.length < 2) return stayHome();
    let second = null, bs = Infinity;
    for (const b of all(world, 'building')) {
      if (b.owner !== PLAYER || b.state === 'destroyed' || b.id === target.id || (TARGET_PRIORITY[b.type] ?? 2) > 1) continue;
      const apart = Math.hypot(b.x - target.x, b.z - target.z);
      if (apart < 25) continue;
      let guards = 0;
      for (const u of all(world, 'unit')) if (u.owner === PLAYER && !u.downed && Math.hypot(u.x - b.x, u.z - b.z) < 22) guards++;
      const sc = Math.hypot(b.x - hall.x, b.z - hall.z) + guards * 45 - Math.min(apart, 60) * 0.5;
      if (sc < bs) { bs = sc; second = b; }
    }
    if (!second) return stayHome();
    const units = able;
    // the swing: a point beside the second target, away from the main column's road
    const mx = target.x - hall.x, mz = target.z - hall.z, ml = Math.hypot(mx, mz) || 1;
    const side = ((second.x - target.x) * -mz + (second.z - target.z) * mx) >= 0 ? 1 : -1;
    const [wx, wz] = walkableNear(second.x + (-mz / ml) * side * 24, second.z + (mx / ml) * side * 24);
    units.forEach((u, i) => {
      u.order = { type: 'attackMove', x: wx + (i % 3) * 1.6, z: wz + Math.floor(i / 3) * 1.6, ax: u.x, az: u.z };
      u.target = null; u.path = null; u.dest = null; u.escort = null;
    });
    ai.flankIds = units.map((u) => u.id);
    ai.flankTarget = second.id;
    ai.flankStage = 'swing';
    return { units, target: second };
  }

  function updateFlank(world, hall, retreat) {
    const ai = world.ai;
    if (!ai.flankIds || !ai.flankIds.length) return;
    const units = ai.flankIds.map((id) => world.entities[id]).filter((u) => u && isAlive(u));
    ai.flankIds = units.map((u) => u.id);
    if (retreat) {
      for (const u of units) {
        const [ax, az] = hall ? campAnchor(world, u, hall) : [u.x, u.z];
        u.order = { type: 'move', x: ax, z: az, ax, az };
        u.target = null; u.retreating = true; u.path = null; u.dest = null;
      }
      ai.flankStage = 'home';
      return;
    }
    if (ai.flankStage === 'home') return;
    let t = world.entities[ai.flankTarget];
    if (!t || t.state === 'destroyed') {
      if (!units.length) return;
      t = pickRaidTarget(world, units[0].x, units[0].z);
      if (!t) return;
      ai.flankTarget = t.id; ai.flankStage = 'strike';
    }
    const swung = ai.flankStage === 'swing' && units.every((u) => u.order.type === 'idle' || u.target != null || Math.hypot(u.x - u.order.x, u.z - u.order.z) < 4);
    if (swung) ai.flankStage = 'strike';
    if (ai.flankStage !== 'strike') return;
    for (const u of units) {
      if (u.target != null || (u.order.type === 'attackMove' && u.order.targetBuilding === t.id)) continue;
      const d = doorOf(t);
      u.order = { type: 'attackMove', x: d.x, z: d.z, ax: u.x, az: u.z, targetBuilding: t.id };
      u.target = null; u.path = null; u.dest = null;
    }
  }

  function launchRaid(world, hall) {
    const ai = world.ai;
    const raid = ai.raidIds.map((id) => world.entities[id]).filter((u) => u && isAlive(u));
    const target = pickRaidTarget(world, hall.x, hall.z, true);
    if (!target || !raid.length) { ai.state = 'build'; ai.raidIds = []; ai.raidTick = world.tick + 60 * 20; return; }
    ai.raidTarget = target.id;
    ai.state = 'raid';
    ai.raidStartedTick = world.tick;
    const flank = splitFlank(world, raid, target, hall);
    const main = flank ? raid.filter((u) => !flank.units.includes(u)) : raid;
    ai.raidIds = main.map((u) => u.id);
    ai.raidStartStrength = main.reduce((s, u) => s + u.hp, 0);
    orderRaid(world, main, target, true);
    emit(world, EV.AI_WAVE, { wave: ai.wave + 1, size: raid.length, target: target.id, x: target.x, z: target.z, flank: flank ? flank.target.id : null });
    const fac = enemyFaction(world);
    alert(world, 'danger', `${ai.nightRaid ? 'Torches in the dusk! ' : ''}${fac.short} attack! ${main.length} ${fac.fighters} are marching on your ${BUILDINGS[target.type].name}.`, target.x, target.z);
    if (flank) alert(world, 'danger', `${flank.units.length} more are swinging round to strike your ${BUILDINGS[flank.target.type].name} from the side!`, flank.target.x, flank.target.z);
  }

  /** March on a target in formation. On the first approach (`march`) the column keeps the pace
   *  of its slowest member, so it arrives together; it charges once it is close (updateRaid).
   *  Engines stop at the edge of their reach and bombard the tower that guards the target. */
  function orderRaid(world, raid, target, march = false) {
    const ai = world.ai;
    const d = doorOf(target);
    let cx = 0, cz = 0;
    for (const u of raid) { cx += u.x; cz += u.z; }
    cx /= raid.length; cz /= raid.length;
    const pace = march ? Math.min(...raid.map((u) => UNITS[u.type].speed)) : 0;
    const paced = pace ? { pace } : {};
    ai.charged = !march;
    const engines = raid.filter(isEngine);
    // each engine gets a guard of shields (or blades) that stays with it instead of storming
    const guards = new Map();
    const fighters = formationOrder(raid.filter((u) => !isEngine(u) && ['defensive', 'melee'].includes(UNITS[u.type].cls))).sorted;
    for (const e of engines) for (let k = 0; k < aiSettings(world).escort && fighters.length; k++) guards.set(fighters.shift().id, e);
    for (const u of raid) u.escort = guards.has(u.id) ? guards.get(u.id).id : null;
    const troops = raid.filter((u) => !isEngine(u) && !u.escort);
    const len = Math.hypot(cx - d.x, cz - d.z) || 1;
    const fx = d.x + ((cx - d.x) / len) * 4, fz = d.z + ((cz - d.z) / len) * 4;
    const { sorted, inner } = formationOrder(troops);
    const slots = formationSlots(sorted.length, fx, fz, cx, cz, 2, enemyFaction(world).formation, inner);
    sorted.forEach((u, i) => {
      const [sx, sz] = walkableNear(slots[i][0], slots[i][1]);
      u.order = { type: 'attackMove', x: sx, z: sz, ax: u.x, az: u.z, targetBuilding: target.id, ...paced };
      u.target = null; u.path = null; u.dest = null;
    });
    if (!engines.length) return;
    const st = siegeTargetFor(world, target, cx, cz);
    ai.siegeTarget = st.id;
    const sl = Math.hypot(cx - st.x, cz - st.z) || 1, ux = (cx - st.x) / sl, uz = (cz - st.z) / sl;
    engines.forEach((u, i) => {
      const r = BUILDINGS[st.type].radius + UNITS[u.type].range * 0.85, side = (i - (engines.length - 1) / 2) * 3;
      const [sx, sz] = walkableNear(st.x + ux * r - uz * side, st.z + uz * r + ux * side);
      u.order = { type: 'attackMove', x: sx, z: sz, ax: u.x, az: u.z, targetBuilding: st.id, ...paced };
      u.target = null; u.path = null; u.dest = null;
      // its guard walks a few steps ahead of it, between the engine and the defenders
      let k = 0;
      for (const g of raid) {
        if (g.escort !== u.id) continue;
        const off = (k++ - 0.5) * 2.4;
        const [gx, gz] = walkableNear(sx - ux * 3 - uz * off, sz - uz * 3 + ux * off);
        g.order = { type: 'attackMove', x: gx, z: gz, ax: g.x, az: g.z, targetBuilding: st.id, ...paced };
        g.target = null; g.path = null; g.dest = null;
      }
    });
  }

  function updateRaid(world, hall) {
    const ai = world.ai;
    const raid = ai.raidIds.map((id) => world.entities[id]).filter((u) => u && isAlive(u));
    ai.raidIds = raid.map((u) => u.id);
    const strength = raid.reduce((s, u) => s + u.hp, 0);
    if (ai.state === 'raid') {
      if (raid.length === 0 || strength <= ai.raidStartStrength * aiSettings(world).retreatAt) {
        ai.state = 'retreat';
        ai.retreatTick = world.tick;
        for (const u of raid) {
          const [ax, az] = hall ? campAnchor(world, u, hall) : [u.x, u.z];
          u.order = { type: 'move', x: ax, z: az, ax, az };
          u.target = null; u.retreating = true; u.path = null; u.dest = null; u.escort = null;
        }
        updateFlank(world, hall, true);
        if (raid.length) alert(world, 'success', `The ${enemyFaction(world).fighters} are breaking and fleeing back to the ${enemyFaction(world).fort}!`);
        emit(world, 'ai:retreat', { wave: ai.wave + 1, survivors: raid.length });
        return;
      }
      updateFlank(world, hall, false);
      let target = world.entities[ai.raidTarget];
      if (!target || target.state === 'destroyed') {
        target = pickRaidTarget(world, raid[0].x, raid[0].z);
        if (target) { ai.raidTarget = target.id; orderRaid(world, raid, target); }
      } else {
        // close to the target the column breaks into a charge
        const troops = raid.filter((u) => !isEngine(u) && !u.escort);
        if (!ai.charged && troops.length) {
          let cx = 0, cz = 0;
          for (const u of troops) { cx += u.x; cz += u.z; }
          if (Math.hypot(cx / troops.length - target.x, cz / troops.length - target.z) < 28) {
            for (const u of troops) delete u.order.pace;
            ai.charged = true;
          }
        }
        // re-issue for units that arrived and went idle; engines keep shooting from where they stand
        for (const u of raid) {
          if (u.escort && u.order.type === 'guard') {
            const e = world.entities[u.escort];
            if (!isAlive(e)) { u.escort = null; u.order = { type: 'idle', ax: u.x, az: u.z }; }
            else if (Math.hypot(e.x - u.order.ax, e.z - u.order.az) > 6) { u.order.ax = e.x; u.order.az = e.z; } // keep up with it
          }
          if (u.order.type !== 'idle' || u.target != null) continue;
          if (isEngine(u)) {
            let st = world.entities[ai.siegeTarget];
            if (!st || st.state === 'destroyed') { st = siegeTargetFor(world, target, u.x, u.z); ai.siegeTarget = st.id; }
            u.target = st.id;
            continue;
          }
          if (u.escort) {
            // guard the engine where it stands; with the engine gone, join the attack
            const e = world.entities[u.escort];
            if (e && isAlive(e)) { u.order = { type: 'guard', ax: e.x + (u.x - e.x) * 0.5, az: e.z + (u.z - e.z) * 0.5, leash: 12 }; continue; }
            u.escort = null;
          }
          const d = doorOf(target); u.order = { type: 'attackMove', x: d.x, z: d.z, ax: u.x, az: u.z, targetBuilding: target.id }; u.target = target.id;
        }
      }
    } else if (ai.state === 'retreat') {
      const flankers = (ai.flankIds || []).map((id) => world.entities[id]).filter((u) => u && isAlive(u));
      const home = [...raid, ...flankers].every((u) => u.order.type !== 'move') || world.tick - ai.retreatTick > 90 * 20;
      if (home) {
        for (const u of [...raid, ...flankers]) if (hall) guard(world, u, hall);
        ai.raidIds = []; ai.flankIds = []; ai.flankTarget = null;
        ai.state = 'build';
        ai.wave++;
        ai.raidTick = world.tick + aiSettings(world).waveInterval * 20;
        // night raids: every other raid from the difficulty's wave on comes at dusk, if dusk falls
        // within a third of the usual pause either way
        const rv = raidVariety(world), I = aiSettings(world).waveInterval * 20;
        ai.nightRaid = false;
        if (rv.nightFrom != null && ai.wave >= rv.nightFrom && ai.wave % 2 === 0) {
          const dusk = ticksUntilHour(world, 20.2);
          for (const at of [dusk, dusk + world.time.dayLengthTicks * (14 / 24 + 10 / 24 / NIGHT_PACE)]) {
            if (at != null && Math.abs(at - I) <= I / 3) { ai.raidTick = world.tick + Math.max(0, at - 20 * 20); ai.nightRaid = true; break; }
          }
        }
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
      const rv = raidVariety(world);
      const between = ai.wave > 0 && rv.laterHarass && ai.raidTick != null && ai.raidTick - world.tick > 60 * 20;
      if (!ai.harass && ai.state === 'build' && ((!world.mission.flags.raidWarned && ai.wave === 0) || between) && world.tick >= ai.nextHarassTick) {
        ai.nextHarassTick = world.tick + Math.round(cfg.harassEvery * (ai.wave > 0 ? rv.laterHarass : 1) * 1200);
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

