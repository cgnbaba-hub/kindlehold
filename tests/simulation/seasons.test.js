import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, units, settlers, all } from '../helpers/sim.js';
import { SEASON, seasonAt, WINTER_GROWTH, growthFactor } from '../../src/weather/index.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';

test('season schedule: first winter at minute 11, three minutes long, then eight of summer', () => {
  assert.equal(seasonAt(0).winter, false);
  assert.equal(seasonAt(SEASON.firstWinter - 1).winter, false);
  assert.equal(seasonAt(SEASON.firstWinter).winter, true);
  assert.equal(seasonAt(SEASON.firstWinter + SEASON.winter - 1).winter, true);
  assert.equal(seasonAt(SEASON.firstWinter + SEASON.winter).winter, false);
  assert.equal(seasonAt(SEASON.firstWinter + SEASON.winter + SEASON.summer).winter, true);
  assert.ok(WINTER_GROWTH < 1 && WINTER_GROWTH > 0);
});

test('winter snows, freezes the river (walkable), and the thaw puts walkers back ashore', () => {
  const sim = newSim();
  const nav = sim.services.nav;
  // a point in the middle of the river away from the fords
  const ice = { x: -58, z: -26 };
  assert.equal(nav.walkable(ice.x, ice.z), false, 'river blocked in summer');
  sim.world.tick = SEASON.firstWinter - 1;
  sim.run(SEASON.freezeAfter + 5);
  const w = sim.world.weather;
  assert.equal(w.season, 'winter');
  assert.ok(w.snow > 0.9, `snow cover builds (${w.snow})`);
  assert.equal(w.frozen, true);
  assert.equal(nav.walkable(ice.x, ice.z), true, 'frozen river is walkable');

  // save/load keeps the frozen state and the nav grid follows it
  const text = serializeWorld(sim.world);
  const loaded = deserializeWorld(text).world;
  assert.equal(loaded.weather.frozen, true);

  // someone standing on the ice when it breaks is pushed ashore and hurt
  const soldier = units(sim).find((u) => !u.hero) || units(sim)[0];
  soldier.x = soldier.px = ice.x; soldier.z = soldier.pz = ice.z;
  soldier.order = { type: 'hold', ax: ice.x, az: ice.z };
  const hpBefore = soldier.hp;
  sim.world.tick = SEASON.firstWinter + SEASON.winter - 2;
  sim.run(4);
  assert.equal(sim.world.weather.frozen, false);
  assert.equal(nav.walkable(ice.x, ice.z), false, 'river blocked again');
  assert.ok(nav.walkable(soldier.x, soldier.z), 'the soldier is back on walkable ground');
  assert.ok(soldier.hp < hpBefore, 'and soaked');
});

test('crops grow slower in winter', () => {
  const sim = newSim();
  assert.equal(growthFactor(sim.world), 1);
  sim.world.tick = SEASON.firstWinter - 1;
  sim.run(2);
  assert.equal(growthFactor(sim.world), WINTER_GROWTH);
});

test('labourers ordered to a tree fell timber by hand and carry it to the Keep', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  sim.step();
  const k = keep(sim);
  const tree = all(sim.world, 'deposit').filter((d) => d.type === 'tree').sort((a, b) => Math.hypot(a.x - k.x, a.z - k.z) - Math.hypot(b.x - k.x, b.z - k.z))[0];
  const crew = settlers(sim).slice(0, 2);
  const before = sim.world.players.p1.res.timber;
  sim.issue({ type: 'gather', ids: crew.map((s) => s.id), target: tree.id });
  sim.run(20 * 90);
  assert.ok(crew.every((s) => !s.order || s.order.kind === 'tree'), 'still under orders or finished');
  assert.ok(sim.world.players.p1.res.timber > before, `timber rose (${before} -> ${sim.world.players.p1.res.timber})`);
  // released labourers return to automatic work
  sim.issue({ type: 'release', ids: crew.map((s) => s.id) });
  sim.step();
  assert.ok(crew.every((s) => !s.order));
  for (const d of all(sim.world, 'deposit')) assert.ok(!d.reservedBy || sim.world.entities[d.reservedBy], 'no dangling reservations');
});

test('gather orders survive save/load and are rejected when malformed', () => {
  const sim = newSim();
  const tree = all(sim.world, 'deposit').find((d) => d.type === 'tree');
  const s = settlers(sim)[0];
  sim.issue({ type: 'gather', ids: [s.id], target: tree.id });
  sim.step();
  assert.equal(s.order.kind, 'tree');
  const loaded = deserializeWorld(serializeWorld(sim.world)).world;
  assert.equal(loaded.entities[s.id].order.kind, 'tree');
  const bad = JSON.parse(serializeWorld(sim.world));
  bad.world.entities[s.id].order.kind = 'gold';
  assert.throws(() => deserializeWorld(JSON.stringify(bad)));
  // an order aimed at an iron vein or an enemy is ignored
  const vein = all(sim.world, 'deposit').find((d) => d.type === 'iron');
  const s2 = settlers(sim)[1];
  sim.issue({ type: 'gather', ids: [s2.id], target: vein.id });
  sim.step();
  assert.ok(!s2.order);
});

test('exploration: the valley starts hidden, the settlement is revealed, walking uncovers more', async () => {
  const { isExplored, exploredFraction } = await import('../../src/exploration/index.js');
  const sim = newSim();
  const half = sim.terrain.half;
  const k = keep(sim);
  sim.step();
  assert.ok(isExplored(sim.world, half, k.x, k.z), 'around the Keep is explored');
  const camp = sim.terrain.map.enemyCamp;
  assert.equal(isExplored(sim.world, half, camp.x, camp.z), false, 'the enemy fort is hidden at the start');
  const before = exploredFraction(sim.world);
  assert.ok(before > 0.02 && before < 0.4, `explored ${before}`);
  const hero = units(sim).find((u) => u.hero);
  sim.issue({ type: 'move', ids: [hero.id], x: 10, z: 10 });
  sim.run(20 * 25);
  assert.ok(exploredFraction(sim.world) > before, 'moving the hero uncovers land');
  const loaded = deserializeWorld(serializeWorld(sim.world)).world;
  assert.deepEqual(loaded.explored, sim.world.explored);
});
