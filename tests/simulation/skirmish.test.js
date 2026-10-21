// Free-play setup: the choices from the setup screen shape the start, survive a save and never
// reach the campaign.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim } from '../helpers/sim.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';
import { SKIRMISH_GOODS, SKIRMISH_PEACE, sanitizeSkirmish, cleanSeed } from '../../src/missions/skirmish.js';

const free = (skirmish, extra = {}) => newSim({ scenarioId: 'free-wild', seed: 'vale-7', skirmish, ...extra });

test('without choices a free game starts as before', () => {
  const a = free(null), b = free({ goods: 'standard', peace: 'standard', faction: 'random' });
  assert.deepEqual(b.world.players.p1.res, a.world.players.p1.res);
  assert.equal(b.world.mission.raidWarningTick, a.world.mission.raidWarningTick);
  assert.equal(b.world.ai.faction, a.world.ai.faction);
});

test('starting goods scale the store, peace time the first warning and the first plunderers', () => {
  const std = free(null), rich = free({ goods: 'rich' }), lean = free({ goods: 'lean' });
  for (const r of ['timber', 'stone', 'provisions']) {
    const s = std.world.players.p1.res[r];
    assert.ok(Math.abs(rich.world.players.p1.res[r] - s * SKIRMISH_GOODS.rich.mult) <= 1, `${r}: rich`);
    assert.ok(Math.abs(lean.world.players.p1.res[r] - s * SKIRMISH_GOODS.lean.mult) <= 1, `${r}: lean`);
  }
  const long = free({ peace: 'long' }), short = free({ peace: 'short' });
  assert.equal(long.world.mission.raidWarningTick, Math.round(std.world.mission.raidWarningTick * SKIRMISH_PEACE.long.mult));
  assert.equal(short.world.mission.raidWarningTick, Math.round(std.world.mission.raidWarningTick * SKIRMISH_PEACE.short.mult));
  assert.ok(long.world.ai.nextHarassTick > short.world.ai.nextHarassTick, 'plunderers come later in a long peace');
});

test('the lord of a random valley can be picked; fixed maps and the campaign keep theirs', () => {
  for (const f of ['rustfang', 'varr', 'stag', 'morrow']) assert.equal(free({ faction: f }).world.ai.faction, f);
  const fixed = newSim({ scenarioId: 'free-saltmere', skirmish: { faction: 'stag' } });
  assert.equal(fixed.world.ai.faction, 'varr', 'the Saltmere keeps the Manor of Varr');
  const chapter = newSim({ scenarioId: 'harrowmere', skirmish: { goods: 'rich' } });
  assert.equal(chapter.world.meta.skirmish, undefined, 'no setup choices in the campaign');
});

test('the choices survive a save; unknown values fall back to the defaults', () => {
  const a = free({ goods: 'rich', peace: 'short', faction: 'morrow' });
  const { world } = deserializeWorld(serializeWorld(a.world, 'sk'));
  assert.deepEqual(world.meta.skirmish, { goods: 'rich', peace: 'short', faction: 'morrow' });
  assert.deepEqual(sanitizeSkirmish({ goods: 'huge', peace: 1, faction: 'elves' }), { goods: 'standard', peace: 'standard', faction: 'random' });
  assert.equal(cleanSeed('  my <valley> 42 '), 'myvalley42');
  assert.equal(cleanSeed('   '), null);
});
