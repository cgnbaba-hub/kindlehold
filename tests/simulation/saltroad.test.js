// Chapter 4: a new map (Saltmere), a new enemy (the Legion of Varr) and salt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../../src/app/simulation.js';
import { all } from '../helpers/sim.js';
import { createBuildingEntity } from '../../src/construction/index.js';
import { enemyFaction } from '../../src/ai/factions.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';
import { findSpot } from '../../src/demo/bot.js';
import { log } from '../../src/core/logger.js';

log.setConsoleLevel('error');
const chapter4 = () => createSimulation({ seed: 11, difficulty: 'normal', scenarioId: 'saltroad' });

test('chapter four is played on the Saltmere against the Legion of Varr', () => {
  const sim = chapter4();
  sim.step();
  const w = sim.world;
  assert.equal(sim.terrain.map.id, 'saltmere');
  assert.ok(sim.terrain.waterDepth(40, 72) > 0.5, 'the salt lake is water');
  assert.equal(enemyFaction(w).id, 'varr');
  assert.equal(w.players.p2.name, 'Legion of Varr');
  assert.ok(all(w, 'building').some((b) => b.type === 'varrkeep'));
  assert.ok(all(w, 'building').filter((b) => b.type === 'varrtower').length >= 4);
  assert.ok(all(w, 'unit').some((u) => u.type === 'ysolde'));
  assert.ok(!all(w, 'building').some((b) => b.type === 'warhall' || b.type === 'brigandhall'), 'no Rustfang, no Greyfen here');
  assert.equal(all(w, 'deposit').filter((d) => d.type === 'salt').length, 6);
  const keep = all(w, 'building').find((b) => b.type === 'keep');
  assert.ok(!keep.lit, 'the waystation must be rekindled');
  const vets = all(w, 'unit').filter((u) => u.owner === 'p1' && (u.rank || 0) >= 1);
  assert.equal(vets.length, 2, 'two veterans of the winter war came along');
  // the Legion musters its own troops
  sim.run(20 * 90);
  assert.ok(all(w, 'unit').some((u) => u.owner === 'p2' && ['varrspear', 'varrbow', 'varrknight'].includes(u.type)));
  assert.ok(!all(w, 'unit').some((u) => u.type === 'reaver'));
});

test('a Salt Works by a salt pan turns salt into Taler', () => {
  const sim = chapter4();
  sim.issue({ type: 'rekindle' });
  sim.step();
  const w = sim.world;
  const spot = findSpot(w, sim.services, 'saltworks', -94, 36, 14);
  assert.ok(spot, 'a valid spot near the brine pools by Lanternford');
  const far = findSpot(w, sim.services, 'saltworks', -110, 5, 6);
  assert.equal(far, null, 'not away from the pans');
  const b = createBuildingEntity(w, { type: 'saltworks', owner: 'p1', x: spot.x, z: spot.z, rot: 0, state: 'active' });
  sim.services.nav.rebuildDynamic();
  let made = 0;
  for (let i = 0; i < 20 * 120 && made < 6; i++) { sim.step(); made = w.stats.produced.taler; }
  assert.ok(made >= 6, `salt sold (${made} Taler)`);
  const pan = all(w, 'deposit').find((d) => d.type === 'salt');
  assert.equal(pan.amount, pan.maxAmount, 'salt pans never run dry');
  assert.ok(all(w, 'settler').some((s) => s.job === 'salter'));
  void b;
});

test('chapter four saves and loads onto the right map', () => {
  const sim = chapter4();
  sim.run(40);
  const back = deserializeWorld(serializeWorld(sim.world)).world;
  const sim2 = createSimulation({ world: back });
  assert.equal(sim2.terrain.map.id, 'saltmere');
  assert.equal(enemyFaction(sim2.world).id, 'varr');
  assert.equal(sim2.hash(), sim.hash());
});
