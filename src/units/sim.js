// Military units (incl. hero movement): orders, recruitment, movement, separation.
import { EV, PLAYER, DT } from '../core/contracts.js';
import { spawn, remove, all, emit } from '../world/world.js';
import { UNITS, RECRUITABLE, unitDef } from './defs.js';
import { BUILDINGS, doorOf } from '../buildings/defs.js';
import { pay, refund } from '../economy/stock.js';
import { followPath, formationSlots } from '../navigation/index.js';
import { isIdleLabourer } from '../population/index.js';
import { walkTo, stopWalking } from '../navigation/agent.js';

export const MAX_QUEUE = 5;
export const LEASH = 22;
const SEP_RADIUS = 0.9;
const FOE_MIN_DIST = 1.1;

export function spawnUnit(world, type, owner, x, z, extra = {}) {
  const def = unitDef(type);
  return spawn(world, {
    kind: 'unit', type, owner, x, z, heading: owner === PLAYER ? Math.PI : 0,
    hp: def.hp, maxHp: def.hp,
    order: { type: 'idle', ax: x, az: z },
    target: null, cd: 0, attackT: 0,
    ward: 0, wardUntil: 0, dazzleUntil: 0, hasteUntil: 0, rallyUntil: 0,
    moving: false, path: null, dest: null, repathTick: 0,
    hero: def.cls === 'hero', commander: def.cls === 'commander',
    ...extra,
  });
}

export function isAlive(e) { return !!e && ((e.kind === 'unit' && e.hp > 0 && !e.downed) || (e.kind === 'settler' && e.hp > 0) || (e.kind === 'building' && e.state !== 'destroyed')); }

/** Effective reach from a unit to a target, accounting for building footprints. */
export function reachDistance(u, t) {
  const d = Math.hypot(t.x - u.x, t.z - u.z);
  return t.kind === 'building' ? Math.max(0, d - BUILDINGS[t.type].radius * 0.85) : d;
}

export function unitSpeed(world, u) {
  const def = UNITS[u.type];
  let s = def.speed;
  if (u.hasteUntil > world.tick) s *= 1.2;
  if (u.retreating) s *= 1.1;
  return s;
}

