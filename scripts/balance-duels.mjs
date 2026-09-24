// Squad duel harness: N vs N of every player/enemy pairing on open ground.
// node scripts/balance-duels.mjs [n=6]
import { createSimulation } from '../src/app/simulation.js';
import { spawnUnit } from '../src/units/sim.js';
import { spawnEnemy } from '../src/ai/index.js';
import { all, remove } from '../src/world/world.js';
import { log } from '../src/core/logger.js';
log.setConsoleLevel('error');
const N = Number(process.argv[2] || 6);
const P = ['shield', 'blade', 'fletcher'], E = ['brute', 'reaver', 'slinger'];
const rows = [];
for (const p of P) {
  const row = [p];
  for (const e of E) {
    const sim = createSimulation({ seed: 9 });
    for (const u of all(sim.world, 'unit').slice()) remove(sim.world, u.id);
    sim.world.ai.nextSpawnTick = 1e9; sim.world.ai.nextScoutTick = 1e9; sim.world.mission.raidWarningTick = 1e9;
    const ps = [], es = [];
    for (let i = 0; i < N; i++) { ps.push(spawnUnit(sim.world, p, 'p1', -30 + (i % 3) * 1.8, 30 + Math.floor(i / 3) * 1.8)); es.push(spawnEnemy(sim.world, e, -30 + (i % 3) * 1.8, 6 + Math.floor(i / 3) * 1.8)); }
    sim.issue({ type: 'attackMove', ids: ps.map((u) => u.id), x: -30, z: 6 });
    for (const u of es) u.order = { type: 'attackMove', x: -30, z: 30, ax: u.x, az: u.z };
    let t = 0;
    for (; t < 20 * 120; t++) { sim.step(); const a = ps.filter((u) => sim.world.entities[u.id]).length, b = es.filter((u) => sim.world.entities[u.id]).length; if (!a || !b) break; }
    const a = ps.filter((u) => sim.world.entities[u.id]).length, b = es.filter((u) => sim.world.entities[u.id]).length;
    row.push(`${a}-${b} (${(t / 20).toFixed(0)}s)`);
  }
  rows.push(row);
}
console.log(`${N}v${N}`.padEnd(10) + E.map((e) => e.padEnd(16)).join(''));
for (const r of rows) console.log(r[0].padEnd(10) + r.slice(1).map((c) => c.padEnd(16)).join(''));
console.log('expected: shield>reaver(melee), blade>slinger(ranged), fletcher>brute(defensive); mirrors ~even');
