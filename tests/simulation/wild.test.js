// Free play on generated maps: every seed must give a playable valley, and a save must rebuild
// the same valley from the world's seed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, all } from '../helpers/sim.js';
import { createBot } from '../../src/demo/bot.js';
import { generateWildMap } from '../../src/world/maps/wild.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';
import { enemyFaction } from '../../src/ai/factions.js';
import { SCENARIOS, FREE_PLAY } from '../../src/missions/index.js';

const near = (sim, type, from, r) => all(sim.world, 'deposit').some((d) => d.type === type && Math.hypot(d.x - from.x, d.z - from.z) <= r);

test('the same seed gives the same map, another seed another one', () => {
  assert.deepEqual(generateWildMap('4711'), generateWildMap('4711'));
  assert.notDeepEqual(generateWildMap('4711').playerStart, generateWildMap('4712').playerStart);
  assert.ok(FREE_PLAY.includes('free-wild') && SCENARIOS['free-wild'].map === 'wild');
});

test('generated valleys are playable: resources near home, dry seats, an enemy faction', () => {
  const factions = new Set();
  for (const seed of ['101', '2024', '31337', '77', '90210', '5']) {
    const sim = newSim({ seed, scenarioId: 'free-wild' });
    const k = keep(sim);
    assert.ok(k, `seed ${seed}: a Keep`);
    const t = sim.terrain;
    assert.equal(t.map.id, 'wild');
    assert.ok(!t.isWater(k.x, k.z) && !t.isWater(t.map.enemyCamp.x, t.map.enemyCamp.z), `seed ${seed}: seats on dry land`);
    assert.ok(near(sim, 'tree', k, 60), `seed ${seed}: forest near home`);
    assert.ok(near(sim, 'rock', k, 55), `seed ${seed}: rock near home`);
    assert.ok(near(sim, 'iron', k, 60), `seed ${seed}: iron near home`);
    assert.ok(t.nearestWater(k.x, k.z, 75), `seed ${seed}: water for a fisher`);
    const hall = all(sim.world, 'building').find((b) => b.type === enemyFaction(sim.world).hall);
    assert.ok(hall, `seed ${seed}: the enemy seat stands`);
    assert.ok(all(sim.world, 'building').filter((b) => b.type === 'cottage').length >= 1, `seed ${seed}: home cottages`);
    factions.add(sim.world.ai.faction);
  }
  assert.ok(factions.size >= 2, 'different seeds meet different lords');
});

test('a random-map game saves, loads onto the same valley and plays on', () => {
  const a = newSim({ seed: '2024', scenarioId: 'free-wild' });
  createBot(a).play(1500);
  const { world } = deserializeWorld(serializeWorld(a.world, 'wild'));
  const b = newSim({ seed: '999', world });
  assert.equal(b.terrain.map.seed, '2024', 'the terrain follows the saved seed');
  b.replaceWorld(world); // as a load does: modules rebuild their derived state
  assert.equal(b.hash(), a.hash());
  for (let i = 0; i < 300; i++) { a.step(); b.step(); }
  assert.equal(b.hash(), a.hash());
});
