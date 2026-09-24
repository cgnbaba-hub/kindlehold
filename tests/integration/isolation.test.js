import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, SIM_MODULE_FACTORIES } from '../../src/app/simulation.js';
import { log } from '../../src/core/logger.js';

log.setConsoleLevel('error');

test('a failing non-critical sim module is disabled while the rest keeps running', () => {
  const broken = () => ({ id: 'broken-optional', kind: 'sim', update() { throw new Error('boom'); } });
  const sim = createSimulation({ seed: 3, modules: [...SIM_MODULE_FACTORIES, broken] });
  sim.issue({ type: 'rekindle' });
  for (let i = 0; i < 400; i++) sim.step();
  const h = Object.fromEntries(sim.host.health().map((r) => [r.id, r]));
  assert.equal(h['broken-optional'].status, 'failed');
  assert.equal(h.economy.status, 'ok');
  assert.equal(sim.world.tick, 400);
  assert.ok(sim.world.mission.flags.keepLit);
});

test('a failing critical module triggers the critical handler', () => {
  let critical = null;
  const bad = () => ({ id: 'bad-critical', kind: 'sim', critical: true, update() { throw new Error('core down'); } });
  const sim = createSimulation({ seed: 3, modules: [...SIM_MODULE_FACTORIES, bad], onCritical: (id) => { critical = id; } });
  sim.step();
  assert.equal(critical, 'bad-critical');
});
