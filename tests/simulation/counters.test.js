// The counter triangle taught by the tutorial must hold in real 6v6 fights.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, units } from '../helpers/sim.js';
import { spawnUnit } from '../../src/units/sim.js';
import { spawnEnemy } from '../../src/ai/index.js';
import { remove } from '../../src/world/world.js';

function fight(p, e, n = 6) {
  const sim = newSim({ seed: 9 });
  for (const u of units(sim, 'p1').concat(units(sim, 'p2')).slice()) remove(sim.world, u.id);
  sim.world.ai.nextSpawnTick = 1e9; sim.world.ai.nextScoutTick = 1e9; sim.world.mission.raidWarningTick = 1e9;
  const ps = [], es = [];
  for (let i = 0; i < n; i++) {
    ps.push(spawnUnit(sim.world, p, 'p1', -30 + (i % 3) * 1.8, 30 + Math.floor(i / 3) * 1.8));
    es.push(spawnEnemy(sim.world, e, -30 + (i % 3) * 1.8, 6 + Math.floor(i / 3) * 1.8));
  }
  sim.issue({ type: 'attackMove', ids: ps.map((u) => u.id), x: -30, z: 6 });
  for (const u of es) u.order = { type: 'attackMove', x: -30, z: 30, ax: u.x, az: u.z };
  for (let t = 0; t < 20 * 120; t++) {
    sim.step();
    if (!ps.some((u) => sim.world.entities[u.id]) || !es.some((u) => sim.world.entities[u.id])) break;
  }
  return { player: ps.filter((u) => sim.world.entities[u.id]).length, enemy: es.filter((u) => sim.world.entities[u.id]).length };
}

const wins = [['shield', 'reaver'], ['blade', 'slinger'], ['fletcher', 'brute']];
const losses = [['blade', 'brute'], ['fletcher', 'reaver'], ['shield', 'slinger']];
for (const n of [6, 10]) {
  for (const [p, e] of wins) test(`${p} beats ${e} (counter, ${n}v${n})`, () => { const r = fight(p, e, n); assert.ok(r.player > 0 && r.enemy === 0, JSON.stringify(r)); });
  for (const [p, e] of losses) test(`${p} loses to ${e} (countered, ${n}v${n})`, () => { const r = fight(p, e, n); assert.ok(r.player === 0 && r.enemy > 0, JSON.stringify(r)); });
}
