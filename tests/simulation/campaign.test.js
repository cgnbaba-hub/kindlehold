// Level 3: the campaign — chapter setups, story events, win conditions and campaign memory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../../src/app/simulation.js';
import { all } from '../helpers/sim.js';
import { remove } from '../../src/world/world.js';
import { SCENARIOS, CAMPAIGN } from '../../src/missions/index.js';
import { stance } from '../../src/diplomacy/index.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';
import { log } from '../../src/core/logger.js';

log.setConsoleLevel('error');
const chapter = (id, extra = {}) => createSimulation({ seed: 7, difficulty: 'normal', scenarioId: id, ...extra });

test('the campaign has four chapters with objectives and endings', () => {
  assert.deepEqual(CAMPAIGN, ['harrowmere', 'greyfen', 'tollbreaker', 'saltroad']);
  for (const id of CAMPAIGN) {
    const sc = SCENARIOS[id];
    assert.ok(sc.objectives.length >= 3, id);
    assert.ok(sc.victory.title && sc.defeat.title, id);
    for (const o of sc.objectives) assert.ok(o.completeWhen && o.activeWhen, `${id}/${o.id}`);
  }
});

test('chapter two starts in an established town', () => {
  const sim = chapter('greyfen');
  sim.step();
  const w = sim.world;
  assert.equal(w.meta.scenarioId, 'greyfen');
  const keep = all(w, 'building').find((b) => b.type === 'keep');
  assert.equal(keep.level, 2);
  assert.ok(keep.lit);
  const mine = all(w, 'building').filter((b) => b.owner === 'p1' && b.type !== 'keep');
  assert.ok(mine.length >= 10, `town buildings: ${mine.length}`);
  assert.ok(mine.every((b) => b.state === 'active'));
  assert.equal(all(w, 'settler').length, 16);
  assert.equal(all(w, 'unit').filter((u) => u.owner === 'p1' && !u.hero).length, 5);
  assert.ok(w.players.p1.techs.axes);
  assert.ok(w.ai.mods && w.ai.mods.reserves > 1);
  // workers take up their jobs in the prebuilt workshops
  sim.run(20 * 20);
  assert.ok(all(w, 'settler').some((s) => s.job === 'forester'));
});

test('story events fire once; chapter two is only won with the Greyfen question settled', () => {
  const sim = chapter('greyfen');
  sim.run(2 * 1200 + 20);
  const w = sim.world;
  assert.ok(w.mission.triggers['wren-south'], 'the two-minute story beat fired');
  const n = w.mission.messages.length;
  sim.run(100);
  assert.equal(w.mission.messages.filter((m) => /Smoke over Millbrook/.test(m.text)).length, 1);
  assert.ok(w.mission.messages.length >= n);
  // burning the warhall alone is not enough in this chapter
  const hall = all(w, 'building').find((b) => b.type === 'warhall');
  hall.state = 'destroyed';
  sim.run(20);
  assert.equal(w.mission.result, null);
  const bh = all(w, 'building').find((b) => b.type === 'brigandhall');
  const obj = w.mission.objectives.find((o) => o.id === 'greyfen');
  obj.state = 'active';
  bh.state = 'destroyed';
  sim.run(40);
  assert.equal(w.mission.result, 'victory');
});

test('chapter three remembers chapter two', () => {
  const allied = chapter('tollbreaker', { campaign: { greyfen: 'allied' } });
  allied.step();
  assert.equal(stance(allied.world, 'p1', 'p3'), 'allied');
  const gone = chapter('tollbreaker', { campaign: { greyfen: 'defeated' } });
  gone.step();
  assert.ok(!all(gone.world, 'building').some((b) => b.type === 'brigandhall'), 'no Greyfen hold after it fell');
  assert.ok(all(gone.world, 'building').filter((b) => b.type === 'reavertower').length >= 4, 'the fort is stronger');
  const json = serializeWorld(gone.world);
  const back = deserializeWorld(json).world;
  assert.equal(back.meta.campaign.greyfen, 'defeated');
  assert.equal(back.meta.scenarioId, 'tollbreaker');
});

test('chapter three: Vharek marches in after his host breaks; he must fall and his hall burn', () => {
  const sim = chapter('tollbreaker');
  sim.step();
  const w = sim.world;
  assert.ok(!all(w, 'unit').some((u) => u.type === 'vharek'), 'Vharek leads the host himself and comes later');
  w.mission.flags.raidWarned = true;
  w.ai.wave = 3;
  sim.run(40);
  const vharek = all(w, 'unit').find((u) => u.type === 'vharek');
  assert.ok(vharek, 'the Tollbreaker arrives');
  assert.equal(vharek.order.type, 'attackMove');
  assert.ok(all(w, 'unit').filter((u) => u.host).length >= 12, 'with his bodyguard');
  all(w, 'building').find((b) => b.type === 'warhall').state = 'destroyed';
  sim.run(20);
  assert.equal(w.mission.result, null, 'not while he lives');
  remove(w, vharek.id, 'test');
  sim.run(40);
  assert.equal(w.mission.result, 'victory');
});
