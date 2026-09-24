// Headless full-match run by the scripted bot: node scripts/bot-run.mjs [difficulty] [seed] [maxMinutes]
import { createSimulation } from '../src/app/simulation.js';
import { createBot } from '../src/demo/bot.js';
import { log } from '../src/core/logger.js';
log.setConsoleLevel('error');
const difficulty = process.argv[2] || 'normal';
const seed = process.argv[3] || '1337';
const maxMin = Number(process.argv[4] || 40);
const sim = createSimulation({ seed, difficulty });
const events = [];
for (const ev of ['mission:objective', 'ai:wave', 'ai:retreat', 'mission:ended', 'building:destroyed', 'tech:completed', 'mission:raid-warning', 'hero:downed']) sim.bus.on(ev, (p) => events.push(`${(sim.world.tick / 1200).toFixed(1)}m ${ev} ${JSON.stringify(p).slice(0, 110)}`));
let rejects = {};
sim.bus.on('command:rejected', (p) => { rejects[p.reason] = (rejects[p.reason] || 0) + 1; });
const bot = createBot(sim);
const t0 = performance.now();
let lastPrint = 0;
bot.play(maxMin * 1200, (w) => {
  if (w.tick - lastPrint >= 2400) { lastPrint = w.tick; const s = bot.summary(); console.log(`${s.minutes}m res=${JSON.stringify(s.res)} pop=${s.pop}/${s.cap} stab=${s.stability} sold=${s.soldiers} enemies=${s.enemies} ai=${s.aiState}/${s.wave}`); }
});
console.log(events.join('\n'));
console.log(JSON.stringify(bot.summary(), null, 1));
console.log('rejects', rejects);
console.log('bot log tail', bot.log.slice(-8));
console.log('wall ms', (performance.now() - t0).toFixed(0), 'health', sim.host.health().filter(h => h.status !== 'ok'));
