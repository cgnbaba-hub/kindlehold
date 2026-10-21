// The Donkey Stable: pack donkeys carry goods (big loads, slow walk), eat at every meal, rest
// at night and run off when their stable is gone; fewer of them and more fodder on Hard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, place, grant, all } from '../helpers/sim.js';
import { DONKEYS, donkeysPerStable, donkeyFodder } from '../../src/transport/defs.js';
import { completeBuilding } from '../../src/construction/index.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';
import { spawnEnemy } from '../../src/ai/index.js';

function withStable(opts) {
  const sim = newSim(opts);
  sim.issue({ type: 'rekindle' });
  sim.world.time.hour = 8;
  grant(sim, { timber: 400, stone: 300, taler: 300, provisions: 200 });
  const k = keep(sim);
  const st = place(sim, 'donkeystable', k.x + 14, k.z + 4);
  completeBuilding(sim.world, st);
  sim.step();
  return { sim, st };
}
const donkeys = (sim) => all(sim.world, 'donkey');

test('a finished stable brings its donkeys, fewer and hungrier ones on harder difficulties', () => {
  assert.ok(DONKEYS.count.hard <= DONKEYS.count.normal && DONKEYS.count.normal < DONKEYS.count.story);
  assert.ok(DONKEYS.eat.story < DONKEYS.eat.normal && DONKEYS.eat.normal < DONKEYS.eat.hard);
  assert.ok(DONKEYS.wage.story < DONKEYS.wage.normal && DONKEYS.wage.normal < DONKEYS.wage.hard);
  for (const difficulty of ['story', 'normal', 'hard']) {
    const { sim, st } = withStable({ difficulty });
    assert.equal(donkeys(sim).length, donkeysPerStable(sim.world), difficulty);
    assert.ok(donkeys(sim).every((d) => d.stable === st.id && d.owner === 'p1'));
  }
});

test("donkeys haul a workshop's goods to the store in big loads", () => {
  const { sim } = withStable();
  const k = keep(sim);
  const lodge = place(sim, 'lodge', k.x - 14, k.z + 4);
  completeBuilding(sim.world, lodge);
  // no townsfolk to carry: only the donkeys
  for (const s of all(sim.world, 'settler')) s.job = 'forester', s.workplace = lodge.id;
  lodge.stock.out.timber = 14;
  let loads = 0;
  for (let i = 0; i < 20 * 60 && !loads; i++) {
    sim.step();
    for (const d of donkeys(sim)) if (d.carry && d.carry.res === 'timber') loads = Math.max(loads, d.carry.amt);
  }
  assert.ok(loads > 6, `a donkey carries more than a carrier (${loads})`);
  assert.ok(donkeys(sim).every((d) => !d.task || (d.task.type !== 'build' && d.task.type !== 'repair')), 'they only carry');
});

test('donkeys eat at meals and stop when there is no fodder', () => {
  const { sim, st } = withStable({ difficulty: 'hard' });
  const p = sim.world.players.p1;
  const n = donkeys(sim).length;
  const before = p.res.provisions;
  sim.bus.emit('population:meal', { owner: 'p1', need: 0, eaten: 0 });
  assert.equal(before - p.res.provisions, n * donkeyFodder(sim.world));
  p.res.provisions = 0;
  sim.bus.emit('population:meal', { owner: 'p1', need: 0, eaten: 0 });
  assert.ok(st.hungry, 'hungry donkeys rest');
  for (let i = 0; i < 40; i++) sim.step();
  assert.ok(donkeys(sim).every((d) => d.task && d.task.type === 'rest'));
});

test('donkeys rest at night and run off when the stable is gone', () => {
  const { sim, st } = withStable();
  sim.world.time.hour = 23.5;
  for (let i = 0; i < 10; i++) sim.step();
  assert.ok(donkeys(sim).every((d) => d.task && d.task.type === 'rest'), 'night: in the stable');
  sim.issue({ type: 'demolish', id: st.id });
  sim.step(); sim.step();
  assert.equal(donkeys(sim).length, 0);
});

test('a save with donkeys at work loads and continues identically', () => {
  const { sim: a } = withStable();
  for (let i = 0; i < 20 * 20; i++) a.step();
  const { world } = deserializeWorld(serializeWorld(a.world, 'donkeys'));
  const b = newSim();
  b.replaceWorld(world);
  assert.equal(b.hash(), a.hash());
  for (let i = 0; i < 20 * 30; i++) { a.step(); b.step(); }
  assert.equal(b.hash(), a.hash());
});

test('on Normal and Hard the donkeys leave building sites to the carriers, and want their wage', () => {
  const { sim, st } = withStable({ difficulty: 'normal' });
  const k = keep(sim);
  place(sim, 'cottage', k.x - 12, k.z - 10);
  for (let i = 0; i < 20 * 30; i++) {
    sim.step();
    assert.ok(donkeys(sim).every((d) => !d.task || d.task.type !== 'supply'), 'no site deliveries');
  }
  const p = sim.world.players.p1;
  p.res.taler = 0;
  sim.bus.emit('population:payday', { owner: 'p1', taxes: 0, pay: 0, paid: 0 });
  assert.ok(st.unpaid, 'unpaid drovers');
  for (let i = 0; i < 40; i++) sim.step();
  assert.ok(donkeys(sim).every((d) => d.task && d.task.type === 'rest'));
  p.res.taler = 100;
  sim.bus.emit('population:payday', { owner: 'p1', taxes: 0, pay: 0, paid: 0 });
  assert.ok(!st.unpaid);
  assert.equal(p.res.taler, 100 - DONKEYS.wage.normal * donkeys(sim).length);
});

test('a donkey bolts for its stable when raiders come close', () => {
  const { sim, st } = withStable();
  for (let i = 0; i < 20 * 10; i++) sim.step();
  const [d] = donkeys(sim);
  const foe = spawnEnemy(sim.world, 'reaver', d.x + 4, d.z);
  foe.order = { type: 'hold', ax: foe.x, az: foe.z };
  for (let i = 0; i < 20; i++) sim.step();
  assert.ok(d.fleeUntil > sim.world.tick && d.task && d.task.type === 'rest', 'it runs');
  assert.ok(Math.hypot(d.x - st.x, d.z - st.z) < 30);
});

test('the Mule Yard makes room for one more donkey, bought for its price', () => {
  const { sim, st } = withStable();
  const n = donkeys(sim).length;
  st.level = 2;
  const taler = sim.world.players.p1.res.taler;
  for (let i = 0; i < 220; i++) sim.step();
  assert.equal(donkeys(sim).length, n + 1);
  assert.equal(taler - sim.world.players.p1.res.taler, DONKEYS.price);
});
