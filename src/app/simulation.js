// Headless simulation composition (runs in Node and in the browser; no three/DOM).
import { createEventBus } from '../core/events.js';
import { createModuleHost } from '../core/module-host.js';
import { DT } from '../core/contracts.js';
import { log } from '../core/logger.js';
import { createWorld, attachBus, worldRng, syncRngState } from '../world/world.js';
import { createTerrainData } from '../world/terrain-data.js';
import { HARROWMERE_MAP } from '../world/maps/harrowmere.js';
import { mapById, mapKey } from '../world/maps/index.js';
import { worldHash } from '../world/hash.js';
import { createNavigationModule } from '../navigation/index.js';
import { createWorldServicesModule } from '../world/services-module.js';
import { createMissionsModule, SCENARIOS } from '../missions/index.js';
import { createAiModule } from '../ai/index.js';
import { createTechnologyModule } from '../technology/index.js';
import { createConstructionModule } from '../construction/index.js';
import { createPopulationModule } from '../population/index.js';
import { createEconomyModule } from '../economy/index.js';
import { createProductionModule } from '../production/index.js';
import { createUnitsModule } from '../units/sim.js';
import { createHeroesModule } from '../heroes/index.js';
import { createCombatModule } from '../combat/index.js';
import { createWeatherModule } from '../weather/index.js';
import { createExplorationModule } from '../exploration/index.js';
import { createDailyModule } from '../population/daily.js';
import { createWildlifeModule } from '../wildlife/index.js';
import { createPoisModule } from '../pois/index.js';
import { createDiplomacyModule } from '../diplomacy/index.js';
import { createBrigandsModule } from '../brigands/index.js';

const terrainCache = new Map();
export const NIGHT_PACE = 6;
/** The dark hours (dusk to dawn) that pass at NIGHT_PACE. */
export function isFastHour(h) { return h >= 20 || h < 6; }

export function terrainFor(map = HARROWMERE_MAP) {
  const key = mapKey(map);
  let t = terrainCache.get(key);
  if (!t) {
    if (terrainCache.size > 6) for (const k of terrainCache.keys()) if (k.startsWith('wild:')) { terrainCache.delete(k); break; }
    t = createTerrainData(map); terrainCache.set(key, t);
  }
  return t;
}

/** Sim module factories, in update order (ARCHITECTURE.md §6). */
export const SIM_MODULE_FACTORIES = [
  createNavigationModule,
  createWorldServicesModule,
  createWeatherModule,
  createMissionsModule,
  createDiplomacyModule,
  createAiModule,
  createBrigandsModule,
  createTechnologyModule,
  createConstructionModule,
  createPopulationModule,
  createDailyModule,
  createEconomyModule,
  createProductionModule,
  createUnitsModule,
  createHeroesModule,
  createCombatModule,
  createExplorationModule,
  createWildlifeModule,
  createPoisModule,
];

export function createSimulation({ seed = 1337, difficulty = 'normal', scenarioId = 'harrowmere', campaign = null, world = null, modules = SIM_MODULE_FACTORIES, onCritical = null, setup = true } = {}) {
  const bus = createEventBus();
  const host = createModuleHost({ bus, onCritical, now: () => (sim.world ? sim.world.tick * 50 : 0) });
  // the scenario (or the loaded save's scenario) decides which map is played
  const sid = world ? world.meta.scenarioId : scenarioId;
  // (a generated map grows from the world's seed)
  const terrain = terrainFor(mapById((SCENARIOS[sid] || SCENARIOS.harrowmere).map || 'harrowmere', world ? world.meta.seed : seed));
  const pending = [];
  const commandLog = [];

  const sim = {
    bus, host, terrain,
    world: world || createWorld({ seed, difficulty, scenarioId: Object.hasOwn(SCENARIOS, scenarioId) ? scenarioId : 'harrowmere', title: (SCENARIOS[scenarioId] || SCENARIOS.harrowmere).title, campaign }),
    services: { terrain },
    commandLog,
    issue(cmd) {
      if (!cmd || typeof cmd.type !== 'string') return false;
      pending.push(cmd);
      return true;
    },
    step() {
      const w = sim.world;
      w.tick++;
      // the dark hours pass six times as fast: the village sleeps, the player does not wait long for dawn
      if (w.time.running) {
        const h = w.time.hour + (24 / w.time.dayLengthTicks) * (isFastHour(w.time.hour) ? NIGHT_PACE : 1);
        if (h >= 24) w.time.day = (w.time.day || 1) + 1;
        w.time.hour = h % 24;
      }
      if (pending.length) {
        const cmds = pending.splice(0, pending.length);
        for (const cmd of cmds) {
          commandLog.push({ tick: w.tick, cmd });
          bus.emit('command', cmd);
        }
      }
      host.update({ tick: w.tick, dt: DT });
      syncRngState(w);
    },
    run(ticks) { for (let i = 0; i < ticks; i++) sim.step(); },
    hash() { syncRngState(sim.world); return worldHash(sim.world); },
    context() {
      // getters: modules always see the current world, also after a load replaced it
      return {
        get world() { return sim.world; },
        get rng() { return worldRng(sim.world); },
        bus, log, services: sim.services, sim,
      };
    },
    /** Replace the world (load). Modules rebuild derived state in deserialize. */
    replaceWorld(newWorld, moduleData = {}) {
      pending.length = 0;
      sim.world = newWorld;
      attachBus(newWorld, bus);
      host.deserializeAll(moduleData);
      bus.emit('world:loaded', {});
    },
  };

  attachBus(sim.world, bus);
  for (const factory of modules) host.register(factory());
  host.initAll(sim.context());
  if (setup && !world) bus.emit('world:setup', {});
  host.startAll();
  return sim;
}
