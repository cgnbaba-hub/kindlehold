// Level 2.9: veterans earn ranks by winning fights.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, units } from '../helpers/sim.js';
import { dealDamage, RANKS, rankOf } from '../../src/combat/index.js';
import { spawnUnit } from '../../src/units/sim.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';

function fight(sim, killer, n) {
  for (let i = 0; i < n; i++) {
    const foe = spawnUnit(sim.world, 'reaver', 'p2', killer.x + 3, killer.z);
    dealDamage(sim.world, killer, foe, 1e4);
  }
}

test('soldiers become Veterans and then Elite; ranks add damage and health', () => {
  const sim = newSim();
  sim.step();
  const u = spawnUnit(sim.world, 'blade', 'p1', -30, 30);
  const hp0 = u.maxHp;
  let promoted = 0;
  sim.bus.on('unit:promoted', () => promoted++);
  fight(sim, u, RANKS[1].kills - 1);
  assert.equal(rankOf(u), 0);
  fight(sim, u, 1);
  assert.equal(rankOf(u), 1);
  assert.equal(u.maxHp, Math.round(hp0 * RANKS[1].hp));
  fight(sim, u, RANKS[2].kills - RANKS[1].kills);
  assert.equal(rankOf(u), 2);
  assert.equal(promoted, 2);
  assert.equal(u.maxHp, Math.round(Math.round(hp0 * 1.1) * (1.2 / 1.1)));
  fight(sim, u, 5);
  assert.equal(rankOf(u), 2, 'Elite is the top rank');
  const loaded = deserializeWorld(serializeWorld(sim.world)).world;
  assert.equal(loaded.entities[u.id].rank, 2);
  assert.equal(loaded.entities[u.id].xp, u.xp);
});

test('heroes and buildings do not collect ranks', () => {
  const sim = newSim();
  sim.step();
  const hero = units(sim).find((x) => x.hero);
  fight(sim, hero, 10);
  assert.equal(rankOf(hero), 0);
});

test('summer showers follow a fixed rhythm, never in winter, and make crops grow faster', async () => {
  const { rainAt, RAIN, seasonAt, growthFactor } = await import('../../src/weather/index.js');
  assert.equal(rainAt(RAIN.notBefore - 1), 0, 'no rain in the first minutes');
  let rainy = 0, winterRain = 0;
  for (let t = 0; t < 40 * 1200; t += 20) {
    const r = rainAt(t);
    if (r > 0) rainy++;
    if (r > 0 && seasonAt(t).winter) winterRain++;
  }
  assert.ok(rainy > 0, 'it rains sometimes');
  assert.equal(winterRain, 0);
  const sim = newSim();
  let t = RAIN.notBefore;
  while (rainAt(t) < 1) t += 20;
  sim.run(t - sim.world.tick + 5);
  assert.equal(sim.world.weather.kind, 'rain');
  assert.ok(growthFactor(sim.world) > 1.3);
  const loaded = deserializeWorld(serializeWorld(sim.world)).world;
  assert.equal(loaded.weather.kind, 'rain');
  sim.run(RAIN.length + 40);
  assert.equal(sim.world.weather.kind, 'clear');
  assert.ok(sim.world.weather.wet > 0, 'the ground is still wet after the shower');
});

test("the Fisher's Hut must stand by the river and brings in fish", async () => {
  const { checkPlacement, createBuildingEntity } = await import('../../src/construction/index.js');
  const { all } = await import('../../src/world/world.js');
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  sim.step();
  const far = checkPlacement(sim.world, sim.services, 'p1', 'fisher', -46, 62);
  assert.equal(far.ok, false);
  assert.match(far.reason, /river/);
  // a hut on the northern bank of the Harrow, staffed like any workshop
  const b = createBuildingEntity(sim.world, { type: 'fisher', owner: 'p1', x: -40, z: 2, rot: 0, state: 'active' });
  sim.services.nav.rebuildDynamic();
  const got = () => (b.stock.out.provisions || 0);
  let caught = 0;
  for (let i = 0; i < 20 * 120 && !caught; i++) { sim.step(); caught = got(); }
  assert.ok(b.fishSpot, 'found a spot on the bank');
  assert.ok(caught >= 3, `fish landed (${caught})`);
  assert.ok(all(sim.world, 'settler').some((s) => s.job === 'fisher'));
});
