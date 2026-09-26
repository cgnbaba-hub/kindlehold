#!/usr/bin/env node
// Balance check: the scripted bot plays full matches on several seeds and difficulties.
// Usage: npm run balance [-- normal:1337 hard:7 ...]   (default: a spread over all difficulties)
import { createSimulation } from '../src/app/simulation.js';
import { createBot } from '../src/demo/bot.js';
import { log } from '../src/core/logger.js';

log.setConsoleLevel('error');
const args = process.argv.slice(2);
const runs = args.length ? args.map((a) => a.split(':')) : [['story', '42'], ['normal', '1337'], ['normal', '7'], ['normal', '42'], ['normal', '99'], ['hard', '7'], ['hard', '42'], ['hard', '99']];
let wins = 0;
for (const [difficulty, seed] of runs) {
  const sim = createSimulation({ seed: Number(seed), difficulty });
  const bot = createBot(sim);
  const result = bot.play(40 * 1200);
  const s = bot.summary();
  const p = sim.world.players.p1;
  if (result === 'victory') wins++;
  const open = s.objectives.filter((o) => !o.includes(':done')).join(' ');
  console.log(`${difficulty.padEnd(6)} ${String(seed).padEnd(5)} ${String(result || 'unfinished').padEnd(10)} ${String(s.minutes).padStart(5)} min  pop ${p.pop}  stability ${Math.round(p.stability)}  ${open}`);
}
console.log(`${wins}/${runs.length} won within 40 minutes`);
