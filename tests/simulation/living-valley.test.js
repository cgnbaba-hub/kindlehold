// Level 2.5: wildlife and hunting, the Tavern's hot meals, the night's rest, places to explore.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, place, runUntil, grant, settlers, units, all } from '../helpers/sim.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';
import { reveal } from '../../src/exploration/index.js';

const RICH = { timber: 999, stone: 999, iron: 999, provisions: 999, taler: 999 };

test('deer herds roam the valley and are saved with the world', () => {
  const sim = newSim();
  const deer = all(sim.world, 'animal');
  assert.ok(deer.length >= 12, `${deer.length} deer`);
  assert.ok(sim.world.herds.length >= 4);
  const x0 = deer.map((a) => a.x);
  sim.run(20 * 30);
  assert.ok(all(sim.world, 'animal').some((a, i) => a.x !== x0[i]), 'they move');
  const loaded = deserializeWorld(serializeWorld(sim.world)).world;
  assert.equal(Object.values(loaded.entities).filter((e) => e.kind === 'animal').length, all(sim.world, 'animal').length);
});

test('a hunter brings in meat as provisions', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, RICH);
  const herd = sim.world.herds.slice().sort((a, b) => Math.hypot(a.x + 46, a.z - 50) - Math.hypot(b.x + 46, b.z - 50))[0];
  const hut = place(sim, 'hunter', herd.x - 12, herd.z);
  runUntil(sim, () => hut.state === 'active', 20 * 120);
  const before = all(sim.world, 'animal').length;
  const t = runUntil(sim, () => all(sim.world, 'animal').length < before && ((hut.stock.out.provisions || 0) > 0 || hut.stock.outReserved > 0), 20 * 240);
  assert.ok(t >= 0, 'the hunter made a kill and brought meat home');
});

test('the Tavern turns provisions into hot meals that are served first', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, RICH);
  const tav = place(sim, 'canteen', -56, 36);
  runUntil(sim, () => tav.state === 'active', 20 * 200);
  runUntil(sim, () => (tav.meals || 0) >= 6, 20 * 200);
  assert.ok(tav.meals >= 6, `meals cooked (${tav.meals})`);
  const p = sim.world.players.p1;
  sim.world.time.hour = 12;
  const mealsBefore = tav.meals, provBefore = p.res.provisions;
  sim.world.tick = p.nextMealTick - 1;
  p.nextMealTick = sim.world.tick + 1;
  sim.run(2);
  assert.ok(tav.meals < mealsBefore, 'meals were eaten');
  assert.ok(p.hotMeals > 0, 'some people had a hot meal');
  assert.ok(provBefore - p.res.provisions < p.pop, 'the stores were spared');
});

test('settlers sleep at night and wake at dawn; sleepers are hidden and safe', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, RICH);
  place(sim, 'cottage', -54, 64);
  sim.world.time.hour = 21.9;
  sim.run(20 * 20); // nights are short: 20 s of real time reach the small hours
  assert.ok(sim.world.time.hour >= 22 || sim.world.time.hour < 5);
  const asleep = settlers(sim).filter((s) => s.sleep && s.sleep.in);
  assert.ok(asleep.length >= settlers(sim).length - 1, `${asleep.length}/${settlers(sim).length} asleep`);
  assert.ok(asleep.every((s) => s.hidden));
  const loaded = deserializeWorld(serializeWorld(sim.world)).world;
  assert.ok(Object.values(loaded.entities).some((e) => e.kind === 'settler' && e.sleep && e.sleep.in));
  runUntil(sim, () => sim.world.time.hour >= 6 && sim.world.time.hour < 7, 20 * 400);
  sim.run(40);
  assert.equal(settlers(sim).filter((s) => s.sleep).length, 0, 'everyone is up');
  assert.ok(keep(sim));
});

test('places of interest: the trader trades once found, the ruin pays out, Millbrook allies with Maren', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  sim.step();
  const pois = all(sim.world, 'poi');
  for (const t of ['cairn', 'hamlet', 'ruin', 'trader']) assert.ok(pois.some((p) => p.type === t), t);
  const trader = pois.find((p) => p.type === 'trader');
  const p = sim.world.players.p1;
  p.res.taler = 100;
  sim.issue({ type: 'trade', id: trader.id, deal: 'buyTimber' });
  sim.step();
  assert.equal(p.res.taler, 100, 'no trade before the trader is found');
  reveal(sim.world, sim.terrain.half, trader.x, trader.z, 8);
  sim.run(20);
  assert.equal(trader.state, 'found');
  const t0 = p.res.timber;
  sim.issue({ type: 'trade', id: trader.id, deal: 'buyTimber' });
  sim.step();
  assert.equal(p.res.taler, 70);
  assert.equal(p.res.timber, t0 + 20);

  const ruin = pois.find((x) => x.type === 'ruin');
  const soldier = units(sim).find((u) => u.hero);
  reveal(sim.world, sim.terrain.half, ruin.x, ruin.z, 8);
  soldier.x = soldier.px = ruin.x + 1; soldier.z = soldier.pz = ruin.z;
  const tal = p.res.taler;
  sim.run(40);
  assert.equal(ruin.state, 'done');
  assert.ok(p.res.taler >= tal + 100, 'the cache paid out');

  const hamlet = pois.find((x) => x.type === 'hamlet');
  reveal(sim.world, sim.terrain.half, hamlet.x, hamlet.z, 8);
  soldier.x = soldier.px = hamlet.x; soldier.z = soldier.pz = hamlet.z + 2;
  sim.run(40);
  assert.equal(hamlet.state, 'done');
  assert.ok(sim.world.mission.flags.millbrookAllied);
  const loaded = deserializeWorld(serializeWorld(sim.world)).world;
  assert.equal(Object.values(loaded.entities).filter((e) => e.kind === 'poi').length, pois.length);
});
