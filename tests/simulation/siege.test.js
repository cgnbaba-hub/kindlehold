// The Siege Yard (Barracks level 3): Ballista and Mangonel — strong at range, helpless up close.
// Fights are staged in open country, out of reach of the Keep's archers and its healing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, place, runUntil, grant, all } from '../helpers/sim.js';
import { levelOf } from '../../src/buildings/defs.js';
import { spawnUnit } from '../../src/units/sim.js';
import { spawnEnemy } from '../../src/ai/index.js';

function quiet(sim) {
  sim.world.ai.nextSpawnTick = 1e9; sim.world.ai.nextScoutTick = 1e9; sim.world.ai.nextHarassTick = 1e9;
  sim.world.mission.raidWarningTick = 1e9;
}
const hold = (u) => { u.order = { type: 'hold', ax: u.x, az: u.z }; return u; };

test('the Siege Yard needs the Castle and tools, and only it trains engines', () => {
  const sim = newSim();
  quiet(sim);
  sim.issue({ type: 'rekindle' });
  grant(sim, { timber: 999, stone: 999, iron: 999, provisions: 999, taler: 999, tools: 10 });
  const k = keep(sim);
  const b = place(sim, 'barracks', k.x + 20, k.z + 10);
  runUntil(sim, () => b.state === 'active', 20 * 300);
  const rejected = [];
  sim.bus.on('command:rejected', (r) => rejected.push(r.reason));
  sim.issue({ type: 'recruit', building: b.id, unitType: 'ballista' });
  sim.step();
  assert.match(rejected.pop() || '', /Siege Yard/);
  b.level = 2;
  sim.issue({ type: 'upgrade', id: b.id });
  sim.step();
  assert.ok(!b.upgrade, 'refused without the Castle');
  k.level = 2;
  sim.issue({ type: 'upgrade', id: b.id });
  runUntil(sim, () => levelOf(b) === 3, 20 * 200);
  assert.equal(levelOf(b), 3);
  sim.issue({ type: 'recruit', building: b.id, unitType: 'mangonel' });
  sim.step();
  assert.equal(b.queue.length, 1, 'a mangonel is ordered');
});

test('a mangonel boulder hits a whole group; nothing fires closer than its minimum range', () => {
  const sim = newSim();
  quiet(sim);
  for (const u of all(sim.world, 'unit').slice()) if (u.owner !== 'p1') u.order = { type: 'hold', ax: u.x, az: u.z };
  const m = hold(spawnUnit(sim.world, 'mangonel', 'p1', 10, 40));
  const group = [[10, 58], [8.8, 58.6], [11.2, 58.4], [10, 59.4]].map(([x, z]) => { const e = hold(spawnEnemy(sim.world, 'reaver', x, z)); e.cd = 1e9; return e; });
  const hp0 = group.map((e) => e.hp);
  runUntil(sim, () => group.filter((e, i) => e.hp < hp0[i]).length >= 3, 20 * 12);
  assert.ok(group.filter((e, i) => e.hp < hp0[i] || !sim.world.entities[e.id]).length >= 3, 'three or more hurt by the same volleys');
  // an enemy right next to it is safe from it
  const close = hold(spawnEnemy(sim.world, 'reaver', m.x + 3, m.z));
  close.cd = 1e9;
  for (const e of group) if (sim.world.entities[e.id]) { e.x = e.px = 200; e.z = e.pz = 200; }
  const hpClose = close.hp;
  sim.run(20 * 12);
  assert.equal(close.hp, hpClose, 'no shot at 3 m');
});

test('blades make short work of an unguarded ballista', () => {
  const sim = newSim();
  quiet(sim);
  const b = hold(spawnUnit(sim.world, 'ballista', 'p1', 10, 40));
  const r = spawnEnemy(sim.world, 'reaver', 10, 42);
  r.order = { type: 'attack', target: b.id, ax: r.x, az: r.z }; r.target = b.id;
  runUntil(sim, () => !sim.world.entities[b.id], 20 * 40);
  assert.ok(!sim.world.entities[b.id], 'the engine is wrecked');
  assert.ok(sim.world.entities[r.id] && r.hp > 60, 'the raider barely scratched');
});
