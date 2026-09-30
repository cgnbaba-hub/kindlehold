// Shared contracts: event names, constants and JSDoc types. Integrator-owned.

export const TICK_RATE = 20;
export const DT = 1 / TICK_RATE;
export const SCHEMA_VERSION = 4;
export const ENTITY_CAP = 1200;
export const MAX_SAVE_BYTES = 2 * 1024 * 1024;

// flour, bread and tools come from the longer production chains (Windmill, Bakery, Smithy)
export const RESOURCES = /** @type {const} */ (['timber', 'stone', 'iron', 'provisions', 'taler', 'flour', 'bread', 'tools']);

export const PLAYER = 'p1';
export const ENEMY = 'p2';

/** Canonical event names (ARCHITECTURE.md §5). */
export const EV = Object.freeze({
  ENTITY_SPAWNED: 'entity:spawned',
  ENTITY_REMOVED: 'entity:removed',
  BUILDING_PLACED: 'building:placed',
  BUILDING_COMPLETED: 'building:completed',
  BUILDING_DESTROYED: 'building:destroyed',
  CONSTRUCTION_PROGRESS: 'construction:progress',
  RESOURCE_CHANGED: 'resource:changed',
  PRODUCTION_CYCLE: 'production:cycle',
  PRODUCTION_STALLED: 'production:stalled',
  WORK_STRIKE: 'work:strike',
  SETTLER_ARRIVED: 'settler:arrived',
  POPULATION_CHANGED: 'population:changed',
  TECH_STARTED: 'tech:started',
  TECH_COMPLETED: 'tech:completed',
  UNIT_RECRUITED: 'unit:recruited',
  UNIT_ORDER: 'unit:order',
  COMBAT_HIT: 'combat:hit',
  COMBAT_SHOT: 'combat:shot',
  UNIT_DIED: 'unit:died',
  HERO_ABILITY: 'hero:ability',
  AI_WAVE: 'ai:wave',
  MISSION_OBJECTIVE: 'mission:objective',
  MISSION_MESSAGE: 'mission:message',
  MISSION_ENDED: 'mission:ended',
  ALERT: 'alert',
  MODULE_ERROR: 'module:error',
  COMMAND_REJECTED: 'command:rejected',
  WORLD_LOADED: 'world:loaded',
});

/**
 * @typedef {'timber'|'stone'|'iron'|'provisions'|'taler'|'flour'|'bread'|'tools'} ResourceId
 * @typedef {Record<ResourceId, number>} Stock
 *
 * @typedef {Object} Entity
 * @property {number} id       stable unique id
 * @property {string} kind     'building'|'settler'|'unit'|'hero'|'deposit'|'corpse'
 * @property {string} owner    'p1'|'p2'|'none'
 * @property {number} x        metres
 * @property {number} z        metres
 * @property {number} px       previous-tick x (render interpolation)
 * @property {number} pz       previous-tick z
 *
 * @typedef {Object} PlayerState
 * @property {string} id
 * @property {string} name
 * @property {string} faction
 * @property {Stock} res
 * @property {Record<string, true>} techs
 * @property {{techId:string, progress:number}|null} research
 * @property {number} stability
 * @property {number} popCap
 *
 * @typedef {Object} World
 * @property {number} schemaVersion
 * @property {{seed:number|string, scenarioId:string, title:string, difficulty:string, createdTick:number}} meta
 * @property {number} tick
 * @property {number[]} rng           serialized sfc32 state
 * @property {number} nextId
 * @property {{hour:number, dayLengthTicks:number, running:boolean}} time
 * @property {{kind:string, intensity:number}} weather
 * @property {Record<string, PlayerState>} players
 * @property {Record<number, Entity>} entities
 * @property {Object} mission         objectives + trigger state
 * @property {Object} ai              enemy AI state
 * @property {{ids:number[], groups:Record<string, number[]>}} selection
 * @property {Object} stats
 *
 * @typedef {Object} ModuleContext
 * @property {World} world
 * @property {ReturnType<import('./events.js').createEventBus>} bus
 * @property {import('./rng.js').Rng} rng
 * @property {typeof import('./logger.js').log} log
 * @property {Object} services        shared derived services (nav, spatial, terrain)
 * @property {Object} settings
 *
 * @typedef {Object} GameModule
 * @property {string} id
 * @property {'sim'|'view'} kind
 * @property {boolean} [critical]
 * @property {(ctx:ModuleContext) => void} [init]
 * @property {() => void} [start]
 * @property {(step:{tick:number, dt:number}) => void} [update]
 * @property {(alpha:number, frame:{dt:number, time:number}) => void} [render]
 * @property {() => void} [pause]
 * @property {() => void} [resume]
 * @property {() => any} [serialize]
 * @property {(data:any) => void} [deserialize]
 * @property {() => void} [dispose]
 * @property {() => {status:'ok'|'degraded'|'failed', detail?:string}} [getHealthStatus]
 */
