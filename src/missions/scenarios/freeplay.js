// Free play ("skirmish"): build a settlement on any of the campaign maps and break the lord who
// holds it, without a story. Declarative like the chapters; one scenario per map, each against
// the faction that holds that map in the campaign.
import { mapById } from '../../world/maps/index.js';

const SPEAKERS = {
  maren: { name: 'Maren Ashgrove', role: 'Lantern Warden' },
  osric: { name: 'Osric Tallow', role: 'Reeve of Kindlehold' },
  wren: { name: 'Wren Fenmore', role: 'Scout' },
};

const FIELDS = [
  // id, map, title, enemy faction, hall, the name of the enemy's seat, land description
  ['free-harrowmere', 'harrowmere', 'Harrowmere Valley', 'rustfang', 'warhall', 'the Rustfang Warhall at the ford', 'The river valley of the first chapter: gentle meadows, a ford in the middle, forests all round.'],
  ['free-saltmere', 'saltmere', 'The Saltmere', 'varr', 'varrkeep', 'the Manor of Varr on the eastern rise', 'Lowlands by a broad salt lake: salt pans for trade, a long road along the shore.'],
  ['free-whitehart', 'whitehart', 'Whitehart Vale', 'stag', 'staghall', 'the Chapterhouse of the White Stag', 'A forest vale crossed by a river, with three villages and an old abbey. Stone walls: train Sappers.'],
  ['free-ironmarch', 'ironmarch', 'The Iron March', 'morrow', 'morrowhold', 'Morrow Hold across the Iceburn', 'Highlands with glacier water, rich iron veins and steep crags. Delvers tear down buildings.'],
];

function freeScenario([id, map, title, faction, hall, seat, land]) {
  const ps = mapById(map).playerStart;
  return {
    id,
    map,
    free: true,
    title: `Free Play: ${title}`,
    blurb: `${land} No story, no deadlines: build as you like, and win by breaking ${seat}.`,
    startResources: { timber: 150, stone: 110, iron: 20, provisions: 100, taler: 120 },
    raidWarningAt: { story: 22 * 60, normal: 16 * 60, hard: 12 * 60 },
    raidWarnAfter: 'none',
    speakers: SPEAKERS,
    // two cottages beside the Keep, so the first families have a roof
    setup: { keepLit: true, settlers: 9, soldiers: ['shield', 'fletcher'], buildings: [['cottage', ps.x - 14, ps.z + 12], ['cottage', ps.x - 18, ps.z - 8]] },
    enemy: { faction },
    intro: [
      { speaker: 'osric', text: 'The hearth burns and the storehouse is open, Warden. Build the town the way you want it.' },
      { speaker: 'wren', text: `And keep an eye on ${seat}. They will come for us sooner or later.` },
    ],
    objectives: [
      {
        id: 'town', title: 'A town of your own',
        text: 'Grow to 30 people.',
        hint: 'Cottages raise the population limit; a Tavern\'s hot meals keep people content. Research better tools at the Keep.',
        highlight: 'build', optional: true, activeWhen: { always: true },
        completeWhen: { pop: 30 },
        onComplete: [{ speaker: 'osric', text: 'Thirty souls under our roofs. This is a town now.' }],
      },
      {
        id: 'explore', title: 'Explore the land',
        text: 'Find the old ruin somewhere on the map.',
        hint: 'Send a scout or Maren into the unknown; anyone who reaches the ruin can open it.',
        highlight: 'army', optional: true, activeWhen: { always: true },
        completeWhen: { poiDone: 'ruin' },
      },
      {
        id: 'hall', title: 'Break the enemy seat',
        text: `Destroy ${seat}.`,
        hint: 'Build Barracks, train an army and research better weapons. Towers and a standing guard defend the seat.',
        highlight: 'enemy-camp', activeWhen: { always: true },
        completeWhen: { destroyed: hall },
      },
    ],
    events: [],
    warning: [
      { speaker: 'wren', text: 'Soldiers on the road — an attack is coming!' },
      { speaker: 'maren', text: 'To arms! Shields to the front!' },
    ],
    winWhen: { completed: 'hall' },
    victory: { title: 'The Land Is Yours', text: `${seat[0].toUpperCase()}${seat.slice(1)} has fallen. The roads are free, and your town can grow in peace.` },
    defeat: { title: 'The Lantern Goes Out', text: 'Your settlement has fallen. Try again, Warden.' },
  };
}

export const FREE_SCENARIOS = Object.fromEntries(FIELDS.map((f) => [f[0], freeScenario(f)]));
/** Free play maps in menu order. */
export const FREE_PLAY = FIELDS.map((f) => f[0]);
