// Settler comfort: storehouses as extra stores, idle labourers gathering on their own,
// moving buildings, soldiers healing at home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, place, runUntil, grant, all, units } from '../helpers/sim.js';
import { pickStore, AUTO_GATHER } from '../../src/economy/index.js';
import { findSpot } from '../../src/demo/bot.js';
import { spawnUnit } from '../../src/units/sim.js';

function started(extra = {}) {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, { timber: 400, stone: 300, iron: 40, taler: 300, provisions: 200, ...extra });
  return sim;
}

test('labourers use the nearest store: a Storehouse by an outlying lodge takes its timber', () => {
  const sim = started();
  const k = keep(sim);
  const store = place(sim, 'storehouse', k.x - 26, k.z - 18);
  runUntil(sim, () => store.state === 'active', 20 * 240);
  assert.equal(store.state, 'active', 'the storehouse was built');
  const lodge = place(sim, 'lodge', store.x - 10, store.z - 6);
  runUntil(sim, () => lodge.state === 'active', 20 * 240);
  // goods stored near the storehouse rather than at the Keep
  const stored = [];
  sim.bus.on('goods:stored', (d) => { if (d.res === 'timber') stored.push(d); });
  runUntil(sim, () => stored.length >= 2, 20 * 300);
  assert.ok(stored.length >= 2, 'timber reached a store');
  const atStore = stored.filter((d) => Math.hypot(d.x - store.x, d.z - store.z) < Math.hypot(d.x - k.x, d.z - k.z));
  assert.ok(atStore.length >= 1, `timber went to the nearer storehouse (${stored.map((d) => `${d.x.toFixed(0)},${d.z.toFixed(0)}`).join(' ')})`);
  // and the store choice itself
  const s = all(sim.world, 'settler')[0];
  assert.equal(pickStore(sim.world, s, lodge, 'drop').id, store.id);
});

test('idle labourers fell trees on their own while timber runs short, and can be told to wait', () => {
  const sim = started({ timber: 10, stone: 300 });
  const p = sim.world.players.p1;
  let auto = 0;
  for (let i = 0; i < 20 * 90; i++) {
    sim.step();
    p.res.timber = Math.min(p.res.timber, 20);
    if (all(sim.world, 'settler').some((s) => s.order && s.order.auto)) auto++;
  }
  assert.ok(auto > 0, 'someone went gathering on their own');
  assert.ok(sim.world.stats.produced.timber > 0, 'hand-felled timber reached the store');
  // switched off: nobody leaves on their own
  sim.issue({ type: 'setAutoGather', on: false });
  sim.step();
  assert.equal(p.autoGather, false);
  for (let i = 0; i < 20 * 60; i++) sim.step();
  for (let i = 0; i < 20 * 30; i++) {
    sim.step();
    assert.ok(!all(sim.world, 'settler').some((s) => s.order && s.order.auto && s.task && s.task.stage === 'find'), 'no new self-sent trips');
  }
  // a full store needs no help
  const sim2 = started({ timber: AUTO_GATHER.timber + 200, stone: AUTO_GATHER.stone + 200 });
  for (let i = 0; i < 20 * 60; i++) sim2.step();
  assert.ok(!all(sim2.world, 'settler').some((s) => s.order && s.order.auto), 'nobody gathers when the store is full');
});

test('a moved building is taken down and put up elsewhere with its materials and level', () => {
  const sim = started();
  const k = keep(sim);
  const lodge = place(sim, 'lodge', k.x - 20, k.z - 10);
  runUntil(sim, () => lodge.state === 'active', 20 * 240);
  lodge.level = 2; lodge.maxHp += 150;
  const before = { ...sim.world.players.p1.res };
  const spot = findSpot(sim.world, sim.services, 'lodge', k.x - 34, k.z - 4);
  assert.ok(spot, 'a free spot for the lodge');
  sim.issue({ type: 'relocate', id: lodge.id, x: spot.x, z: spot.z });
  sim.step();
  assert.equal(sim.world.entities[lodge.id], undefined, 'the old lodge is gone');
  const site = all(sim.world, 'building').find((b) => b.type === 'lodge' && b.x === spot.x && b.z === spot.z);
  assert.ok(site && site.state === 'site', 'a construction site at the new place');
  assert.deepEqual(site.build.supplied, site.build.required, 'all materials came along');
  assert.ok(sim.world.players.p1.res.timber >= before.timber - 1, 'moving costs no materials');
  runUntil(sim, () => site.state === 'active', 20 * 240);
  assert.equal(site.state, 'active');
  assert.equal(site.level, 2, 'the level is kept');
  // the Keep cannot be moved
  sim.issue({ type: 'relocate', id: k.id, x: k.x + 30, z: k.z });
  sim.step();
  assert.ok(sim.world.entities[k.id], 'the Keep stays');
});

test('ordering units to walk is not mistaken for moving a building', () => {
  const sim = started();
  const hero = all(sim.world, 'unit').find((u) => u.hero);
  const rejected = [];
  sim.bus.on('command:rejected', (r) => rejected.push(r.reason));
  sim.issue({ type: 'move', ids: [hero.id], x: hero.x + 10, z: hero.z + 6 });
  sim.step();
  assert.deepEqual(rejected, []);
  assert.equal(hero.order && hero.order.type, 'move');
});

test('soldiers heal at home once out of the fight, not out in the field', () => {
  const sim = started();
  const k = keep(sim);
  const a = spawnUnit(sim.world, 'shield', 'p1', k.x + 8, k.z + 8);
  const b = spawnUnit(sim.world, 'shield', 'p1', k.x + 80, k.z - 60);
  void units;
  assert.ok(a && b, 'two soldiers');
  a.x = k.x + 8; a.z = k.z + 8; a.order = { type: 'hold', ax: a.x, az: a.z };
  b.x = k.x + 80; b.z = k.z - 60; b.order = { type: 'hold', ax: b.x, az: b.z };
  a.hp = a.maxHp * 0.4; b.hp = b.maxHp * 0.4;
  a.lastHitTick = b.lastHitTick = sim.world.tick;
  const ha = a.hp, hb = b.hp;
  for (let i = 0; i < 20 * 3; i++) sim.step();
  assert.equal(a.hp, ha, 'no healing right after a hit');
  for (let i = 0; i < 20 * 10; i++) sim.step();
  assert.ok(a.hp > ha + 10, `healing at the Keep (${ha} -> ${a.hp})`);
  assert.equal(b.hp, hb, 'no healing far from home');
});
