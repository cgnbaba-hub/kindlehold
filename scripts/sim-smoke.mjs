// quick headless smoke run: node scripts/sim-smoke.mjs [ticks]
import { createSimulation } from '../src/app/simulation.js';
import { all } from '../src/world/world.js';
const t0 = performance.now();
const sim = createSimulation({ seed: 1337 });
console.log('setup ms', (performance.now() - t0).toFixed(0), 'entities', Object.keys(sim.world.entities).length, 'deposits', all(sim.world,'deposit').length);
sim.issue({ type: 'rekindle' });
const n = Number(process.argv[2] || 2400);
const t1 = performance.now();
sim.run(n);
console.log('ticks', n, 'ms/tick', ((performance.now() - t1) / n).toFixed(3));
const p = sim.world.players.p1;
console.log('res', p.res, 'pop', p.pop, '/', p.popCap, 'stab', p.stability.toFixed(1));
console.log('objectives', sim.world.mission.objectives.map(o => o.id + ':' + o.state).join(' '));
console.log('health', sim.host.health().filter(h => h.status !== 'ok').map(h => h.id + ':' + h.status + ':' + h.lastError));
console.log('hash', sim.hash());
