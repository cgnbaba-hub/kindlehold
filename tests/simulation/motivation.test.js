// Motivation (internally `stability`): its parts add up to the target it drifts to; Wells lift it,
// but only the first few count; idle townsfolk, long walks to work and feasts too close together
// weigh on it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, runUntil } from '../helpers/sim.js';
import { createBuildingEntity } from '../../src/construction/index.js';
import { findSpot } from '../../src/demo/bot.js';
import { motivationParts, WELL_MOTIVATION, WELLS_COUNTED, unemployedOf, commuteOf, spawnSettler, IDLE_STRAIN, COMMUTE, FEAST } from '../../src/population/index.js';
import { evaluate } from '../../src/missions/conditions.js';

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

test('townsfolk without work and long walks to work lower motivation, more on Hard', () => {
  const strainAt = (difficulty) => {
    const sim = newSim({ difficulty });
    sim.issue({ type: 'rekindle' });
    const k = keep(sim);
    for (let i = 0; i < 8; i++) spawnSettler(sim.world, 'p1', k.x + 4 + (i % 4), k.z + 6 + Math.floor(i / 4));
    sim.run(20 * 2);
    const u = unemployedOf(sim.world, 'p1');
    const parts = Object.fromEntries(motivationParts(sim.world, 'p1'));
    return { u, noWork: parts['No work'] || 0 };
  };
  const n = strainAt('normal'), s = strainAt('story'), h = strainAt('hard');
  assert.ok(n.u > 0, 'more townsfolk than work');
  assert.equal(n.noWork, -Math.min(IDLE_STRAIN.max, IDLE_STRAIN.each * n.u));
  assert.ok(s.noWork > n.noWork && h.noWork < n.noWork, `Story ${s.noWork} > Normal ${n.noWork} > Hard ${h.noWork}`);

  // a lodge far from every house: its workers walk a long way; a Cottage next to it fixes that
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  const k = keep(sim);
  const far = sim.services.nav.nearestWalkablePoint(k.x - 60, k.z + 10, 10);
  const lodge = createBuildingEntity(sim.world, { type: 'lodge', owner: 'p1', x: far.x, z: far.z, rot: 0, state: 'active' });
  runUntil(sim, () => lodge.workers && lodge.workers.length > 0, 20 * 10);
  assert.ok(commuteOf(sim.world, 'p1') > COMMUTE.free + COMMUTE.per, `a long walk (${commuteOf(sim.world, 'p1').toFixed(0)} m)`);
  assert.ok((Object.fromEntries(motivationParts(sim.world, 'p1'))['Long walks'] || 0) < 0);
  const near = sim.services.nav.nearestWalkablePoint(far.x + 8, far.z + 6, 6);
  createBuildingEntity(sim.world, { type: 'cottage', owner: 'p1', x: near.x, z: near.z, rot: 0, state: 'active' });
  assert.ok(commuteOf(sim.world, 'p1') < COMMUTE.free, 'a house close by');
  assert.equal(Object.fromEntries(motivationParts(sim.world, 'p1'))['Long walks'], undefined);
});

test('a feast needs five minutes of rest before the next one', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  const p = sim.world.players.p1;
  const rejected = [];
  sim.bus.on('command:rejected', (r) => rejected.push(r.reason));
  p.res.taler = 999; p.res.provisions = 999;
  sim.issue({ type: 'feast' }); sim.step();
  assert.ok(p.feastUntil > sim.world.tick, 'the first feast is held');
  sim.run(FEAST.duration + 20);
  sim.issue({ type: 'feast' }); sim.step();
  assert.match(rejected.pop() || '', /recovering/);
  sim.run(FEAST.cooldown);
  p.res.taler = 999; p.res.provisions = 999;
  sim.issue({ type: 'feast' }); sim.step();
  assert.ok(p.feastUntil > sim.world.tick, 'and later another');
});

test('campaign goals can ask for Hearthhands and motivation', () => {
  const sim = newSim();
  sim.step();
  assert.ok(evaluate(sim.world, { hands: 2 }) && !evaluate(sim.world, { hands: 3 }), 'two Hearthhands come with the Keep');
  sim.world.players.p1.stability = 81;
  assert.ok(evaluate(sim.world, { motivation: 80 }) && !evaluate(sim.world, { motivation: 90 }));
  const ids = sim.world.mission.objectives.map((o) => o.id);
  assert.ok(ids.includes('hearthhands'), 'chapter one teaches the Hearthhands');
});
