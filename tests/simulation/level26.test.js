// Level 2.6: short nights, regrowing forests, bigger outcrops, plunder parties.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, all, units } from '../helpers/sim.js';
import { TREE_REGROW } from '../../src/production/index.js';
import { NIGHT_PACE } from '../../src/app/simulation.js';
import { aiSettings } from '../../src/ai/index.js';
import { createBuildingEntity } from '../../src/construction/index.js';

test('nights pass quickly and the day counter advances', () => {
  const sim = newSim();
  sim.world.time.hour = 21.99;
  let ticks = 0;
  while (!(sim.world.time.hour >= 5 && sim.world.time.hour < 6) && ticks < 20 * 600) { sim.step(); ticks++; }
  const nightTicks = (7 / 24) * sim.world.time.dayLengthTicks / NIGHT_PACE;
  assert.ok(Math.abs(ticks - nightTicks) < 40, `night took ${ticks} ticks`);
  assert.ok(ticks / 20 < 120, 'less than two minutes of real time');
  assert.equal(sim.world.time.day, 2);
});

test('felled trees are replanted and grow back', () => {
  const sim = newSim();
  const tree = all(sim.world, 'deposit').find((d) => d.type === 'tree');
  tree.amount = 0; tree.depletedTick = sim.world.tick;
  sim.run(40);
  assert.ok(sim.world.entities[tree.id], 'the stump stays');
  sim.run(TREE_REGROW);
  assert.equal(tree.amount, tree.maxAmount, 'grown back');
});

test('rock outcrops hold more stone', () => {
  const sim = newSim();
  const rock = all(sim.world, 'deposit').find((d) => d.type === 'rock');
  assert.ok(rock.maxAmount >= 150);
});

test('the Rustfang send plunder parties before the great raid', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  createBuildingEntity(sim.world, { type: 'farm', owner: 'p1', x: -20, z: 70, rot: 0, state: 'active' }); // an outlying workshop to plunder
  const tick = Math.round(aiSettings(sim.world).harassAt * 1200);
  sim.world.tick = tick - 1;
  // give the garrison time to muster first
  for (let i = 0; i < 12; i++) { sim.world.ai.nextSpawnTick = 0; sim.step(); }
  sim.world.ai.nextHarassTick = sim.world.tick + 1;
  sim.run(5);
  assert.ok(sim.world.ai.harass, 'a party set out');
  const party = sim.world.ai.harass.ids.map((id) => sim.world.entities[id]);
  assert.ok(party.every((u) => u.order.type === 'attackMove'));
  assert.ok(units(sim, 'p2').length > party.length, 'the fort keeps a garrison');
});
