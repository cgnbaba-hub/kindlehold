// Save games: serialization, validation of untrusted save data, schema migrations.
// The world object is the save boundary; derived data is rebuilt on load.
import { SCHEMA_VERSION, MAX_SAVE_BYTES, ENTITY_CAP, RESOURCES } from '../core/contracts.js';
import { safeParse, assertNoDangerousKeys, ValidationError, v, validate } from '../core/validate.js';
import { markDirty, syncRngState } from '../world/world.js';
import { MIGRATIONS } from './migrations.js';
import { BUILDINGS } from '../buildings/defs.js';
import { UNITS } from '../units/defs.js';
import { TECHS } from '../technology/defs.js';
import { HARROWMERE_SCENARIO } from '../missions/scenarios/harrowmere.js';
import { GREYFEN_SCENARIO, TOLLBREAKER_SCENARIO } from '../missions/scenarios/campaign.js';
import { SALTROAD_SCENARIO } from '../missions/scenarios/saltroad.js';
import { WHITESTAG_SCENARIO } from '../missions/scenarios/whitestag.js';
import { IRONDEBT_SCENARIO } from '../missions/scenarios/irondebt.js';
import { FREE_SCENARIOS } from '../missions/scenarios/freeplay.js';

export const SAVE_FORMAT = 'kindlehold-save';

const ENTITY_KINDS = ['building', 'settler', 'unit', 'deposit', 'animal', 'poi'];

const num = v.number();
const stockSchema = v.object(Object.fromEntries(RESOURCES.map((r) => [r, v.number({ min: 0, max: 1e7 })])));

const playerSchema = v.object({
  id: v.string({ max: 8 }),
  res: stockSchema,
  techs: v.record(v.boolean(), { max: 32 }),
  stability: v.number({ min: 0, max: 100 }),
});

const coord = v.number({ min: -200, max: 200 });
const nonNeg = (max = 1e6) => v.number({ min: 0, max });
const optNum = (o = {}) => v.optional(v.number(o));
const ids = (max) => v.array(v.number({ min: 1, max: 1e9, int: true }), { max });
const point = v.array(v.number({ min: -300, max: 300 }), { max: 2 });
const path = v.optional(v.array(point, { max: 4000 }));

const KIND_SCHEMAS = {
  building: v.object({
    type: v.string({ oneOf: Object.keys(BUILDINGS) }),
    state: v.string({ oneOf: ['site', 'active', 'destroyed'] }),
    hp: nonNeg(1e5), maxHp: v.number({ min: 1, max: 1e5 }), rot: optNum({ min: -100, max: 100 }),
    workers: ids(16), queue: v.array(v.object({ unitType: v.string({ oneOf: Object.keys(UNITS) }), progress: nonNeg(2) }), { max: 8 }),
    stock: v.object({ out: v.record(nonNeg(1e5), { max: 8 }), in: v.record(nonNeg(1e5), { max: 8 }), outReserved: nonNeg(1e5), inIncoming: v.record(nonNeg(1e5), { max: 8 }) }),
    build: v.optional(v.object({ progress: nonNeg(1), required: v.record(nonNeg(1e5), { max: 8 }), supplied: v.record(nonNeg(1e5), { max: 8 }), incoming: v.record(nonNeg(1e5), { max: 8 }), builders: ids(16) })),
    level: v.optional(v.number({ min: 1, max: 3, int: true })),
    meals: v.optional(nonNeg(1000)),
    upgrade: v.optional(v.object({ progress: nonNeg(1) }, { allowExtra: false })),
    plots: v.optional(v.array(v.object({ x: coord, z: coord, growth: nonNeg(1), state: v.string({ oneOf: ['fallow', 'growing', 'ripe'] }) }), { max: 12 })),
  }),
  unit: v.object({
    type: v.string({ oneOf: Object.keys(UNITS) }),
    hp: v.number({ min: -1e4, max: 1e5 }), maxHp: v.number({ min: 1, max: 1e5 }),
    order: v.object({ type: v.string({ oneOf: ['idle', 'move', 'attack', 'attackMove', 'patrol', 'hold', 'guard'] }) }),
    path, cd: optNum({ min: -1e4, max: 1e6 }),
    xp: optNum({ min: 0, max: 1e5 }), rank: v.optional(v.number({ min: 0, max: 2, int: true })),
  }),
  settler: v.object({
    hp: v.number({ min: -1e4, max: 1e5 }), maxHp: v.number({ min: 1, max: 1e5 }),
    job: v.optional(v.string({ oneOf: ['forester', 'quarrier', 'farmer', 'miner', 'hunter', 'fisher', 'salter', 'cook', 'miller', 'baker', 'smith'] })),
    sleep: v.optional(v.object({ home: v.number({ min: 1, max: 1e9, int: true }), in: v.boolean() }, { allowExtra: false })),
    hidden: v.optional(v.boolean()),
    carry: v.optional(v.object({ res: v.string({ oneOf: RESOURCES }), amt: nonNeg(1000) })),
    order: v.optional(v.object({ type: v.string({ oneOf: ['gather'] }), kind: v.string({ oneOf: ['tree', 'rock'] }), x: coord, z: coord }, { allowExtra: true })),
    path,
  }),
  poi: v.object({ type: v.string({ oneOf: ['trader', 'cairn', 'ruin', 'hamlet'] }), state: v.string({ oneOf: ['hidden', 'found', 'done'] }) }),
  animal: v.object({ type: v.string({ oneOf: ['deer'] }), herd: v.number({ min: 1, max: 64, int: true }), goal: v.optional(point) }),
  deposit: v.object({ type: v.string({ oneOf: ['tree', 'rock', 'iron', 'salt'] }), amount: v.number({ min: -1000, max: 1e5 }), maxAmount: v.number({ min: 1, max: 1e5 }) }),
};

