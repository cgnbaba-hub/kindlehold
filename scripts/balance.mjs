#!/usr/bin/env node
// Balance check: the scripted bot plays full matches on several seeds and difficulties.
// Usage: npm run balance [-- normal:1337 hard:7 ...]   (default: a spread over all difficulties)
import { createSimulation } from '../src/app/simulation.js';
import { createBot } from '../src/demo/bot.js';
import { log } from '../src/core/logger.js';
import { SCENARIOS } from '../src/missions/index.js';

log.setConsoleLevel('error');
const args = process.argv.slice(2);
// runs: difficulty:seed (chapter one) or chapter:difficulty:seed, e.g. greyfen:normal:7
const runs = (args.length ? args.map((a) => a.split(':')) : [['story', '42'], ['normal', '1337'], ['normal', '7'], ['normal', '42'], ['normal', '99'], ['hard', '7'], ['hard', '42'], ['hard', '99']])
  .map((r) => (r.length === 3 ? r : ['harrowmere', ...r]));
let wins = 0;
for (const [scenarioId, difficulty, seed] of runs) {
  // KH_GOODS=lean|rich, KH_PEACE=short|long: the free-play setup choices (src/missions/skirmish.js)
  const skirmish = process.env.KH_GOODS || process.env.KH_PEACE ? { goods: process.env.KH_GOODS, peace: process.env.KH_PEACE } : null;
  const sim = createSimulation({ seed: Number(seed), difficulty, scenarioId, skirmish });
  // KH_TRANSPORT=1 (or roads / donkeys): the bot lays roads and keeps a Donkey Stable, to measure
  // how much they ease the game
  const tr = process.env.KH_TRANSPORT;
  // KH_PRIORITY=1: the bot gives priority to the Barracks site
  // free play against a rival town (free-*-rival): the bot marches on the rival's Keep
  const bot = createBot(sim, { transport: tr === '1' ? true : tr === 'roads' || tr === 'donkeys' ? tr : false, priority: process.env.KH_PRIORITY === '1', foe: (SCENARIOS[scenarioId] || {}).rival ? 'p4' : null });
  const result = bot.play(40 * 1200);
  const s = bot.summary();
  const p = sim.world.players.p1;
  if (result === 'victory') wins++;
  const open = s.objectives.filter((o) => !o.includes(':done')).join(' ');
  console.log(`${scenarioId === 'harrowmere' ? '' : scenarioId + ' '}${difficulty.padEnd(6)} ${String(seed).padEnd(5)} ${String(result || 'unfinished').padEnd(10)} ${String(s.minutes).padStart(5)} min  pop ${p.pop}  stability ${Math.round(p.stability)}${sim.world.rival ? `  rival waves ${sim.world.rival.waves} pop ${sim.world.players.p4.pop}` : ''}${process.env.KH_TRANSPORT ? `  roads ${(sim.world.roads && sim.world.roads.cells.length) || 0} donkeys ${Object.values(sim.world.entities).filter((e) => e.kind === 'donkey').length}` : ''}  ${open}`);
}
console.log(`${wins}/${runs.length} won within 40 minutes`);
