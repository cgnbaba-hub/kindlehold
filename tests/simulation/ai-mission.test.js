import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, byType, units, all } from '../helpers/sim.js';
import { createBot } from '../../src/demo/bot.js';
import { AI_DIFFICULTY } from '../../src/ai/index.js';
import { UNITS } from '../../src/units/defs.js';
import { remove } from '../../src/world/world.js';

test('raid warning schedules a wave that targets a player building', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  sim.world.mission.raidWarningTick = 10;
  let wave = null;
  sim.bus.on('ai:wave', (w) => { wave = w; });
  for (let i = 0; i < 20; i++) sim.step();
  assert.ok(sim.world.mission.flags.raidWarned);
  assert.equal(sim.world.ai.raidTick, 10 + AI_DIFFICULTY.normal.raidDelay * 20);
  let gathered = null;
  sim.bus.on('ai:gather', (g) => { gathered = g; });
  const limit = sim.world.ai.raidTick + 20 * 140;
  while (!wave && sim.world.tick < limit) sim.step();
  assert.ok(gathered, 'raiders gathered visibly before marching');
  assert.ok(wave, 'wave launched');
  assert.ok(wave.size > 0 && wave.size <= AI_DIFFICULTY.normal.firstRaid, `raid size ${wave.size} comes from the garrison`);
  const target = sim.world.entities[wave.target];
  assert.equal(target.owner, 'p1');
  const raiders = sim.world.ai.raidIds.map((id) => sim.world.entities[id]);
  assert.ok(raiders.every((u) => u.order.type === 'attackMove'));
});

test('raiders retreat when the wave is broken', () => {
  const sim = newSim();
  sim.world.mission.raidWarningTick = 1;
  for (let i = 0; i < 5; i++) sim.step();
  sim.world.ai.raidTick = sim.world.tick + 1;
  for (let i = 0; i < 20 * 25 && sim.world.ai.state !== 'raid'; i++) sim.step();
  assert.equal(sim.world.ai.state, 'raid');
  const ids = sim.world.ai.raidIds.slice();
  for (const id of ids.slice(0, Math.ceil(ids.length * 0.7))) remove(sim.world, id, 'test');
  for (let i = 0; i < 30; i++) sim.step();
  assert.equal(sim.world.ai.state, 'retreat');
  const survivors = sim.world.ai.raidIds.map((id) => sim.world.entities[id]);
  assert.ok(survivors.every((u) => u.retreating && u.order.type === 'move'));
});

test('destroying the Warhall wins; losing the Keep loses', () => {
  const sim = newSim();
  const hall = byType(sim, 'warhall')[0];
  let ended = null;
  sim.bus.on('mission:ended', (e) => { ended = e; });
  hall.hp = 0; hall.state = 'destroyed';
  for (let i = 0; i < 12; i++) sim.step();
  assert.deepEqual(ended, { result: 'victory', reason: 'warhall-destroyed' });

  const sim2 = newSim();
  let ended2 = null;
  sim2.bus.on('mission:ended', (e) => { ended2 = e; });
  const k = keep(sim2);
  k.hp = 0; k.state = 'destroyed';
  for (let i = 0; i < 12; i++) sim2.step();
  assert.equal(ended2.result, 'defeat');
});

test('difficulty changes starting resources and raid size', () => {
  const s = newSim({ difficulty: 'story' }), h = newSim({ difficulty: 'hard' });
  assert.ok(s.world.players.p1.res.timber > h.world.players.p1.res.timber);
  assert.ok(AI_DIFFICULTY.hard.firstRaid > AI_DIFFICULTY.story.firstRaid);
  const brute = units(h, 'p2').find((u) => u.type === 'brute');
  assert.equal(brute.maxHp, Math.round(UNITS.brute.hp * 1.1), 'documented Hard HP bonus');
});

test('full vertical slice: scripted player wins the scenario on Normal', () => {
  const sim = newSim();
  const bot = createBot(sim);
  const result = bot.play(40 * 1200);
  const sum = bot.summary();
  assert.equal(result, 'victory', JSON.stringify(sum.objectives));
  // the bot's pace varies by several minutes with small economy changes; it plays at most 40
  assert.ok(sum.minutes >= 12 && sum.minutes <= 40, `match length ${sum.minutes} min`);
  for (const id of ['rekindle', 'timber-food', 'growth', 'stone-iron', 'arms', 'survive', 'strike']) {
    assert.ok(sum.objectives.some((o) => o.startsWith(`${id}:done`)), `objective ${id} done`);
  }
  assert.ok(sim.host.health().every((h) => h.status === 'ok'), 'no module failed');
});