export function createUnitsModule() {
  let ctx = null;
  const unsub = [];
  const buf = [];

  function ownUnits(world, ids, owner) {
    if (!Array.isArray(ids)) return [];
    const out = [];
    for (const id of ids.slice(0, 200)) {
      const u = world.entities[id];
      if (u && u.kind === 'unit' && u.owner === owner && !u.downed) out.push(u);
    }
    return out;
  }

  function giveMoveLike(world, units, type, x, z) {
    // centroid for formation facing
    let cx = 0, cz = 0;
    for (const u of units) { cx += u.x; cz += u.z; }
    cx /= units.length; cz /= units.length;
    // melee/defensive in front rows, ranged behind, hero in the middle
    const rank = (u) => ({ defensive: 0, melee: 1, hero: 2, commander: 2, ranged: 3 }[UNITS[u.type].cls] ?? 1);
    const sorted = [...units].sort((a, b) => rank(a) - rank(b) || a.id - b.id);
    const slots = units.length === 1 ? [[x, z]] : formationSlots(sorted.length, x, z, cx, cz);
    const nav = ctx.services.nav;
    sorted.forEach((u, i) => {
      let [sx, sz] = slots[i];
      if (!nav.walkable(sx, sz)) { const p = nav.nearestWalkablePoint(sx, sz, 4); if (p) { sx = p.x; sz = p.z; } }
      u.order = { type, x: sx, z: sz, ax: u.x, az: u.z, bx: sx, bz: sz, leg: 1 };
      u.target = null;
      u.retreating = false;
      stopWalking(u);
    });
  }

  function onCommand(cmd) {
    const world = ctx.world;
    const owner = cmd.owner || PLAYER;
    switch (cmd.type) {
      case 'move': case 'attackMove': case 'patrol': {
        const units = ownUnits(world, cmd.ids, owner);
        const x = Number(cmd.x), z = Number(cmd.z);
        if (!units.length || !Number.isFinite(x) || !Number.isFinite(z)) return;
        giveMoveLike(world, units, cmd.type, x, z);
        emit(world, EV.UNIT_ORDER, { ids: units.map((u) => u.id), order: cmd.type, x, z, owner });
        break;
      }
      case 'attack': {
        const units = ownUnits(world, cmd.ids, owner);
        const t = world.entities[cmd.target];
        if (!units.length || !t || t.owner === owner || !isAlive(t)) return;
        for (const u of units) { u.order = { type: 'attack', target: t.id, ax: u.x, az: u.z }; u.target = t.id; u.retreating = false; stopWalking(u); }
        emit(world, EV.UNIT_ORDER, { ids: units.map((u) => u.id), order: 'attack', target: t.id, owner });
        break;
      }
      case 'stop': case 'hold': {
        const units = ownUnits(world, cmd.ids, owner);
        for (const u of units) { u.order = { type: cmd.type === 'hold' ? 'hold' : 'idle', ax: u.x, az: u.z }; u.target = null; stopWalking(u); }
        if (units.length) emit(world, EV.UNIT_ORDER, { ids: units.map((u) => u.id), order: cmd.type, owner });
        break;
      }
      case 'recruit': {
        const b = world.entities[cmd.building];
        const reject = (reason) => emit(world, EV.COMMAND_REJECTED, { type: 'recruit', reason });
        if (!b || b.kind !== 'building' || b.type !== 'barracks' || b.owner !== owner || b.state !== 'active') return reject('Needs a finished Barracks');
        if (!RECRUITABLE.includes(cmd.unitType)) return reject('Unknown unit');
        if (b.queue.length >= MAX_QUEUE) return reject('Training queue is full');
        if (!pay(world, owner, UNITS[cmd.unitType].cost, `recruit ${cmd.unitType}`)) return reject('Not enough resources');
        b.queue.push({ unitType: cmd.unitType, settlerId: null, training: false, progress: 0 });
        break;
      }
      case 'cancelRecruit': {
        const b = world.entities[cmd.building];
        if (!b || b.owner !== owner || !b.queue || !b.queue.length) return;
        const idx = Math.max(0, Math.min(b.queue.length - 1, cmd.index | 0));
        const q = b.queue[idx];
        if (q.training) return; // the settler has already entered the barracks
        if (q.settlerId && world.entities[q.settlerId]) { world.entities[q.settlerId].enlisting = null; stopWalking(world.entities[q.settlerId]); }
        refund(world, owner, UNITS[q.unitType].cost, 1, 'cancel recruit');
        b.queue.splice(idx, 1);
        break;
      }
      case 'rally': {
        const b = world.entities[cmd.building];
        if (b && b.owner === owner && b.kind === 'building') { b.rally = [Number(cmd.x), Number(cmd.z)]; }
        break;
      }
      default: break;
    }
  }

  function updateRecruitment(world) {
    const nav = ctx.services.nav;
    for (const b of all(world, 'building')) {
      if (b.type !== 'barracks' || b.state !== 'active' || !b.queue.length) {
        if (b.type === 'barracks' && b.stall === 'noSettler' && !b.queue.length) b.stall = null;
        continue;
      }
      const q = b.queue[0];
      const door = doorOf(b);
      if (!q.training) {
        let s = q.settlerId ? world.entities[q.settlerId] : null;
        if (!s) {
          q.settlerId = null;
          let best = null, bestD = Infinity;
          for (const c of all(world, 'settler')) {
            if (c.owner !== b.owner || !isIdleLabourer(c) || c.leaving || c.enlisting) continue;
            const d = (c.x - b.x) ** 2 + (c.z - b.z) ** 2;
            if (d < bestD) { bestD = d; best = c; }
          }
          if (!best) { if (b.stall !== 'noSettler') { b.stall = 'noSettler'; emit(world, EV.PRODUCTION_STALLED, { id: b.id, reason: 'noSettler' }); } continue; }
          if (b.stall === 'noSettler') b.stall = null;
          best.enlisting = b.id;
          best.task = null;
          stopWalking(best);
          q.settlerId = best.id;
          s = best;
        }
        const r = walkTo(nav, s, door.x, door.z, 3.6, DT, 1.0);
        s.anim = r === 'walking' ? 'walk' : 'idle';
        if (r === 'arrived' || r === 'fail') {
          q.training = true;
          remove(world, s.id, 'enlisted');
          q.settlerId = null;
        }
      } else {
        q.progress += DT / UNITS[q.unitType].trainTime;
        if (q.progress >= 1) {
          b.queue.shift();
          const u = spawnUnit(world, q.unitType, b.owner, door.x, door.z);
          if (u) {
            const rally = b.rally || [door.x + Math.sin(b.rot || 0) * 6, door.z + Math.cos(b.rot || 0) * 6];
            u.order = { type: 'move', x: rally[0] + ((u.id % 5) - 2) * 1.6, z: rally[1] + (Math.floor(u.id / 5) % 3) * 1.6, ax: rally[0], az: rally[1] };
            world.stats.unitsRecruited++;
            emit(world, EV.UNIT_RECRUITED, { id: u.id, type: u.type, owner: u.owner });
          }
        }
      }
    }
  }

  /** Move toward (x,z): straight line when clear, otherwise a budgeted path. */
  function moveToward(world, u, x, z, arrive) {
    const nav = ctx.services.nav;
    const dx = x - u.x, dz = z - u.z;
    const d = Math.hypot(dx, dz);
    if (d <= arrive) { u.moving = false; u.path = null; return true; }
    const speed = unitSpeed(world, u);
    if (d < 40 && nav.grid().lineWalkable(u.x, u.z, x, z)) {
      const step = Math.min(d - arrive * 0.5, speed * DT);
      u.x += (dx / d) * step; u.z += (dz / d) * step;
      u.heading = Math.atan2(dx, dz);
      u.moving = true; u.path = null;
      return false;
    }
    const destMoved = !u.dest || Math.hypot(u.dest[0] - x, u.dest[1] - z) > 2.5;
    if ((!u.path && world.tick >= u.repathTick) || (destMoved && world.tick >= u.repathTick)) {
      const r = nav.requestPath(u, x, z);
      if (r === 'ok') { u.dest = [x, z]; u.repathTick = world.tick + 20; }
      else if (r === 'fail') { u.repathTick = world.tick + 40; u.moving = false; return false; }
      else { u.moving = false; return false; }
    }
    if (u.path) {
      followPath(u, speed, DT);
      u.moving = true;
    } else u.moving = false;
    return false;
  }

  function updateUnit(world, u) {
    const o = u.order;
    const def = UNITS[u.type];
    let t = u.target != null ? world.entities[u.target] : null;
    if (t && !isAlive(t)) { u.target = null; t = null; }
    if (o.type === 'attack' && !t) { u.order = { type: 'idle', ax: u.x, az: u.z }; }
    // attack windup/animation is handled in combat; here we only move
    if (o.type === 'move') {
      u.target = null;
      if (moveToward(world, u, o.x, o.z, 0.4)) { u.order = { type: 'idle', ax: o.x, az: o.z }; }
      return;
    }
    if (t) {
      // leash back to anchor for defensive stances
      if ((o.type === 'idle' || o.type === 'patrol' || o.type === 'guard') && Math.hypot(u.x - o.ax, u.z - o.az) > (o.leash || LEASH)) {
        u.target = null;
        u.returning = true;
      } else {
        const reach = reachDistance(u, t);
        // ranged units step back from melee attackers (they can outpace slow shield lines)
        if (def.cls === 'ranged' && o.type !== 'hold' && kite(world, u)) return;
        if (reach > def.range * 0.95) {
          if (o.type === 'hold') { u.target = null; u.moving = false; return; }
          if (t.kind === 'building') moveToward(world, u, t.x, t.z, BUILDINGS[t.type].radius * 0.8 + def.range * 0.6);
          else if (def.cls !== 'ranged' && reach < 6 && UNITS[t.type] && UNITS[t.type].cls !== 'ranged' && !t.moving) {
            // close in on a personal slot around the target so melee fights spread into a ring
            const a = (u.id * 2.399) % (Math.PI * 2);
            const r = def.range * 0.75;
            moveToward(world, u, t.x + Math.sin(a) * r, t.z + Math.cos(a) * r, 0.3);
          } else moveToward(world, u, t.x, t.z, def.range * 0.8);
        } else {
          u.moving = false; u.path = null;
          u.heading = Math.atan2(t.x - u.x, t.z - u.z);
        }
        return;
      }
    }
    switch (u.order.type) {
      case 'attackMove':
        if (moveToward(world, u, o.x, o.z, 0.6)) u.order = { type: 'idle', ax: o.x, az: o.z };
        break;
      case 'patrol': {
        const tx = o.leg ? o.bx : o.ax, tz = o.leg ? o.bz : o.az;
        if (moveToward(world, u, tx, tz, 0.8)) o.leg = o.leg ? 0 : 1;
        break;
      }
      case 'idle': case 'guard': {
        const d = Math.hypot(u.x - o.ax, u.z - o.az);
        if (u.returning || d > 3) {
          if (moveToward(world, u, o.ax, o.az, 1.2)) u.returning = false;
        } else u.moving = false;
        break;
      }
      default:
        u.moving = false;
    }
  }

  const threatBuf = [];
  function kite(world, u) {
    const spatial = ctx.services.spatial;
    if (!spatial) return false;
    spatial.query(u.x, u.z, 3.4, threatBuf, (e) => e.kind === 'unit' && e.owner !== u.owner && !e.downed && UNITS[e.type].cls !== 'ranged');
    if (!threatBuf.length) return false;
    let dx = 0, dz = 0;
    for (const e of threatBuf) { const d = Math.hypot(u.x - e.x, u.z - e.z) || 0.1; dx += (u.x - e.x) / d; dz += (u.z - e.z) / d; }
    const len = Math.hypot(dx, dz) || 1;
    const step = unitSpeed(world, u) * 0.78 * DT; // backpedalling: slower than melee runners, about as fast as shield lines
    const nx = u.x + (dx / len) * step, nz = u.z + (dz / len) * step;
    if (!ctx.services.nav.walkable(nx, nz)) return false;
    u.x = nx; u.z = nz; u.moving = true; u.path = null;
    return true;
  }

  function separate(world) {
    const spatial = ctx.services.spatial;
    const nav = ctx.services.nav;
    if (!spatial) return;
    for (const u of all(world, 'unit')) {
      if (u.downed) continue;
      // allies keep a full body width apart; foes only a minimum distance (1.1 m, inside weapon reach)
      spatial.query(u.x, u.z, SEP_RADIUS * 2, buf, (e) => e.kind === 'unit' && e !== u && !e.downed);
      let px = 0, pz = 0;
      for (const o of buf) {
        let dx = u.x - o.x, dz = u.z - o.z;
        let d = Math.hypot(dx, dz);
        if (d < 1e-4) { dx = ((u.id * 7) % 11) - 5; dz = ((u.id * 13) % 11) - 5; d = Math.hypot(dx, dz) || 1; }
        const overlap = (o.owner === u.owner ? SEP_RADIUS * 2 : FOE_MIN_DIST) - d;
        if (overlap > 0) { px += (dx / d) * overlap * 0.35; pz += (dz / d) * overlap * 0.35; }
      }
      if (px || pz) {
        const nx = u.x + px, nz = u.z + pz;
        if (nav.walkable(nx, nz)) { u.x = nx; u.z = nz; }
      }
    }
  }

  return {
    id: 'units',
    kind: 'sim',
    init(c) { ctx = c; unsub.push(c.bus.on('command', onCommand)); },
    update() {
      const world = ctx.world;
      updateRecruitment(world);
      for (const u of all(world, 'unit')) {
        u.px = u.x; u.pz = u.z;
        if (u.downed) continue;
        updateUnit(world, u);
      }
      if (world.tick % 2 === 0) separate(world);
    },
    dispose() { unsub.forEach((f) => f()); unsub.length = 0; },
  };
}

