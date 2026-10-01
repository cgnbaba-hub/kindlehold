// Construction: placement validity, sites, progress, completion, cancel/refund,
// demolition and repair bookkeeping. Labourers perform the physical work (economy).
import { EV, PLAYER, DT } from '../core/contracts.js';
import { spawn, remove, all, emit, alert } from '../world/world.js';
import { BUILDINGS, UPGRADES, buildingDef, nextUpgrade, levelOf, displayName } from '../buildings/defs.js';
import { stabilityFactor } from '../population/index.js';
import { territorySources, territoryOwner } from '../world/territory.js';
import { pay, refund, addRes } from '../economy/stock.js';
import { TECH_EFFECTS, hasTech } from '../technology/defs.js';

export const MAX_BUILDERS = 3;
export const CANCEL_REFUND_STARTED = 0.5;
export const DEMOLISH_REFUND = 0.3;

/** Effective cost (tech discounts applied). */
export function buildCost(world, owner, type) {
  const def = buildingDef(type);
  const cost = { ...def.cost };
  if (type === 'cottage' && hasTech(world, owner, 'bracing')) cost.timber = Math.max(0, cost.timber - TECH_EFFECTS.cottageTimberDiscount);
  return cost;
}

/**
 * Placement validity shared by the simulation and the UI preview.
 * @returns {{ok:boolean, reason?:string, deposit?:number}}
 */
export function checkPlacement(world, services, owner, type, x, z, ignoreId = null) {
  const def = BUILDINGS[type];
  if (!def) return { ok: false, reason: 'Unknown building' };
  if (!def.buildable && owner === PLAYER) return { ok: false, reason: 'Cannot be built' };
  if (def.requiresTech && !hasTech(world, owner, def.requiresTech)) return { ok: false, reason: 'Requires the March Charter' };
  const t = services.terrain;
  if (!t.inBounds(x, z, def.radius + 6)) return { ok: false, reason: 'Too close to the edge of the map' };
  // terrain: samples across the footprint
  let minH = Infinity, maxH = -Infinity;
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    for (const rr of [0, def.radius * 0.6, def.radius]) {
      const sx = x + Math.cos(ang) * rr, sz = z + Math.sin(ang) * rr;
      if (t.waterDepth(sx, sz) > 0.01) return { ok: false, reason: 'Cannot build on water' };
      const h = t.height(sx, sz);
      minH = Math.min(minH, h); maxH = Math.max(maxH, h);
    }
  }
  if ((maxH - minH) / (def.radius * 2) > 0.35) return { ok: false, reason: 'Ground is too steep' };
  if (services.nav && services.nav.grid().isStaticBlocked(x, z)) return { ok: false, reason: 'Ground is impassable' };
  // territory
  const src = territorySources(world);
  if (territoryOwner(world, x, z, src) !== owner) return { ok: false, reason: 'Outside your territory' };
  // collisions with buildings and deposits
  for (const b of all(world, 'building')) {
    if (b.state === 'destroyed' || b.id === ignoreId) continue;
    const r = BUILDINGS[b.type].radius + def.radius + 1.2;
    if ((b.x - x) ** 2 + (b.z - z) ** 2 < r * r) return { ok: false, reason: `Too close to ${BUILDINGS[b.type].name}` };
  }
  let depositId = null;
  let nearest = Infinity;
  for (const d of all(world, 'deposit')) {
    if (d.amount <= 0) continue;
    const dd = Math.hypot(d.x - x, d.z - z);
    const clear = def.radius + (d.type === 'tree' ? 0.8 : d.type === 'rock' ? 2.6 : 2.2);
    if (dd < clear) return { ok: false, reason: d.type === 'tree' ? 'Trees are in the way' : 'Rocks are in the way' };
    if (def.deposit && d.type === def.deposit && dd <= def.depositRange && dd < nearest) { nearest = dd; depositId = d.id; }
  }
  if (def.waterRange && !services.terrain.nearestWater(x, z, def.waterRange)) return { ok: false, reason: `Needs open water within ${def.waterRange} m` };
  if (def.deposit && depositId == null) {
    const what = { tree: 'trees', rock: 'a rock outcrop', iron: 'an iron vein', salt: 'a salt pan' }[def.deposit];
    return { ok: false, reason: `Needs ${what} within ${def.depositRange} m` };
  }
  // hostile units nearby
  for (const u of all(world, 'unit')) {
    if (u.owner !== owner && u.owner !== 'none' && !u.downed && (u.x - x) ** 2 + (u.z - z) ** 2 < 36) return { ok: false, reason: 'Enemies are too close' };
  }
  return { ok: true, deposit: depositId };
}

