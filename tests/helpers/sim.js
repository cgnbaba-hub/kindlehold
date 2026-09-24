// Test helpers: real simulation, driven only through commands.
import { createSimulation } from '../../src/app/simulation.js';
import { all } from '../../src/world/world.js';
import { log } from '../../src/core/logger.js';
import { findSpot } from '../../src/demo/bot.js';

log.setConsoleLevel('error');

export function newSim(opts = {}) { return createSimulation({ seed: 1337, difficulty: 'normal', ...opts }); }
export function keep(sim) { return all(sim.world, 'building').find((b) => b.type === 'keep'); }
export function byType(sim, type) { return all(sim.world, 'building').filter((b) => b.type === type); }
export function units(sim, owner = 'p1') { return all(sim.world, 'unit').filter((u) => u.owner === owner); }
export function settlers(sim) { return all(sim.world, 'settler'); }
export function place(sim, type, x, z) {
  const spot = findSpot(sim.world, sim.services, type, x, z);
  if (!spot) throw new Error(`no spot for ${type}`);
  sim.issue({ type: 'place', buildingType: type, x: spot.x, z: spot.z });
  sim.step();
  const b = byType(sim, type).find((e) => e.x === spot.x && e.z === spot.z);
  if (!b) throw new Error(`placement of ${type} failed`);
  return b;
}
export function runUntil(sim, pred, maxTicks) {
  for (let i = 0; i < maxTicks; i++) { if (pred()) return i; sim.step(); }
  return pred() ? maxTicks : -1;
}
export function grant(sim, res) { Object.assign(sim.world.players.p1.res, res); }
export { all };
