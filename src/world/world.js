// The single serializable world object plus entity helpers.
// Authoritative state lives here; derived indices live in a WeakMap side-table.
import { SCHEMA_VERSION, ENTITY_CAP, EV, RESOURCES } from '../core/contracts.js';
import { createRng } from '../core/rng.js';
import { log } from '../core/logger.js';

const derived = new WeakMap();

function getDerived(world) {
  let d = derived.get(world);
  if (!d) { d = { byKind: Object.create(null), dirty: true, version: 0, count: null, rng: null, bus: null }; derived.set(world, d); }
  return d;
}

export function emptyStock() {
  const s = {};
  for (const r of RESOURCES) s[r] = 0;
  return s;
}

/**
 * @returns {import('../core/contracts.js').World}
 */
export function createWorld({ seed = 1337, scenarioId = 'harrowmere', title = 'The Rekindling of Harrowmere', difficulty = 'normal' } = {}) {
  const rng = createRng(seed);
  const world = {
    schemaVersion: SCHEMA_VERSION,
    meta: { seed, scenarioId, title, difficulty },
    tick: 0,
    rng: rng.getState(),
    nextId: 1,
    time: { hour: 7.5, dayLengthTicks: 24000, running: true },
    weather: { kind: 'clear', intensity: 0 },
    players: {},
    entities: {},
    mission: { phase: 0, objectives: [], triggers: {}, flags: {}, timers: {}, messages: [], result: null, endedTick: null },
    ai: { state: 'build', wave: 0, nextSpawnTick: 0, raidTick: null, raidIds: [], scoutId: null, nextScoutTick: 0, raidStartStrength: 0, retreating: false, nextWaveTick: null },
    combat: { pending: [] },
    selection: { ids: [], groups: {} },
    stats: { produced: emptyStock(), consumed: emptyStock(), settlersArrived: 0, unitsRecruited: 0, enemiesDefeated: 0, unitsLost: 0, buildingsBuilt: 0 },
  };
  const d = getDerived(world);
  d.rng = rng;
  return world;
}

export function addPlayer(world, { id, name, faction, color, res, stability = 60, ai = false }) {
  world.players[id] = {
    id, name, faction, color, ai,
    res: { ...emptyStock(), ...res },
    techs: {},
    research: null,
    stability,
    popCap: 0,
    pop: 0,
    lastMealFed: 1,
    nextMealTick: 1200,
    nextSettlerTick: 200,
    burnPenalty: 0,
  };
  return world.players[id];
}

/** The world's RNG (restored from world.rng after load). */
export function worldRng(world) {
  const d = getDerived(world);
  if (!d.rng) { d.rng = createRng(world.meta.seed); d.rng.setState(world.rng); }
  return d.rng;
}

export function syncRngState(world) {
  const d = getDerived(world);
  if (d.rng) world.rng = d.rng.getState();
}

export function attachBus(world, bus) { getDerived(world).bus = bus; }
export function worldBus(world) { return getDerived(world).bus; }

export function entityCount(world) {
  let n = 0;
  for (const _ in world.entities) n++; // eslint-disable-line no-unused-vars
  return n;
}

/** Spawn an entity. Returns the entity or null when the entity cap is reached. */
export function spawn(world, props) {
  const d = getDerived(world);
  if (d.count == null) d.count = entityCount(world);
  if (d.count >= ENTITY_CAP) {
    log.warn('world', `entity cap ${ENTITY_CAP} reached; spawn of ${props.kind} refused`);
    return null;
  }
  const id = world.nextId++;
  const e = { id, owner: 'none', x: 0, z: 0, ...props };
  e.px = e.x; e.pz = e.z;
  world.entities[id] = e;
  d.count++;
  d.dirty = true;
  d.version++;
  if (d.bus) d.bus.emit(EV.ENTITY_SPAWNED, { id, kind: e.kind, type: e.type });
  return e;
}

export function remove(world, id, reason = 'removed') {
  const e = world.entities[id];
  if (!e) return;
  delete world.entities[id];
  const d = getDerived(world);
  if (d.count != null) d.count--;
  d.dirty = true;
  d.version++;
  const sel = world.selection.ids.indexOf(id);
  if (sel >= 0) world.selection.ids.splice(sel, 1);
  for (const g in world.selection.groups) {
    const arr = world.selection.groups[g];
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
  }
  if (d.bus) d.bus.emit(EV.ENTITY_REMOVED, { id, kind: e.kind, type: e.type, reason });
}

export function get(world, id) { return id == null ? null : world.entities[id] || null; }

function rebuild(world) {
  const d = getDerived(world);
  const byKind = Object.create(null);
  for (const id in world.entities) { // integer keys iterate in ascending order
    const e = world.entities[id];
    (byKind[e.kind] || (byKind[e.kind] = [])).push(e);
  }
  d.byKind = byKind;
  d.dirty = false;
}

const EMPTY = Object.freeze([]);
/** Entities of a kind in ascending id order. Do not mutate the returned array. */
export function all(world, kind) {
  const d = getDerived(world);
  if (d.dirty) rebuild(world);
  return d.byKind[kind] || EMPTY;
}

/** Monotonic version that changes whenever entities are added or removed. */
export function structureVersion(world) { return getDerived(world).version; }

export function markDirty(world) { const d = getDerived(world); d.dirty = true; d.count = null; d.version++; }

export function buildingsOf(world, owner, type = null, activeOnly = false) {
  const out = [];
  for (const b of all(world, 'building')) {
    if (b.owner !== owner) continue;
    if (type && b.type !== type) continue;
    if (activeOnly && b.state !== 'active') continue;
    out.push(b);
  }
  return out;
}

export function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }

export function emit(world, name, payload) {
  const bus = getDerived(world).bus;
  if (bus) bus.emit(name, payload);
}

export function alert(world, level, text, x, z, owner = 'p1') {
  emit(world, EV.ALERT, { level, text, x, z, owner, tick: world.tick });
}