export function createBuildingEntity(world, { type, owner, x, z, rot = 0, state = 'site' }) {
  const def = buildingDef(type);
  const cost = state === 'site' ? buildCost(world, owner, type) : {};
  return spawn(world, {
    kind: 'building', type, owner, x, z, rot,
    state, // 'site' | 'active' | 'destroyed'
    hp: state === 'site' ? Math.round(def.hp * 0.2) : def.hp, maxHp: def.hp,
    build: state === 'site' ? { progress: 0, required: cost, supplied: {}, incoming: {}, builders: [] } : null,
    workers: [],
    stock: { out: {}, in: {}, outReserved: 0, inIncoming: {} },
    stall: null,
    lit: type !== 'keep',
    queue: [],
    paused: false,
    plots: null,
    lastHitTick: -9999,
    destroyedTick: null,
    cooldown: 0,
  });
}

function supplyFraction(b) {
  const req = b.build.required;
  let need = 0, have = 0;
  for (const r in req) { need += req[r]; have += Math.min(req[r], b.build.supplied[r] || 0); }
  return need === 0 ? 1 : have / need;
}

export function siteNeeds(b) {
  const out = {};
  const req = b.build.required;
  for (const r in req) {
    const missing = req[r] - (b.build.supplied[r] || 0) - (b.build.incoming[r] || 0);
    if (missing > 0) out[r] = missing;
  }
  return out;
}

/** Called by a builder each tick of work. */
export function applyBuildWork(world, b, amountSeconds) {
  if (b.state !== 'site') return;
  const def = BUILDINGS[b.type];
  const speed = hasTech(world, b.owner, 'bracing') ? TECH_EFFECTS.buildSpeed : 1;
  const cap = supplyFraction(b);
  const before = b.build.progress;
  b.build.progress = Math.min(cap, b.build.progress + (amountSeconds * speed) / def.buildTime);
  b.hp = Math.max(b.hp, Math.round(def.hp * (0.2 + 0.8 * b.build.progress)));
  if (Math.floor(before * 10) !== Math.floor(b.build.progress * 10)) emit(world, EV.CONSTRUCTION_PROGRESS, { id: b.id, progress: b.build.progress });
  if (b.build.progress >= 1) completeBuilding(world, b);
}

export function completeBuilding(world, b) {
  const def = BUILDINGS[b.type];
  b.state = 'active';
  b.hp = def.hp;
  b.build = null;
  if (b.type === 'farm') {
    b.plots = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const ang = (b.rot || 0) + Math.PI / n + (i / n) * Math.PI * 2;
      b.plots.push({ x: b.x + Math.sin(ang) * 9.5, z: b.z + Math.cos(ang) * 9.5, growth: 0, state: 'fallow' });
    }
  }
  // a moved building comes back at the level it had
  if (b.movedLevel > 1) {
    for (let l = 2; l <= b.movedLevel; l++) { const up = UPGRADES[b.type] && UPGRADES[b.type][l]; if (up && up.hp) b.maxHp += up.hp; }
    b.level = b.movedLevel; b.hp = b.maxHp;
  }
  delete b.movedLevel;
  if (b.owner === PLAYER) world.stats.buildingsBuilt++;
  emit(world, EV.BUILDING_COMPLETED, { id: b.id, type: b.type, owner: b.owner });
}

/** Buildings that can be moved (the Keep stays where it was founded). */
export function canMove(b) { return !!b && b.kind === 'building' && b.state === 'active' && b.type !== 'keep' && !!BUILDINGS[b.type].buildable; }

export function releaseWorkers(world, b) {
  for (const wid of b.workers) {
    const s = world.entities[wid];
    if (!s) continue;
    // let go of the tree, rock, deer or field they were working on
    const t = s.task;
    for (const id of t ? [t.deposit, t.prey] : []) { const e = id != null && world.entities[id]; if (e && e.reservedBy === s.id) e.reservedBy = null; }
    if (t && t.plot != null && b.plots && b.plots[t.plot] && b.plots[t.plot].tender === s.id) b.plots[t.plot].tender = undefined;
    s.job = null; s.workplace = null; s.task = null; s.carry = null;
  }
  b.workers = [];
}

