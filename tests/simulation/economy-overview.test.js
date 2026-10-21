// The economy window names what holds the town back: hunger, missing carriers, missing workers,
// missing inputs, goods running out; and says nothing is wrong when nothing is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, place, grant, all } from '../helpers/sim.js';
import { completeBuilding } from '../../src/construction/index.js';
import { economyOverview } from '../../src/economy/overview.js';

function town() {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, { timber: 400, stone: 300, provisions: 300 });
  sim.world.time.hour = 10;
  sim.step();
  return sim;
}
const texts = (o) => o.bottlenecks.map((b) => b.text).join(' | ');

test('a quiet town has no bottleneck', () => {
  const sim = town();
  const o = economyOverview(sim.world, 'p1', {});
  assert.ok(!o.bottlenecks.some((b) => b.level !== 'info'), texts(o));
  assert.ok(o.carriers.labourers > 0 && o.carriers.awake <= o.carriers.labourers);
});

test('hunger comes first', () => {
  const sim = town();
  sim.world.players.p1.res.provisions = 0;
  const o = economyOverview(sim.world, 'p1', {});
  assert.equal(o.bottlenecks[0].level, 'danger');
  assert.match(o.bottlenecks[0].text, /Food runs short/);
});

test('goods waiting with nobody free to fetch them: carriers are named, with what helps', () => {
  const sim = town();
  const k = keep(sim);
  const a = place(sim, 'lodge', k.x - 16, k.z + 6), b = place(sim, 'quarry', k.x + 16, k.z + 6);
  completeBuilding(sim.world, a); completeBuilding(sim.world, b);
  a.stall = 'storageFull'; b.stall = 'storageFull';
  for (const s of all(sim.world, 'settler')) if (!s.job) s.task = { type: 'haul', from: a.id, stage: 'toBuilding', amt: 1 };
  const o = economyOverview(sim.world, 'p1', {});
  const c = o.bottlenecks.find((x) => /Carriers are the bottleneck/.test(x.text));
  assert.ok(c, texts(o));
  assert.deepEqual([...c.ids].sort(), [a.id, b.id].sort());
  assert.match(c.text, /Storehouse|roads|Donkey Stable/);
});

test('missing inputs are grouped by the good, and stores running out are named', () => {
  const sim = town();
  const k = keep(sim);
  grant(sim, { timber: 400, stone: 400 });
  const bk = place(sim, 'bakery', k.x + 16, k.z + 6);
  completeBuilding(sim.world, bk);
  bk.stall = 'noInput';
  sim.world.players.p1.res.timber = 10;
  const o = economyOverview(sim.world, 'p1', { timber: -12 });
  assert.match(texts(o), /Bakery waits for flour/);
  assert.match(texts(o), /Timber runs out: -12\/min and 10 left/);
});
