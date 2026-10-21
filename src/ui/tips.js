// First-time tips: the tutorial's second part. Each tip explains one thing the moment it first
// matters in a game (goods waiting for carriers, hunger, full beds, the first raid …) and is shown
// once per player (settings.seenTips). Pure data and conditions, read-only on the world.
import { all } from '../world/world.js';
import { BREAD_PORTIONS, mealsInStock, asleepCount, commuteOf, COMMUTE } from '../population/index.js';
import { NIGHT_PACE, isFastHour } from '../core/daytime.js';

const mine = (world, owner, pred) => all(world, 'building').some((b) => b.owner === owner && pred(b));
const day = (world) => world.time.hour >= 6 && world.time.hour < 21;

/** action: 'economy' opens the economy window, 'build:<tab>' the build menu at that tab, 'keep' selects the Keep. */
export const TIPS = [
  {
    id: 'hunger', title: 'Everyone eats',
    text: 'Every 90 seconds your people eat provisions (bread counts double). Farmsteads, Hunter\'s Huts and Fisher\'s Huts make them. Running short? Set smaller rations at the Keep — but hungry people lose motivation.',
    action: ['build:food', 'Food buildings'],
    when: (w, o) => { const p = w.players[o]; return w.tick > 1200 && (p.lastMealFed < 1 || Math.floor(p.res.provisions) + Math.floor(p.res.bread || 0) * BREAD_PORTIONS + mealsInStock(w, o) < p.pop - asleepCount(w, o)); },
  },
  {
    id: 'carriers', title: 'Goods wait for carriers',
    text: 'Workers make goods; labourers — people without a workplace — carry them to the store and bring materials to building sites. When every labourer is busy, goods pile up at the workshops. More people (Cottages), Hearthhands from the Keep, a Storehouse near the workshops, roads or a Donkey Stable help.',
    action: ['economy', 'Open the economy (O)'],
    when: (w, o) => day(w) && mine(w, o, (b) => b.state === 'active' && b.stall === 'storageFull'),
  },
  {
    id: 'no-worker', title: 'A workshop needs a worker',
    text: 'A free settler takes the job by itself — if there is one. Every worker is one person fewer for carrying and building, and the town keeps a few labourers free. Build Cottages so more people come, or pause a workplace you need less.',
    action: ['build:town', 'Cottages'],
    when: (w, o) => day(w) && w.tick > 2400 && mine(w, o, (b) => b.state === 'active' && b.stall === 'noWorker'),
  },
  {
    id: 'housing', title: 'Every bed is taken',
    text: 'Newcomers only settle where there is a free bed. A Cottage houses five; later you can upgrade Cottages to Stone Houses for more. Hearthhands are the exception: they bunk in the Keep.',
    action: ['build:town', 'Cottages'],
    when: (w, o) => { const p = w.players[o]; return w.tick > 1200 && (p.housed ?? p.pop) >= p.popCap; },
  },
  {
    id: 'inputs', title: 'Workshops that need goods',
    text: 'The Windmill, the Bakery and the Smithy turn goods into better ones: grain into flour, flour into bread, iron into tools. Their raw goods must be in the store first; carriers then bring them over.',
    action: ['economy', 'Open the economy (O)'],
    when: (w, o) => day(w) && mine(w, o, (b) => b.state === 'active' && b.stall === 'noInput'),
  },
  {
    id: 'raid', title: 'A raid is coming',
    text: 'Build a Barracks (Army tab) and train soldiers there — each one takes a free settler. Drag a box around soldiers to select them, right-click to move them, A to attack-move. Watchtowers shoot raiders, and raiders go for what nobody guards.',
    action: ['build:army', 'Army buildings'],
    // (or a free-play rival's army on the march)
    when: (w) => !!w.mission.flags.raidWarned || w.ai.state === 'gather' || w.ai.state === 'raid' || !!w.ai.harass || !!(w.rival && w.rival.waves > 0),
  },
  {
    id: 'night', title: 'Night falls',
    text: `At night your people go to bed and the workshops rest — nothing is broken. The dark hours pass ${NIGHT_PACE} times as fast, and rested settlers work quicker by day. Skip night (top) jumps to dawn. Some raiders like to come with torches at dusk.`,
    when: (w) => w.tick > 1200 && isFastHour(w.time.hour) && w.time.hour >= 20.5,
  },
  {
    id: 'sites', title: 'Several building sites at once',
    text: 'Carriers and builders share themselves out over all sites. Select the one you need most and press Priority: it is served first, everything else waits.',
    when: (w, o) => all(w, 'building').filter((b) => b.owner === o && b.state === 'site').length >= 3,
  },
  {
    id: 'long-walks', title: 'Long walks',
    text: 'Your town is spreading out: workers walk far to their workshops and carriers far to the Keep. A Storehouse in a new quarter is a second store; stone roads speed everyone up. Long walks also cost motivation.',
    action: ['build:town', 'Storehouse and roads'],
    when: (w, o) => commuteOf(w, o) > COMMUTE.free + COMMUTE.per,
  },
  {
    id: 'motivation', title: 'Motivation is sinking',
    text: 'Motivated people work faster; below 30 nobody new comes, below 15 people leave. Hover the motivation bar at the top to see why it is where it is: meals, bread, taxes, Wells, feasts, idle townsfolk and long walks all count.',
    action: ['keep', 'Select the Keep'],
    when: (w, o) => w.tick > 2400 && (w.players[o].stability || 0) < 50,
  },
];

/** The next tip to show, or null: first in the list whose condition holds and that was not seen. */
export function nextTip(world, owner, seen) {
  for (const t of TIPS) if (!seen.includes(t.id) && t.when(world, owner)) return t;
  return null;
}
