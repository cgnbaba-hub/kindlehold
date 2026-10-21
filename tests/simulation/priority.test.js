// Priority ("Vorrang"): a workshop or site the player marks is served first by workers and
// carriers; only a few at once, fewer on harder difficulties.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, place, grant, all } from '../helpers/sim.js';
import { PRIORITY, completeBuilding } from '../../src/construction/index.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';
import { remove } from '../../src/world/world.js';
import { MIN_FREE_LABOURERS } from '../../src/population/index.js';

function town(difficulty = 'normal') {
  const sim = newSim({ difficulty });
  sim.issue({ type: 'rekindle' });
  grant(sim, { timber: 600, stone: 400, taler: 300, provisions: 200 });
  sim.step();
  return sim;
}

test('only a few buildings can have priority, fewer on Hard', () => {
  assert.ok(PRIORITY.max.hard < PRIORITY.max.normal && PRIORITY.max.normal <= PRIORITY.max.story);
  const sim = town('hard');
  const k = keep(sim);
  const sites = [];
  for (let i = 0; i < 3; i++) sites.push(place(sim, 'cottage', k.x - 14 + i * 12, k.z + 16));
  for (const b of sites) sim.issue({ type: 'setPriority', id: b.id, on: true });
  sim.step();
  assert.equal(sites.filter((b) => b.priority).length, PRIORITY.max.hard);
  sim.issue({ type: 'setPriority', id: sites[0].id, on: false });
  sim.issue({ type: 'setPriority', id: sites[2].id, on: true });
  sim.step();
  assert.deepEqual(sites.map((b) => !!b.priority), [false, true, true]);
  sim.issue({ type: 'setPriority', id: k.id, on: true });
  sim.step();
  assert.ok(!k.priority, 'not the Keep');
});

test('a workshop with priority gets its workers first', () => {
  const sim = town();
  const k = keep(sim);
  const a = place(sim, 'lodge', k.x - 16, k.z + 6), b = place(sim, 'quarry', k.x + 16, k.z + 6);
  completeBuilding(sim.world, a); completeBuilding(sim.world, b);
  // the quarry would come first (stone is scarcer): priority on the lodge turns that round
  sim.world.players.p1.res.timber = 500; sim.world.players.p1.res.stone = 0;
  sim.issue({ type: 'setPriority', id: a.id, on: true });
  // just one settler more than the labourers the town keeps free
  const free = all(sim.world, 'settler').filter((s) => !s.job);
  for (const s of free.slice(MIN_FREE_LABOURERS + 2)) remove(sim.world, s.id);
  for (let i = 0; i < 40; i++) sim.step();
  assert.deepEqual([a.workers.length, b.workers.length], [1, 0], 'the lodge with priority is staffed, the quarry waits');
});

test('carriers bring a site with priority its materials first', () => {
  const run = (prio) => {
    const sim = town();
    const k = keep(sim);
    const near = place(sim, 'cottage', k.x + 10, k.z + 12);
    const far = place(sim, 'cottage', k.x - 22, k.z + 20);
    if (prio) sim.issue({ type: 'setPriority', id: far.id, on: true });
    for (let i = 0; i < 20 * 8; i++) sim.step();
    const got = (b) => Object.values(b.build ? b.build.supplied : { all: 99 }).reduce((t, n) => t + n, 0) + Object.values(b.build ? b.build.incoming : {}).reduce((t, n) => t + n, 0);
    return got(far) - got(near);
  };
  assert.ok(run(true) > run(false), 'the far site gets more with priority');
});

test('priority is kept in a save', () => {
  const sim = town();
  const k = keep(sim);
  const c = place(sim, 'cottage', k.x + 10, k.z + 12);
  sim.issue({ type: 'setPriority', id: c.id, on: true });
  sim.step();
  const { world } = deserializeWorld(serializeWorld(sim.world, 'prio'));
  assert.equal(world.entities[c.id].priority, true);
});
