// Level 2.7: census, rations, feasts, the Drill Yard and its new troops.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, place, runUntil, grant, all, settlers } from '../helpers/sim.js';
import { censusOf, RATIONS, FEAST } from '../../src/population/index.js';
import { computeDamage } from '../../src/combat/index.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';

const RICH = { timber: 999, stone: 999, iron: 999, provisions: 999, taler: 999 };

test('the census accounts for everyone', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  sim.run(20 * 30);
  const c = censusOf(sim.world, 'p1');
  const counted = c.building + c.carrying + c.repairing + c.gathering + c.idle + c.asleep + c.arriving + c.training + c.fleeing + Object.values(c.jobs).reduce((a, b) => a + b, 0);
  assert.equal(counted, settlers(sim).length);
  assert.equal(c.people, settlers(sim).length);
});

test('rations change how much is eaten and the mood', () => {
  const eaten = (level) => {
    const sim = newSim();
    sim.issue({ type: 'rekindle' });
    sim.issue({ type: 'setRations', level });
    sim.world.time.hour = 12;
    sim.step();
    const p = sim.world.players.p1;
    const before = p.res.provisions;
    sim.world.tick = p.nextMealTick - 1;
    sim.run(2);
    return { used: before - p.res.provisions, p, sim };
  };
  const half = eaten(0), generous = eaten(2);
  assert.ok(half.used < generous.used, `${half.used} < ${generous.used}`);
  half.sim.run(40); generous.sim.run(40);
  assert.ok(generous.p.stabilityTarget > half.p.stabilityTarget);
  assert.equal(RATIONS.length, 3);
});

test('a feast costs goods and lifts the mood for a while', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, RICH);
  sim.run(40);
  const t0 = sim.world.players.p1.stabilityTarget;
  sim.issue({ type: 'feast' });
  sim.run(40);
  const p = sim.world.players.p1;
  assert.ok(p.feastUntil > sim.world.tick);
  assert.ok(p.stabilityTarget >= Math.min(100, t0 + FEAST.stability - 1)); // the target is capped at 100
  const loaded = deserializeWorld(serializeWorld(sim.world)).world;
  assert.equal(loaded.players.p1.feastUntil, p.feastUntil);
});

test('Crossbowmen and Halberdiers need the Drill Yard; bolts pierce armour', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, RICH);
  const b = place(sim, 'barracks', -30, 38);
  runUntil(sim, () => b.state === 'active', 20 * 200);
  sim.issue({ type: 'recruit', building: b.id, unitType: 'crossbow' });
  sim.step();
  assert.equal(b.queue.length, 0, 'refused before the upgrade');
  sim.issue({ type: 'upgrade', id: b.id });
  runUntil(sim, () => (b.level || 1) === 2, 20 * 120);
  sim.issue({ type: 'recruit', building: b.id, unitType: 'halberd' });
  sim.step();
  assert.equal(b.queue.length, 1);
  const plain = computeDamage({ base: 22, attackerCls: 'ranged', defenderCls: 'melee', armor: 6 });
  const pierced = computeDamage({ base: 22, attackerCls: 'ranged', defenderCls: 'melee', armor: 3 });
  assert.ok(pierced > plain);
  assert.ok(all(sim.world, 'building').length > 0);
});