const entitySchema = (x, p) => {
  v.object({
    id: v.number({ min: 1, int: true }),
    kind: v.string({ oneOf: ENTITY_KINDS }),
    x: coord, z: coord, px: optNum({ min: -300, max: 300 }), pz: optNum({ min: -300, max: 300 }),
    owner: v.string({ oneOf: ['p1', 'p2', 'p3', 'none'] }),
  })(x, p);
  KIND_SCHEMAS[x.kind](x, p);
};

const playerFull = v.object({
  id: v.string({ oneOf: ['p1', 'p2', 'p3'] }),
  res: stockSchema,
  techs: v.record(v.boolean(), { max: 16, keyPattern: /^(axes|bracing|blades|charter|mail|drill)$/ }),
  stability: v.number({ min: 0, max: 100 }),
  research: v.optional(v.object({ techId: v.string({ oneOf: Object.keys(TECHS) }), progress: nonNeg(1) })),
  popCap: nonNeg(1e4), pop: nonNeg(1e4), tax: v.optional(v.number({ min: 0, max: 2, int: true })), rations: v.optional(v.number({ min: 0, max: 2, int: true })), autoGather: v.optional(v.boolean()), feastUntil: v.optional(nonNeg(1e10)), nextPayTick: v.optional(nonNeg(1e10)), nextMealTick: nonNeg(1e9), nextSettlerTick: nonNeg(1e9), lastMealFed: nonNeg(1), burnPenalty: nonNeg(1e4),
});

const worldSchema = v.object({
  schemaVersion: v.number({ min: 1, max: SCHEMA_VERSION, int: true }),
  meta: v.object({
    scenarioId: v.string({ oneOf: ['harrowmere', 'greyfen', 'tollbreaker', 'saltroad', 'whitestag', 'irondebt', ...Object.keys(FREE_SCENARIOS)] }), difficulty: v.string({ oneOf: ['story', 'normal', 'hard'] }),
    campaign: v.optional(v.object({ greyfen: v.optional(v.string({ oneOf: ['allied', 'defeated', 'neutral'] })) }, { allowExtra: false })),
  }),
  tick: v.number({ min: 0, max: 1e9, int: true }),
  rng: v.array(v.number({ min: 0, max: 4294967295, int: true }), { max: 4 }),
  nextId: v.number({ min: 1, max: 1e8, int: true }),
  time: v.object({ hour: v.number({ min: 0, max: 24 }), dayLengthTicks: v.number({ min: 100, max: 1e7 }), running: v.boolean() }),
  weather: v.optional(v.object({
    kind: v.string({ oneOf: ['clear', 'snow', 'rain'] }), intensity: nonNeg(1),
    season: v.optional(v.string({ oneOf: ['summer', 'winter'] })), snow: v.optional(nonNeg(1)), frozen: v.optional(v.boolean()),
    wet: v.optional(nonNeg(1)), rained: v.optional(v.boolean()),
  }, { allowExtra: false })),
  herds: v.optional(v.array(v.object({ id: v.number({ min: 1, max: 64, int: true }), x: coord, z: coord, nextBirth: nonNeg(1e10) }, { allowExtra: false }), { max: 32 })),
  market: v.optional(v.record(v.number({ min: 0.1, max: 5 }), { max: 8, keyPattern: /^(timber|stone|iron|provisions)$/ })),
  explored: v.optional(v.array(v.number({ min: 0, max: 4294967295, int: true }), { max: 128 })),
  players: v.object({ p1: playerFull, p2: playerFull, p3: v.optional(playerFull) }, { allowExtra: false }),
  diplomacy: v.optional(v.object({
    rel: v.record(v.number({ min: -100, max: 100 }), { max: 8, keyPattern: /^p[1-3]\|p[1-3]$/ }),
    truceUntil: v.record(nonNeg(1e10), { max: 8, keyPattern: /^p[1-3]\|p[1-3]$/ }),
    giftTick: v.record(v.number({ min: -1e10, max: 1e10 }), { max: 8, keyPattern: /^p[1-3]\|p[1-3]$/ }),
  }, { allowExtra: false })),
  brigands: v.optional(v.object({ raidIds: ids(64), helpIds: ids(64), trespassed: ids(400), spawned: nonNeg(1e4), nextSpawnTick: nonNeg(1e10) })),
  entities: v.record(entitySchema, { max: ENTITY_CAP, keyPattern: /^\d{1,9}$/ }),
  mission: v.object({
    objectives: v.array(v.object({ id: v.string({ max: 40 }), state: v.string({ oneOf: ['pending', 'active', 'done'] }) }), { max: 64 }),
    flags: v.record(v.any(), { max: 64 }), triggers: v.record(v.any(), { max: 64 }), messages: v.array(v.any(), { max: 200 }),
  }),
  ai: v.object({ wave: nonNeg(1000), state: v.string({ oneOf: ['build', 'gather', 'raid', 'retreat'] }), raidIds: ids(400), nextSpawnTick: nonNeg(1e10), nextScoutTick: nonNeg(1e10), faction: v.optional(v.string({ oneOf: ['rustfang', 'varr', 'stag', 'morrow'] })) }),
  combat: v.object({ pending: v.array(v.object({ target: v.number({ min: 1, max: 1e9, int: true }), damage: nonNeg(1e5), arrive: nonNeg(1e10) }), { max: 4000 }) }),
  selection: v.object({ ids: v.array(num, { max: 2000 }), groups: v.record(ids(200), { max: 10, keyPattern: /^[1-9]$/ }) }),
  stats: v.object({ produced: stockSchema, consumed: stockSchema }),
});

