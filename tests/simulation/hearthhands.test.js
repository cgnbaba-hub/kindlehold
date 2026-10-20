// Hearthhands: hired at the Keep, bunked there, fed and paid; they build, carry and gather by
// hand, but never take a workplace, never enlist and pay no taxes. Townsfolk no longer gather
// on their own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, place, runUntil, grant, all } from '../helpers/sim.js';
import { HAND, handsOf, handsCap, paydayForecast } from '../../src/population/index.js';
import { autoGatherRules } from '../../src/economy/index.js';

const hands = (sim) => all(sim.world, 'settler').filter((s) => s.hand);
const townsfolk = (sim) => all(sim.world, 'settler').filter((s) => !s.hand);

test('the Keep hires Hearthhands for Taler, up to the bunks its level holds', () => {
  const sim = newSim();
  const rejected = [];
  sim.bus.on('command:rejected', (r) => rejected.push(r.reason));
  assert.equal(hands(sim).length, 2, 'two come with the Keep');
  sim.issue({ type: 'hireHand' });
  sim.step();
  assert.match(rejected.pop() || '', /hearth/, 'not while the hearth is dark');
  sim.issue({ type: 'rekindle' });
  grant(sim, { taler: 1000 });
  const t0 = sim.world.players.p1.res.taler;
  for (let i = 0; i < 6; i++) { sim.issue({ type: 'hireHand' }); sim.step(); }
  assert.equal(handsOf(sim.world, 'p1'), HAND.cap[0], 'the Keep is full');
  assert.equal(t0 - sim.world.players.p1.res.taler, (HAND.cap[0] - 2) * HAND.cost.taler, 'the ones hired were paid for');
  assert.match(rejected.pop() || '', /bunks/);
  keep(sim).level = 2;
  assert.equal(handsCap(sim.world, 'p1'), HAND.cap[1], 'the Castle holds more');
});

test('Hearthhands build and carry, but never take a workplace or enlist; they need no house', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, { timber: 400, stone: 300, iron: 60, provisions: 300, taler: 500 });
  for (let i = 0; i < 4; i++) { sim.issue({ type: 'hireHand' }); sim.step(); }
  const k = keep(sim);
  const lodge = place(sim, 'lodge', k.x - 20, k.z - 10);
  const quarry = place(sim, 'quarry', k.x - 26, k.z + 14);
  const barracks = place(sim, 'barracks', k.x + 18, k.z + 12);
  let built = 0;
  for (let i = 0; i < 20 * 240; i++) {
    sim.step();
    for (const h of hands(sim)) {
      assert.ok(!h.job, 'no workplace for a Hearthhand');
      assert.ok(!h.enlisting, 'no soldiering for a Hearthhand');
      if (h.task && (h.task.type === 'build' || h.task.type === 'supply')) built++;
    }
    if (i === 20 * 120 && barracks.state === 'active') sim.issue({ type: 'recruit', building: barracks.id, unitType: 'shield' });
  }
  assert.ok(built > 0, 'they worked on the sites');
  assert.ok(lodge.state === 'active' && quarry.state === 'active', 'the sites were finished');
  const p = sim.world.players.p1;
  assert.equal(p.housed, p.pop - p.hands, 'they take no bed in a house');
});

test('only Hearthhands gather on their own, below a stock that is lower on Hard', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, { timber: 0, stone: 300, provisions: 300 });
  const p = sim.world.players.p1;
  let handTrips = 0;
  for (let i = 0; i < 20 * 90; i++) {
    sim.step();
    p.res.timber = Math.min(p.res.timber, 20);
    for (const s of all(sim.world, 'settler')) {
      if (s.order && s.order.auto) { assert.ok(s.hand, 'townsfolk do not go felling on their own'); handTrips++; }
    }
  }
  assert.ok(handTrips > 0, 'the hands went felling');
  // switched off: nobody leaves on their own
  sim.issue({ type: 'setAutoGather', on: false });
  for (let i = 0; i < 20 * 60; i++) sim.step();
  for (let i = 0; i < 20 * 30; i++) {
    sim.step();
    assert.ok(!all(sim.world, 'settler').some((s) => s.order && s.order.auto && s.task && s.task.stage === 'find'), 'no new trips');
  }
  const hard = autoGatherRules(newSim({ difficulty: 'hard' }).world), story = autoGatherRules(newSim({ difficulty: 'story' }).world);
  assert.ok(hard.timber < autoGatherRules(sim.world).timber && story.timber > autoGatherRules(sim.world).timber);
});

test('payday: Hearthhands draw a wage and pay no taxes', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, { taler: 500 });
  const before = paydayForecast(sim.world, 'p1');
  sim.issue({ type: 'hireHand' }); sim.step();
  sim.issue({ type: 'hireHand' }); sim.step();
  const after = paydayForecast(sim.world, 'p1');
  assert.equal(after.taxes, before.taxes, 'no taxes from them');
  assert.equal(after.pay - before.pay, 2 * HAND.wage, 'a wage each');
  assert.equal(townsfolk(sim).length + hands(sim).length, all(sim.world, 'settler').length);
});
