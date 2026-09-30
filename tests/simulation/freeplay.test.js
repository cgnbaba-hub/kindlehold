// Free play: every campaign map without story, won by breaking the enemy seat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../../src/app/simulation.js';
import { all } from '../helpers/sim.js';
import { enemyFaction } from '../../src/ai/factions.js';
import { SCENARIOS, FREE_PLAY, CAMPAIGN } from '../../src/missions/index.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';
import { log } from '../../src/core/logger.js';
import { dealDamage } from '../../src/combat/index.js';

log.setConsoleLevel('error');

test('free play offers every map against its own faction', () => {
  // (the random map draws its faction by lot from the seed)
  const want = { 'free-harrowmere': ['harrowmere', 'rustfang'], 'free-saltmere': ['saltmere', 'varr'], 'free-whitehart': ['whitehart', 'stag'], 'free-ironmarch': ['ironmarch', 'morrow'], 'free-wild': ['wild', null] };
  assert.deepEqual(FREE_PLAY, Object.keys(want));
  for (const id of FREE_PLAY) {
    assert.ok(!CAMPAIGN.includes(id), 'free play is not a chapter');
    const sim = createSimulation({ seed: 3, difficulty: 'normal', scenarioId: id });
    sim.step();
    const w = sim.world;
    assert.equal(sim.terrain.map.id, want[id][0], id);
    if (want[id][1]) assert.equal(enemyFaction(w).id, want[id][1], id);
    assert.ok(w.mission.flags.keepLit, 'the hearth already burns');
    assert.ok(all(w, 'unit').some((u) => u.type === 'maren'));
    assert.ok(all(w, 'building').some((b) => b.type === enemyFaction(w).hall && b.owner === 'p2'));
  }
});

test('free play is won by destroying the enemy seat, and saves and loads', () => {
  const sim = createSimulation({ seed: 4, difficulty: 'story', scenarioId: 'free-saltmere' });
  sim.run(40);
  const doc = deserializeWorld(serializeWorld(sim.world));
  assert.equal(doc.world.meta.scenarioId, 'free-saltmere');
  const hall = SCENARIOS['free-saltmere'].objectives.at(-1).completeWhen.destroyed;
  assert.equal(hall, 'varrkeep');
  sim.run(200);
  assert.equal(sim.world.mission.result, null, 'no early end');
  for (const b of all(sim.world, 'building')) if (b.type === hall) dealDamage(sim.world, null, b, 1e6, 'siege');
  sim.run(60);
  assert.equal(sim.world.mission.result, 'victory');
});
