// Free play against a rival town: a second Warden (p4) founds a town where the lord's seat would
// stand, grows it through the same commands as the player, keeps its own tallies and marches on
// the player's Keep.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, all } from '../helpers/sim.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';
import { destroyBuilding } from '../../src/construction/index.js';
import { RIVAL_DIFFICULTY } from '../../src/rival/defs.js';
import { warhallOf } from '../../src/ai/index.js';

const rivalSim = (difficulty = 'normal', seed = 7) => newSim({ scenarioId: 'free-harrowmere-rival', difficulty, seed });
const mine = (sim, owner, kind) => all(sim.world, kind).filter((e) => e.owner === owner && e.state !== 'destroyed');

test('the rival founds a town with towers where the seat would stand; there is no seat', () => {
  for (const d of ['story', 'normal', 'hard']) {
    const sim = rivalSim(d);
    const b = mine(sim, 'p4', 'building');
    const keep = b.find((x) => x.type === 'keep');
    assert.ok(keep && keep.lit, `${d}: a lit rival Keep`);
    assert.equal(b.filter((x) => x.type === 'cottage').length, 2, `${d}: two cottages`);
    assert.equal(b.filter((x) => x.type === 'tower').length, RIVAL_DIFFICULTY[d].towers, `${d}: towers`);
    assert.equal(mine(sim, 'p4', 'unit').filter((u) => u.type === 'warden').length, RIVAL_DIFFICULTY[d].hero ? 1 : 0, `${d}: a Warden of its own on Hard`);
    assert.ok(mine(sim, 'p4', 'settler').length >= 9, `${d}: first families`);
    assert.equal(warhallOf(sim.world), null, `${d}: no lord's seat`);
    // wood, stone and iron in reach of the rival's Keep
    for (const [type, r] of [['tree', 38], ['rock', 46], ['iron', 30]]) {
      assert.ok(all(sim.world, 'deposit').some((p) => p.type === type && Math.hypot(p.x - keep.x, p.z - keep.z) < r), `${d}: ${type} near the rival`);
    }
  }
});

test('the rival grows its own town and keeps its own tallies', () => {
  const sim = rivalSim();
  for (let i = 0; i < 20 * 60 * 8; i++) sim.step();
  const b = mine(sim, 'p4', 'building').filter((x) => x.state === 'active');
  assert.ok(b.length >= 8, `the rival built (${b.map((x) => x.type).join(' ')})`);
  assert.ok(b.some((x) => x.type === 'lodge') && b.some((x) => x.type === 'farm'), 'timber and food');
  assert.ok(sim.world.players.p4.stats.produced.timber > 0, 'the rival counts its own timber');
});

test('a game against a rival continues identically after a save', () => {
  const a = rivalSim();
  for (let i = 0; i < 20 * 60 * 4; i++) a.step();
  const { world } = deserializeWorld(serializeWorld(a.world, 'rival'));
  const b = newSim({ scenarioId: 'free-harrowmere-rival' });
  b.replaceWorld(world);
  assert.equal(b.hash(), a.hash());
  for (let i = 0; i < 20 * 60 * 2; i++) { a.step(); b.step(); }
  assert.equal(b.hash(), a.hash(), 'identical two minutes later');
});

test('the rival takes no gifts, and taking its Keep wins the game', () => {
  const sim = rivalSim();
  sim.world.players.p1.res.taler = 500;
  sim.issue({ type: 'gift', to: 'p4' });
  sim.step();
  assert.equal(sim.world.players.p1.res.taler, 500, 'no gift taken');
  const keep = mine(sim, 'p4', 'building').find((x) => x.type === 'keep');
  destroyBuilding(sim.world, keep, 'p1');
  for (let i = 0; i < 40 && !sim.world.mission.result; i++) sim.step();
  assert.equal(sim.world.mission.result, 'victory');
});

test('a rival marches on a town that does not defend itself', () => {
  const sim = rivalSim('normal', 11);
  let alerted = false;
  sim.bus.on('alert', (d) => { if (/marches on you/.test(d.text)) alerted = true; });
  for (let i = 0; i < 20 * 60 * 32 && !sim.world.mission.result; i++) sim.step();
  assert.ok(sim.world.rival.waves >= 1, `the rival attacked (${JSON.stringify(sim.world.rival)})`);
  assert.ok(alerted, 'the player is warned');
  // it lays roads like a player, and none of them is the player's to take back
  assert.ok(sim.world.roads && sim.world.roads.cells.length > 0, 'the rival paved roads');
  assert.ok(!sim.world.roads.last || sim.world.roads.last.owner === 'p1');
});
