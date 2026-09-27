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