export function clearFootprint(world, b) {
  emit(world, 'building:footprint-cleared', { id: b.id, x: b.x, z: b.z, type: b.type });
}

/** Building reached 0 HP. */
export function destroyBuilding(world, b, byOwner = null) {
  if (b.state === 'destroyed') return;
  releaseWorkers(world, b);
  b.state = 'destroyed';
  b.hp = 0;
  b.destroyedTick = world.tick;
  b.queue = [];
  clearFootprint(world, b);
  const p = world.players[b.owner];
  if (p && p.burnPenalty !== undefined) p.burnPenalty = Math.min(40, p.burnPenalty + 12);
  emit(world, EV.BUILDING_DESTROYED, { id: b.id, type: b.type, owner: b.owner, x: b.x, z: b.z, by: byOwner });
  if (b.owner === PLAYER) alert(world, 'danger', `${BUILDINGS[b.type].name} was destroyed!`, b.x, b.z);
}

export function createConstructionModule() {
  let ctx = null;
  const unsub = [];

  function reject(reason, cmd) { emit(ctx.world, EV.COMMAND_REJECTED, { type: cmd.type, reason }); }

  function onCommand(cmd) {
    const world = ctx.world;
    const owner = cmd.owner || PLAYER;
    if (cmd.type === 'place') {
      const def = BUILDINGS[cmd.buildingType];
      if (!def) return reject('Unknown building', cmd);
      const x = Number(cmd.x), z = Number(cmd.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return reject('Invalid position', cmd);
      const chk = checkPlacement(world, ctx.services, owner, def.id, x, z);
      if (!chk.ok) return reject(chk.reason, cmd);
      const cost = buildCost(world, owner, def.id);
      if (!pay(world, owner, cost, `build ${def.id}`)) return reject('Not enough resources', cmd);
      const rot = Number.isFinite(Number(cmd.rot)) ? Number(cmd.rot) : 0;
      const b = createBuildingEntity(world, { type: def.id, owner, x, z, rot });
      if (!b) { refund(world, owner, cost); return reject('Too many entities', cmd); }
      emit(world, EV.BUILDING_PLACED, { id: b.id, type: b.type, owner });
    } else if (cmd.type === 'cancel') {
      const b = world.entities[cmd.id];
      if (!b || b.kind !== 'building' || b.owner !== owner || b.state !== 'site') return reject('Nothing to cancel', cmd);
      // undelivered goods return fully; delivered goods at 50% once work has started
      const started = b.build.progress > 0;
      const refundCost = {};
      for (const r in b.build.required) {
        const supplied = b.build.supplied[r] || 0;
        const undelivered = b.build.required[r] - supplied;
        refundCost[r] = undelivered + (started ? Math.floor(supplied * CANCEL_REFUND_STARTED) : supplied);
      }
      refund(world, owner, refundCost, 1, 'cancel');
      clearFootprint(world, b);
      remove(world, b.id, 'cancelled');
    } else if (cmd.type === 'demolish') {
      const b = world.entities[cmd.id];
      if (!b || b.kind !== 'building' || b.owner !== owner || b.state !== 'active' || b.type === 'keep') return reject('Cannot demolish this', cmd);
      releaseWorkers(world, b);
      refund(world, owner, buildCost(world, owner, b.type), DEMOLISH_REFUND, 'demolish');
      clearFootprint(world, b);
      emit(world, 'building:demolished', { id: b.id, type: b.type, x: b.x, z: b.z });
      remove(world, b.id, 'demolished');
    } else if (cmd.type === 'relocate') {
      // take the building down and put it up again elsewhere: the materials come along
      // (all delivered at once), only the building time is spent again; the level is kept
      const b = world.entities[cmd.id];
      if (!canMove(b) || b.owner !== owner) return reject('This building cannot be moved', cmd);
      if (b.upgrade) return reject('Wait until the upgrade is finished', cmd);
      const x = Number(cmd.x), z = Number(cmd.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return reject('Invalid position', cmd);
      if (Math.hypot(x - b.x, z - b.z) < 1) return reject('That is where it stands', cmd);
      const chk = checkPlacement(world, ctx.services, owner, b.type, x, z, b.id);
      if (!chk.ok) return reject(chk.reason, cmd);
      const rot = Number.isFinite(Number(cmd.rot)) ? Number(cmd.rot) : (b.rot || 0);
      const site = createBuildingEntity(world, { type: b.type, owner, x, z, rot });
      if (!site) return reject('Too many entities', cmd);
      site.build.supplied = { ...site.build.required };
      if (levelOf(b) > 1) site.movedLevel = levelOf(b);
      if (b.paused) site.paused = true;
      // goods waiting in the old building go to the store
      for (const r in b.stock.out) if (b.stock.out[r] > 0) addRes(world, owner, r, b.stock.out[r], 'move');
      for (const r in b.stock.in) if (b.stock.in[r] > 0) addRes(world, owner, r, b.stock.in[r], 'move');
      releaseWorkers(world, b);
      clearFootprint(world, b);
      emit(world, 'building:moved', { from: b.id, to: site.id, type: b.type, x, z });
      remove(world, b.id, 'moved');
      if (world.selection.ids.length === 0) world.selection.ids.push(site.id);
    } else if (cmd.type === 'toggleWork') {
      const b = world.entities[cmd.id];
      if (!b || b.kind !== 'building' || b.owner !== owner || b.state !== 'active' || !BUILDINGS[b.type].slots) return reject('This building has no workers', cmd);
      b.paused = !b.paused;
      if (b.paused) { releaseWorkers(world, b); b.stall = 'paused'; } else if (b.stall === 'paused') b.stall = null;
      emit(world, 'building:paused', { id: b.id, paused: b.paused });
    } else if (cmd.type === 'upgrade') {
      const b = world.entities[cmd.id];
      if (!b || b.kind !== 'building' || b.owner !== owner || b.state !== 'active') return reject('Nothing to upgrade', cmd);
      if (b.upgrade) return reject('Already being upgraded', cmd);
      const up = nextUpgrade(b);
      if (!up) return reject('Already at the highest level', cmd);
      const why = upgradeBlocker(world, owner, b);
      if (why) return reject(why, cmd);
      if (!pay(world, owner, up.cost, `upgrade ${b.type}`)) return reject('Not enough resources', cmd);
      b.upgrade = { progress: 0 };
      emit(world, 'building:upgrade-started', { id: b.id, type: b.type, level: levelOf(b) + 1 });
    } else if (cmd.type === 'rekindle') {
      const keep = all(world, 'building').find((b) => b.type === 'keep' && b.owner === owner);
      if (!keep || keep.lit) return;
      keep.lit = true;
      world.mission.flags.keepLit = true;
      emit(world, 'keep:rekindled', { id: keep.id });
    }
  }

  return {
    id: 'construction',
    kind: 'sim',
    init(c) {
      ctx = c;
      unsub.push(c.bus.on('command', onCommand));
    },
    update() {
      const world = ctx.world;
      // upgrades progress on their own (masons from the Keep); faster with Braced Timber
      for (const b of all(world, 'building')) {
        if (!b.upgrade) continue;
        if (b.state !== 'active') { b.upgrade = null; continue; }
        const up = nextUpgrade(b);
        if (!up) { b.upgrade = null; continue; }
        const speed = (hasTech(world, b.owner, 'bracing') ? TECH_EFFECTS.buildSpeed : 1) * stabilityFactor(world, b.owner);
        b.upgrade.progress = Math.min(1, b.upgrade.progress + (DT * speed) / up.time);
        if (b.upgrade.progress >= 1) {
          b.level = levelOf(b) + 1;
          b.upgrade = null;
          if (up.hp) { b.maxHp += up.hp; b.hp = Math.min(b.maxHp, b.hp + up.hp); }
          emit(world, 'building:upgraded', { id: b.id, type: b.type, level: b.level, owner: b.owner, x: b.x, z: b.z });
          if (b.owner === PLAYER) alert(world, 'success', `${displayName(b)} completed.`, b.x, b.z);
        }
      }
      // rubble clean-up 30 s after destruction
      for (const b of all(world, 'building')) {
        if (b.state === 'destroyed' && world.tick - b.destroyedTick > 600) remove(world, b.id, 'rubble-cleared');
      }
    },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
  };
}

/** Why a building cannot be upgraded right now (null when it can, cost aside). */
export function upgradeBlocker(world, owner, b) {
  const up = nextUpgrade(b);
  if (!up) return 'Already at the highest level';
  if (up.requiresTech && !hasTech(world, owner, up.requiresTech)) return 'Requires the March Charter';
  if (up.requiresKeep) {
    const keep = all(world, 'building').find((k) => k.type === 'keep' && k.owner === owner);
    if (!keep || levelOf(keep) < up.requiresKeep) return 'Requires the Castle (upgrade the Keep)';
  }
  return null;
}
