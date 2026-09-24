// Save games: serialization, validation of untrusted save data, schema migrations.
// The world object is the save boundary; derived data is rebuilt on load.
import { SCHEMA_VERSION, MAX_SAVE_BYTES, ENTITY_CAP, RESOURCES } from '../core/contracts.js';
import { safeParse, assertNoDangerousKeys, ValidationError, v, validate } from '../core/validate.js';
import { markDirty, syncRngState } from '../world/world.js';
import { MIGRATIONS } from './migrations.js';

export const SAVE_FORMAT = 'kindlehold-save';

const ENTITY_KINDS = ['building', 'settler', 'unit', 'deposit'];

const num = v.number();
const stockSchema = v.object(Object.fromEntries(RESOURCES.map((r) => [r, v.number({ min: 0, max: 1e7 })])));

const playerSchema = v.object({
  id: v.string({ max: 8 }),
  res: stockSchema,
  techs: v.record(v.boolean(), { max: 32 }),
  stability: v.number({ min: 0, max: 100 }),
});

const entitySchema = (x, p) => {
  v.object({
    id: v.number({ min: 1, int: true }),
    kind: v.string({ oneOf: ENTITY_KINDS }),
    x: v.number({ min: -200, max: 200 }),
    z: v.number({ min: -200, max: 200 }),
    owner: v.string({ max: 8 }),
  })(x, p);
};

const worldSchema = v.object({
  schemaVersion: v.number({ min: 1, max: SCHEMA_VERSION, int: true }),
  meta: v.object({ scenarioId: v.string({ max: 40 }), difficulty: v.string({ oneOf: ['story', 'normal', 'hard'] }) }),
  tick: v.number({ min: 0, max: 1e9, int: true }),
  rng: v.array(v.number({ min: 0, max: 4294967295, int: true }), { max: 4 }),
  nextId: v.number({ min: 1, max: 1e9, int: true }),
  time: v.object({ hour: v.number({ min: 0, max: 24 }), dayLengthTicks: v.number({ min: 100, max: 1e7 }) }),
  players: v.record(playerSchema, { max: 4 }),
  entities: v.record(entitySchema, { max: ENTITY_CAP, keyPattern: /^\d{1,9}$/ }),
  mission: v.object({ objectives: v.array(v.object({ id: v.string({ max: 40 }), state: v.string({ oneOf: ['pending', 'active', 'done'] }) }), { max: 64 }) }),
  ai: v.object({ wave: v.number({ min: 0, max: 1000 }) }),
  selection: v.object({ ids: v.array(num, { max: 2000 }) }),
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
  if (text.length > MAX_SAVE_BYTES) throw new ValidationError(`save too large (${text.length} bytes)`);
  return text;
}

export function migrate(doc) {
  let version = doc.schemaVersion | 0;
  const applied = [];
  while (version < SCHEMA_VERSION) {
    const m = MIGRATIONS[version];
    if (!m) throw new ValidationError(`no migration from schema ${version}`);
    doc.world = m(doc.world);
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
export function deserializeWorld(text) {
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
  markDirty(doc.world);
  return { world: doc.world, label: typeof doc.label === 'string' ? doc.label : '', migrated };
}
