// Load smoke test: a validated save is additionally run for a few simulation ticks on a
// throw-away copy. If any module fails, the save is rejected before the player's session
// is replaced (so "Load last save" can never loop into a broken state).
import { createSimulation } from './simulation.js';
import { ValidationError } from '../core/validate.js';

export function smokeTestWorld(world, ticks = 40) {
  const copy = JSON.parse(JSON.stringify(world));
  const sim = createSimulation({ seed: world.meta.seed, difficulty: world.meta.difficulty, setup: false, world: copy });
  sim.replaceWorld(copy);
  try {
    for (let i = 0; i < ticks; i++) sim.step();
  } catch (err) {
    throw new ValidationError(`save file is damaged (${err.message})`);
  }
  const bad = sim.host.health().filter((h) => h.status === 'failed' || h.errors > 0);
  sim.host.disposeAll();
  if (bad.length) throw new ValidationError(`save file is damaged (${bad.map((b) => `${b.id}: ${b.lastError}`).join('; ')})`);
  return true;
}
