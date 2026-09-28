// Campaign chapter 6 — "The Iron March": the highlands (a new map), House Morrow (a new enemy
// whose Delvers tear down buildings), and Wren Fenmore as a second playable hero. Original story
// data, declarative like the other chapters.

export const IRONDEBT_SCENARIO = {
  id: 'irondebt',
  chapter: 6,
  map: 'ironmarch',
  title: 'The Iron March',
  blurb: 'In Master Vane\'s ledgers Osric found the oldest debt of all: a hundred years ago the valley\'s roads were pledged to House Morrow of the Iron March. Now Lady Ismay Morrow has come down from the highlands to collect. Maren and Wren lead a company up to the old border fort of Stonewatch.',
  startResources: { timber: 160, stone: 140, iron: 40, provisions: 110, taler: 150 },
  raidWarningAt: { story: 16 * 60, normal: 15 * 60, hard: 12 * 60 },
  raidWarnAfter: 'none',
  speakers: {
    maren: { name: 'Maren Ashgrove', role: 'Lantern Warden' },
    osric: { name: 'Osric Tallow', role: 'Reeve of Kindlehold' },
    wren: { name: 'Wren Fenmore', role: 'Scout of the March' },
    ismay: { name: 'Lady Ismay Morrow', role: 'Heir of House Morrow' },
    bram: { name: 'Bram Delving', role: 'Pit-reeve of Delvholm' },
  },
  setup: {
    keepLit: false, techs: ['bracing', 'axes', 'blades'], settlers: 12,
    heroes: ['wren'],
    buildings: [['cottage', -128, 96], ['cottage', -92, 128], ['cottage', -130, 124], ['cottage', -112, 136], ['barracks', -92, 96, 2]],
    // the veterans of Whitehart, Sappers included
    soldiers: [['shield', 1], ['shield', 1], ['halberd', 1], ['blade', 1], 'blade', ['crossbow', 1], 'fletcher', ['sapper', 1], 'sapper'],
  },
  // the household guard is heavily armoured: fewer of them per attack
  ai: { reserves: 0.9, spawnInterval: 1.15, garrisonCap: 1.0, firstRaid: -2, growth: -1 },
  enemy: {
    faction: 'morrow', hallBarred: true, commanderLate: true,
    extraTowers: [[-2, 26], [26, 2]],
    garrison: ['ironguard', 'ironguard', 'arbalest', 'delver', 'arbalest', 'ironguard'],
    outposts: [
      { x: -40, z: 30, towers: [[0, 0], [-4, -14]], guards: ['ironguard', 'ironguard', 'ironguard', 'arbalest', 'arbalest', 'arbalest', 'delver', 'delver'] },
    ],
  },
  cinematic: [
    { x: -160, z: 150, zoom: 70, yaw: 0.9, line: 0 },
    { x: -40, z: -60, zoom: 160, yaw: 0.3, line: 1 },
    { x: -50, z: 36, zoom: 54, yaw: 0.8, line: 2 },
    { x: 112, z: -104, zoom: 66, yaw: 3.6, line: 3 },
    { x: -108, z: 110, zoom: 58, yaw: 0.8, line: 4 },
  ],
  intro: [
    { speaker: 'osric', text: 'One page in Vane\'s ledgers is older than all the others. The valley\'s roads, pledged to House Morrow a hundred years ago — for iron to rebuild after the first Long Frost.' },
    { speaker: 'maren', text: 'And nobody ever repaid it. Now the Morrows want the roads, the mines and every toll between the passes.' },
    { speaker: 'wren', text: 'The Iron March. Glacier water, black rock, and a miners\' village under the crags. Their banners fly over it already.' },
    { speaker: 'osric', text: 'Morrow Hold sits on the shelf across the Iceburn. Their Delvers can bring down a house in the time it takes to boil a kettle.' },
    { speaker: 'wren', text: 'Leave the lantern to you, Warden. The high ground is mine — I will be on the beacons before they know we are here.' },
  ],
  objectives: [
    {
      id: 'stonewatch', title: 'Rekindle Stonewatch',
      text: 'Select the old border fort\'s Keep and light its hearth.',
      hint: 'Left-click the Keep, then press "Rekindle the Hearth". Settlers from the valley follow the light.',
      highlight: 'keep', activeWhen: { always: true }, completeWhen: { keepLit: true },
      onComplete: [{ speaker: 'maren', text: 'Stonewatch burns again. Timber, bread — and iron, as much as the mountain gives.' }],
    },
    {
      id: 'foothold', title: 'Iron and bread',
      text: 'Build two Mines, a Woodcutter\'s Lodge and a Farm.',
      hint: 'Iron veins glitter on the terrace behind the fort and on the slope towards the march road. A Mine must stand close to a vein.',
      highlight: 'build:mine', activeWhen: { completed: 'stonewatch' },
      completeWhen: { all: [{ built: 'mine', count: 2 }, { built: 'lodge' }, { built: 'farm' }] },
      onComplete: [{ speaker: 'osric', text: 'Our own iron, from their mountain. Lady Ismay will not like that.' }],
    },
    {
      id: 'beacons', title: 'The border beacons',
      text: 'Light the three old border beacons (West, South and Iron Beacon).',
      hint: 'Select Wren (the hooded archer) and send her ahead: she sees further than anyone. Anyone who reaches a beacon lights it. The Iron Beacon stands across the Iceburn.',
      highlight: 'army', activeWhen: { completed: 'stonewatch' },
      completeWhen: { poiDone: 'cairn', count: 3 },
      onComplete: [{ speaker: 'wren', text: 'Three fires on the heights! Every shepherd in the march knows now that the old border stands again.' }],
    },
    {
      id: 'delvholm', title: 'The miners of Delvholm',
      text: 'Break the Morrow bastion at Delvholm, then bring Maren to the village.',
      hint: 'Delvholm lies east of the fort, under the crags. Its bastion is black stone: Sappers break it fastest. Wren\'s Hunter\'s Mark (G) makes the guards take more damage.',
      highlight: 'army', activeWhen: { completed: 'foothold' },
      completeWhen: { poiDone: 'hamlet' },
      onComplete: [{ speaker: 'bram', text: 'A lantern in the march again! We dug Morrow\'s iron for thirty years and never saw a coin of it. Our pits are yours, Warden.' }],
    },
    {
      id: 'debt', title: 'The Morrow debt',
      text: 'Pay House Morrow\'s interest for a truce (Diplomacy) — or stand firm and throw back their first attack.',
      hint: 'Interest buys a few quiet minutes to build and train. Refusing costs nothing — until the Delvers come for your houses.',
      highlight: 'diplomacy', activeWhen: { flag: 'debtCalled' },
      completeWhen: { any: [{ stance: { with: 'p2', is: 'truce' } }, { raidsRepelled: 1 }] },
    },
    {
      id: 'household', title: 'The household host',
      text: 'Survive two attacks of House Morrow.',
      hint: 'Delvers go for your buildings: meet them with Bladesmen before they reach the houses. Ironguard hold against blades — use Crossbowmen and Wren\'s Arrow Storm (F).',
      highlight: 'army', activeWhen: { flag: 'raidWarned' },
      completeWhen: { any: [{ raidsRepelled: 2 }, { hostSpent: true }] },
      onComplete: [{ speaker: 'maren', text: 'Their host is broken. The hold must open its gates for the ore carts — and we will be there.' }],
    },
    {
      id: 'hold', title: 'Morrow Hold',
      text: 'Defeat Lady Ismay and break Morrow Hold.',
      hint: 'The hold stands on the shelf across the Iceburn. Its walls yield to Sappers; bastions guard the approach.',
      highlight: 'enemy-camp', activeWhen: { all: [{ completed: 'household' }, { completed: 'delvholm' }] },
      completeWhen: { all: [{ unitGone: 'ismay' }, { destroyed: 'morrowhold' }] },
    },
    {
      id: 'mint', title: 'Optional: The Old Mint',
      text: 'Find House Morrow\'s abandoned mint by the south-eastern crags.',
      hint: 'Cross the Iceburn at the gorge ford; anyone who reaches the ruin can open it.', optional: true,
      highlight: 'army', activeWhen: { completed: 'stonewatch' },
      completeWhen: { any: [{ poiDone: 'ruin' }] },
    },
  ],
  events: [
    { id: 'cold-wind', when: { minutes: 1 }, say: [{ speaker: 'wren', text: 'Smoke over the crags — Delvholm\'s forges. And riders in black and gold on the march road.' }] },
    { id: 'debt-called', when: { any: [{ completed: 'foothold' }, { minutes: 9 }] }, actions: [{ flag: 'debtCalled' }], say: [
      { speaker: 'ismay', text: 'Warden. A hundred years ago your valley borrowed the iron that rebuilt it, and pledged its roads as surety. The debt has grown since. I have the deed.' },
      { speaker: 'maren', text: 'A deed signed by men long dead, for a valley that has paid for it twice over in winters.' },
      { speaker: 'ismay', text: 'Sentiment is not currency. Pay the interest, or my Delvers will take it out of your walls — stone by stone.' },
    ] },
    { id: 'delvholm-gift', when: { completed: 'delvholm' }, actions: [{ grant: { iron: 60, taler: 60 } }], say: [{ speaker: 'bram', text: 'Iron we hid down the old shaft. Take it — and give the Morrows a taste of their own ore.' }] },
    { id: 'first-beacon', when: { poiDone: 'cairn' }, say: [{ speaker: 'wren', text: 'The first beacon burns. I can see the whole western march from here.' }] },
    { id: 'iron-beacon', when: { poiDone: 'cairn', count: 3 }, actions: [{ reveal: [112, -104, 50] }, { raidSoon: 120 }], say: [
      { speaker: 'ismay', text: 'Fires on my beacons. You are bolder than your debt, Warden. My household will answer.' },
    ] },
    { id: 'host-broken', when: { completed: 'household' }, actions: [{ unflag: 'hallBarred' }, { commanderAtHall: true }], say: [{ speaker: 'wren', text: 'The hold\'s gates are open for the ore carts. Now, while they are still counting their losses!' }] },
    { id: 'ismay-down', when: { all: [{ completed: 'household' }, { unitGone: 'ismay' }] }, say: [
      { speaker: 'ismay', text: 'Enough! I yield. The deed — take it. It was never ours alone.' },
      { speaker: 'maren', text: 'Then whose was it? Break the hold, and we will read it together.' },
    ] },
  ],
  warning: [
    { speaker: 'wren', text: 'Black and gold on the march road — the household is coming! Delvers in front, going for the houses.' },
    { speaker: 'maren', text: 'Blades to the houses! Shields to the road!' },
  ],
  winWhen: { completed: 'hold' },
  victory: { title: 'The March Is Free', text: 'Morrow Hold has fallen and the old deed lies on Osric\'s table. Beside the Morrow seal stands a second one: an anchor in a ring of coins — the Syndics of Carrow, the harbour city beyond the lowlands. They bought the debt fifty years ago. The valley\'s roads were never meant to end at a mountain. They end at the sea.' },
  defeat: { title: 'The Lantern Goes Out', text: 'Stonewatch has fallen, and House Morrow holds the march. Try again, Warden.' },
};
