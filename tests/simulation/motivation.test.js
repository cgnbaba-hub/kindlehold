// Motivation (internally `stability`): its parts add up to the target it drifts to; Wells lift it,
// but only the first few count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, runUntil } from '../helpers/sim.js';
import { createBuildingEntity } from '../../src/construction/index.js';
import { findSpot } from '../../src/demo/bot.js';
import { motivationParts, WELL_MOTIVATION, WELLS_COUNTED } from '../../src/population/index.js';

test('Wells lift motivation, up to three of them', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  // high taxes leave room below the ceiling of 100: Wells are how a town bears them
  sim.issue({ type: 'setTax', level: 2 });
  sim.run(20 * 5);
  const p = sim.world.players.p1;
  const t0 = p.stabilityTarget;
  const k = keep(sim);
  for (let i = 0; i < WELLS_COUNTED + 1; i++) {
    const spot = findSpot(sim.world, sim.services, 'well', k.x + 14 + i * 5, k.z + 12);
    createBuildingEntity(sim.world, { type: 'well', owner: 'p1', x: spot.x, z: spot.z, rot: 0, state: 'active' });
  }
  sim.run(20 * 2);
  assert.equal(Math.round(p.stabilityTarget - t0), WELLS_COUNTED * WELL_MOTIVATION, 'only three count');
  const parts = Object.fromEntries(motivationParts(sim.world, 'p1'));
  assert.equal(parts.Wells, WELLS_COUNTED * WELL_MOTIVATION);
  const sum = Object.values(parts).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(Math.max(0, Math.min(100, sum)) - p.stabilityTarget) <= 3, `the parts (${sum}) explain the target (${p.stabilityTarget})`);
  runUntil(sim, () => p.stability >= p.stabilityTarget - 0.5, 20 * 200);
  assert.ok(p.stability >= p.stabilityTarget - 0.5, 'motivation rises toward it');
});
