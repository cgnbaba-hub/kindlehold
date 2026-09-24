import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim } from '../helpers/sim.js';
import { createBot } from '../../src/demo/bot.js';

function playHash(seed, ticks) {
  const sim = newSim({ seed });
  const bot = createBot(sim);
  bot.play(ticks);
  return { hash: sim.hash(), commands: sim.commandLog.length };
}

test('same seed + same commands => identical world hash', () => {
  const a = playHash(1337, 4000);
  const b = playHash(1337, 4000);
  assert.equal(a.hash, b.hash);
  assert.ok(a.commands > 5, 'bot issued commands');
});

test('different seed => different world', () => {
  assert.notEqual(playHash(1337, 400).hash, playHash(99, 400).hash);
});

test('replaying a recorded command log reproduces the outcome', () => {
  const sim = newSim({ seed: 5 });
  const bot = createBot(sim);
  bot.play(3000);
  const expected = sim.hash();
  const log = sim.commandLog.slice();
  const replay = newSim({ seed: 5 });
  let i = 0;
  while (replay.world.tick < 3000) {
    // commands recorded at tick t were issued during tick t-1
    while (i < log.length && log[i].tick === replay.world.tick + 1) replay.issue(log[i++].cmd);
    replay.step();
  }
  assert.equal(replay.hash(), expected);
});
