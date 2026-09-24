import { createSimulation } from '../src/app/simulation.js';
import { createBot } from '../src/demo/bot.js';
import { all } from '../src/world/world.js';
import { log } from '../src/core/logger.js';
log.setConsoleLevel('error');
const sim = createSimulation({ seed: '1337', difficulty: 'normal' });
const bot = createBot(sim);
const checkpoints = (process.argv[2] || '6,10,14').split(',').map(Number);
for (const m of checkpoints) {
  bot.play(m * 1200 - sim.world.tick);
  const w = sim.world;
  const jobs = {}, tasks = {};
  for (const s of all(w, 'settler')) { jobs[s.job || 'labourer'] = (jobs[s.job || 'labourer'] || 0) + 1; if (!s.job) { const k = s.task ? s.task.type + (s.task.stage ? ':' + s.task.stage : '') : 'none'; tasks[k] = (tasks[k] || 0) + 1; } }
  console.log(`--- ${m}m res`, w.players.p1.res, 'produced', w.stats.produced);
  console.log('jobs', jobs, 'labourer tasks', tasks);
  for (const b of all(w, 'building')) if (b.owner === 'p1') console.log(`  ${b.type} ${b.state} workers=${b.workers.length} stall=${b.stall} out=${JSON.stringify(b.stock.out)} in=${JSON.stringify(b.stock.in)} ${b.build ? 'prog=' + b.build.progress.toFixed(2) + ' sup=' + JSON.stringify(b.build.supplied) + ' req=' + JSON.stringify(b.build.required) : ''}`);
}
