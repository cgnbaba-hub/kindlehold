// First-time tips: each fires when its situation first occurs, in list order, and only once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, place, grant } from '../helpers/sim.js';
import { completeBuilding } from '../../src/construction/index.js';
import { TIPS, nextTip } from '../../src/ui/tips.js';
import { sanitizeSettings } from '../../src/app/settings.js';

test('tips have unique ids and the settings keep only valid seen ids', () => {
  assert.equal(new Set(TIPS.map((t) => t.id)).size, TIPS.length);
  const s = sanitizeSettings({ seenTips: ['carriers', 'Bad Id!', 3, 'raid'] });
  assert.deepEqual(s.seenTips, ['carriers', 'raid']);
  assert.deepEqual(sanitizeSettings(null).seenTips, []);
});

test('a fresh game shows no tip; goods waiting for carriers show the carriers tip once', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, { timber: 400, stone: 300, provisions: 300 });
  sim.world.time.hour = 10;
  sim.step();
  assert.equal(nextTip(sim.world, 'p1', []), null);
  const k = keep(sim);
  const lodge = place(sim, 'lodge', k.x - 16, k.z + 6);
  completeBuilding(sim.world, lodge);
  lodge.stall = 'storageFull';
  assert.equal(nextTip(sim.world, 'p1', []).id, 'carriers');
  assert.equal(nextTip(sim.world, 'p1', ['carriers']), null);
});

test('hunger comes before everything else, and the raid warning brings the army tip', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  for (let i = 0; i < 1300; i++) sim.step();
  sim.world.players.p1.res.provisions = 0;
  sim.world.mission.flags.raidWarned = true;
  assert.equal(nextTip(sim.world, 'p1', []).id, 'hunger');
  assert.equal(nextTip(sim.world, 'p1', ['hunger', 'housing']).id, 'raid');
  const raid = TIPS.find((t) => t.id === 'raid');
  assert.equal(raid.action[0], 'build:army');
});
