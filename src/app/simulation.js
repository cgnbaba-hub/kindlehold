// Headless simulation composition (runs in Node and in the browser; no three/DOM).
import { createEventBus } from '../core/events.js';
import { createModuleHost } from '../core/module-host.js';
import { DT } from '../core/contracts.js';
import { log } from '../core/logger.js';
import { createWorld, attachBus, worldRng, syncRngState } from '../world/world.js';
import { createTerrainData } from '../world/terrain-data.js';
import { HARROWMERE_MAP } from '../world/maps/harrowmere.js';
import { worldHash } from '../world/hash.js';
import { createNavigationModule } from '../navigation/index.js';
import { createWorldServicesModule } from '../world/services-module.js';
import { createMissionsModule } from '../missions/index.js';
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

const terrainCache = new Map();
export function terrainFor(map = HARROWMERE_MAP) {
  let t = terrainCache.get(map.id);
  if (!t) { t = createTerrainData(map); terrainCache.set(map.id, t); }
  return t;
}

/** Sim module factories, in update order (ARCHITECTURE.md §6). */
export const SIM_MODULE_FACTORIES = [
  createNavigationModule,
  createWorldServicesModule,
  createWeatherModule,
  createMissionsModule,
  createAiModule,
  createTechnologyModule,
  createConstructionModule,
  createPopulationModule,
  createEconomyModule,
  createProductionModule,
  createUnitsModule,
  createHeroesModule,
  createCombatModule,
  createExplorationModule,
];

export function createSimulation({ seed = 1337, difficulty = 'normal', world = null, modules = SIM_MODULE_FACTORIES, onCritical = null, setup = true } = {}) {
  const bus = createEventBus();
  const host = createModuleHost({ bus, onCritical, now: () => (sim.world ? sim.world.tick * 50 : 0) });
  const terrain = terrainFor();
  const pending = [];
  const commandLog = [];

  const sim = {
    bus, host, terrain,
    world: world || createWorld({ seed, difficulty }),
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
      if (w.time.running) w.time.hour = (w.time.hour + 24 / w.time.dayLengthTicks) % 24;
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
