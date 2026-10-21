// The town at a glance, for the economy window: who carries, which workshops wait and for what,
// and the one or two things that hold the town back right now (with what helps). Read-only.
import { all } from '../world/world.js';
import { BUILDINGS } from '../buildings/defs.js';
import { missingInputs } from '../production/index.js';
import { BREAD_PORTIONS, mealsInStock, asleepCount } from '../population/index.js';

const NAME = (b) => BUILDINGS[b.type].name;

/**
 * @param {object} rates per good, net change of the store over the last minute (from the HUD)
 * @returns {{ carriers: object, waiting: object, bottlenecks: {level:string, text:string, ids:number[]}[] }}
 */
export function economyOverview(world, owner, rates = {}) {
  const p = world.players[owner];
  const settlers = all(world, 'settler').filter((s) => s.owner === owner);
  const labourers = settlers.filter((s) => !s.job);
  const awake = labourers.filter((s) => !(s.sleep && s.sleep.in) && !s.arriving && !s.enlisting);
  const busy = awake.filter((s) => s.order || (s.task && s.task.type !== 'idle'));
  const donkeys = all(world, 'donkey').filter((d) => d.owner === owner);
  const carriers = { labourers: labourers.length, awake: awake.length, busy: busy.length, idle: awake.length - busy.length, donkeys: donkeys.length, hands: p.hands || 0 };

  const waiting = { pickup: [], input: [], noWorker: [], noAccess: [], paused: [] };
  for (const b of all(world, 'building')) {
    if (b.owner !== owner || b.state !== 'active') continue;
    if (b.stall === 'storageFull') waiting.pickup.push(b.id);
    else if (b.stall === 'noInput') waiting.input.push(b.id);
    else if (b.stall === 'noWorker') waiting.noWorker.push(b.id);
    else if (b.stall === 'noAccess') waiting.noAccess.push(b.id);
    else if (b.paused) waiting.paused.push(b.id);
  }

  const bottlenecks = [];
  const add = (level, text, ids = []) => bottlenecks.push({ level, text, ids });
  const night = world.time.hour >= 22 || world.time.hour < 5;
  // food first: hunger costs motivation and people
  const eaters = Math.max(0, p.pop - asleepCount(world, owner));
  const food = Math.floor(p.res.provisions) + Math.floor(p.res.bread || 0) * BREAD_PORTIONS + mealsInStock(world, owner);
  if (p.lastMealFed < 1 || food < eaters) add('danger', `Food runs short: ${food} portions for ${eaters} people at the next meal. Build Farmsteads, a Hunter's Hut or a Fisher's Hut, or set smaller rations at the Keep.`);
  if (waiting.noAccess.length) add('danger', `${waiting.noAccess.length === 1 ? NAME(world.entities[waiting.noAccess[0]]) + ' cannot' : `${waiting.noAccess.length} buildings cannot`} be reached by its workers. Move it, or clear the way.`, waiting.noAccess);
  // carrying: goods pile up while nobody is free to fetch them
  if (!night && waiting.pickup.length >= 2 && carriers.idle <= 1) {
    add('warn', `Carriers are the bottleneck: ${waiting.pickup.length} workshops wait for their goods to be fetched and nobody is free. Hire Hearthhands at the Keep, house more people, build a Storehouse near the workshops, lay roads or keep a Donkey Stable.`, waiting.pickup);
  } else if (!night && waiting.pickup.length) {
    add('info', `${waiting.pickup.length === 1 ? NAME(world.entities[waiting.pickup[0]]) + ' waits' : `${waiting.pickup.length} workshops wait`} for carriers to fetch the goods.`, waiting.pickup);
  }
  if (!night && waiting.noWorker.length) {
    add('warn', `${waiting.noWorker.length === 1 ? NAME(world.entities[waiting.noWorker[0]]) + ' has' : `${waiting.noWorker.length} workshops have`} no worker. Build Cottages so more people settle, or pause a workplace you need less.`, waiting.noWorker);
  }
  if (!night && waiting.input.length) {
    // grouped by what is missing: "Bakery waits for flour"
    const by = new Map();
    for (const id of waiting.input) for (const g of missingInputs(world.entities[id])) { if (!by.has(g)) by.set(g, []); by.get(g).push(id); }
    for (const [g, ids] of by) add('warn', `${ids.length === 1 ? NAME(world.entities[ids[0]]) + ' waits' : `${ids.length} workshops wait`} for ${g}: make more of it, or let carriers bring it (it must be in the store first).`, ids);
  }
  // goods running out
  for (const [r, label, fix] of [['timber', 'Timber', 'another Woodcutter\'s Lodge'], ['stone', 'Stone', 'a Quarry by a rock outcrop'], ['iron', 'Iron', 'a Mine on an iron vein']]) {
    const rate = rates[r] || 0, stock = Math.floor(p.res[r] || 0);
    if (rate < -3 && stock < 40) add('warn', `${label} runs out: ${rate}/min and ${stock} left. Build ${fix}.`);
  }
  if ((p.housed ?? p.pop) >= p.popCap) add('info', 'Every bed is taken: no newcomers until there are more Cottages (or Stone Houses).');
  const order = { danger: 0, warn: 1, info: 2 };
  bottlenecks.sort((a, c) => order[a.level] - order[c.level]);
  return { carriers, waiting, bottlenecks };
}