/** Walk every value: reject non-finite numbers, huge strings, excessive depth. */
function checkValues(value, path = '$', depth = 0) {
  if (depth > 24) throw new ValidationError('save structure too deep', path);
  if (typeof value === 'number' && !Number.isFinite(value)) throw new ValidationError('non-finite number', path);
  if (typeof value === 'string' && value.length > 2000) throw new ValidationError('string too long', path);
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) checkValues(value[k], `${path}.${k}`, depth + 1);
  }
}

export function serializeWorld(world, label = '') {
  syncRngState(world);
  const doc = { format: SAVE_FORMAT, schemaVersion: SCHEMA_VERSION, savedAtTick: world.tick, label: String(label).slice(0, 80), world };
  const text = JSON.stringify(doc);
  if (byteLength(text) > MAX_SAVE_BYTES) throw new ValidationError(`save too large (${byteLength(text)} bytes)`);
  return text;
}

export function migrate(doc) {
  let version = doc.schemaVersion | 0;
  const applied = [];
  while (version < SCHEMA_VERSION) {
    const m = MIGRATIONS[version];
    if (!m) throw new ValidationError(`no migration from schema ${version}`);
    try { doc.world = m(doc.world); } catch (err) { throw new ValidationError(`save could not be upgraded from schema ${version} (${err.message})`); }
    version++;
    doc.world.schemaVersion = version;
    doc.schemaVersion = version;
    applied.push(version);
  }
  return applied;
}

/**
 * Parse, migrate and validate an untrusted save. Returns { world, label, migrated }.
 * Throws ValidationError with a player-readable message on any problem.
 */
export function byteLength(text) {
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text).length : text.length * 3;
}

export function deserializeWorld(text) {
  if (typeof text === 'string' && byteLength(text) > MAX_SAVE_BYTES) throw new ValidationError(`save too large (> ${MAX_SAVE_BYTES} bytes)`);
  const doc = safeParse(text, MAX_SAVE_BYTES);
  if (!doc || typeof doc !== 'object' || doc.format !== SAVE_FORMAT) throw new ValidationError('not a Kindlehold save file');
  assertNoDangerousKeys(doc);
  const ver = Number(doc.schemaVersion);
  if (!Number.isInteger(ver) || ver < 1) throw new ValidationError('missing schema version');
  if (ver > SCHEMA_VERSION) throw new ValidationError(`save is from a newer version (schema ${ver})`);
  if (!doc.world || typeof doc.world !== 'object') throw new ValidationError('save has no world');
  const migrated = migrate(doc);
  checkValues(doc.world);
  validate(worldSchema, doc.world, 'world');
  // ids must match their keys, and be below nextId
  for (const k of Object.keys(doc.world.entities)) {
    const e = doc.world.entities[k];
    if (String(e.id) !== k) throw new ValidationError(`entity key ${k} does not match id ${e.id}`);
    if (e.id >= doc.world.nextId) throw new ValidationError('entity id beyond nextId');
  }
  const sc = ({ harrowmere: HARROWMERE_SCENARIO, greyfen: GREYFEN_SCENARIO, tollbreaker: TOLLBREAKER_SCENARIO, saltroad: SALTROAD_SCENARIO, whitestag: WHITESTAG_SCENARIO, irondebt: IRONDEBT_SCENARIO, ...FREE_SCENARIOS })[doc.world.meta.scenarioId] || HARROWMERE_SCENARIO;
  const known = new Set(sc.objectives.map((o) => o.id));
  for (const o of doc.world.mission.objectives) if (!known.has(o.id)) throw new ValidationError(`unknown objective "${o.id}"`);
  markDirty(doc.world);
  return { world: doc.world, label: typeof doc.label === 'string' ? doc.label : '', migrated };
}
