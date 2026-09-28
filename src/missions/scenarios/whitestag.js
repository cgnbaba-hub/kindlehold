// Campaign chapter 5 — "The White Stag": the Whitehart vale (a new map), the Order of the White
// Stag (a new enemy with stone walls), three occupied villages to free and a new soldier, the
// Sapper. Original story data, declarative like the other chapters.

export const WHITESTAG_SCENARIO = {
  id: 'whitestag',
  chapter: 5,
  map: 'whitehart',
  title: 'The White Stag',
  blurb: 'The white-stag seals among the Margravine\'s letters lead south, into the forest vale of Whitehart. There the Order of the White Stag — merchant-knights who once guarded the lowland roads — has garrisoned every village and taxes every cart. Maren\'s company crosses the woods with the veterans of the Salt Road.',
  startResources: { timber: 170, stone: 120, iron: 40, provisions: 120, taler: 160 },
  raidWarningAt: { story: 20 * 60, normal: 16 * 60, hard: 13 * 60 },
  raidWarnAfter: 'none',
  speakers: {
    maren: { name: 'Maren Ashgrove', role: 'Lantern Warden' },
    osric: { name: 'Osric Tallow', role: 'Reeve of Kindlehold' },
    wren: { name: 'Wren Fenmore', role: 'Scout' },
    vane: { name: 'Master Edric Vane', role: 'Master of the White Stag' },
    tamsin: { name: 'Tamsin of Ashby', role: 'Charcoal-burner' },
    brother: { name: 'Brother Aldo', role: 'A deserter of the Order' },
  },
  setup: {
    keepLit: true, techs: ['bracing', 'axes', 'blades'], settlers: 12,
    buildings: [['cottage', -136, 20], ['cottage', -104, 58], ['cottage', -140, 48], ['cottage', -124, 62], ['barracks', -100, 26]],
    // the veterans of the Salt Road came along
    soldiers: [['shield', 1], ['shield', 1], ['blade', 1], 'blade', ['fletcher', 1], 'fletcher', ['crossbow', 1], 'halberd'],
  },
  // the Order fields fewer but better soldiers, and its villages hold their own guards
  ai: { reserves: 0.9, spawnInterval: 1.15, garrisonCap: 1.0, firstRaid: -2, growth: -1 },
  enemy: {
    faction: 'stag',
    extraTowers: [[-2, 26], [24, -4]],
    garrison: ['staghalberd', 'staghalberd', 'stagwarden', 'stagarcher', 'stagarcher', 'stagwarden'],
    outposts: [
      { x: -40, z: -110, guards: ['staghalberd', 'staghalberd', 'stagarcher', 'stagarcher'] },
      { x: 90, z: 112, towers: [[0, -6], [-4, 8]], guards: ['staghalberd', 'staghalberd', 'stagwarden', 'stagwarden', 'stagarcher', 'stagarcher', 'stagarcher'] },
      { x: 82, z: -120, towers: [[0, 0], [-12, 6]], guards: ['stagwarden', 'stagwarden', 'stagwarden', 'staghalberd', 'staghalberd', 'stagarcher', 'stagarcher', 'stagarcher'] },
    ],
  },
  cinematic: [
    { x: -150, z: 36, zoom: 70, yaw: 1.4, line: 0 },
    { x: 16, z: 20, zoom: 150, yaw: 0.2, line: 1 },
    { x: -44, z: -108, zoom: 58, yaw: 0.9, line: 2 },
    { x: 125, z: -40, zoom: 66, yaw: 3.9, line: 3 },
    { x: -118, z: 40, zoom: 60, yaw: 0.7, line: 4 },
  ],
  intro: [
    { speaker: 'wren', text: 'Whitehart. Oak forest as far as you can see, and the Varrow running through the middle of it. Every village along the river flies a white banner.' },
    { speaker: 'osric', text: 'The seals in Ysolde\'s letters were theirs — the Order of the White Stag. They paid her to close the Salt Road, so every cart would have to come through their vale instead.' },
    { speaker: 'wren', text: 'Each village has a watchtower and a guard. The villagers work the Order\'s fields and pay its tithe.' },
    { speaker: 'maren', text: 'And the chapterhouse on the eastern downs is where the tithe ends up. Stone walls, Wren?' },
    { speaker: 'wren', text: 'Stone walls. Swords will not get us through them. We will need people who know how to break stone.' },
  ],
  objectives: [
    {
      id: 'hartsgate', title: 'Make camp at Hartsgate',
      text: 'Build a Woodcutter\'s Lodge, a Quarry, a Farm and a Fisher at Hart\'s Mere.',
      hint: 'Your camp already has four cottages and a Barracks. The pond south-east of the Keep has fish.',
      highlight: 'build:lodge', activeWhen: { always: true },
      completeWhen: { all: [{ built: 'lodge' }, { built: 'quarry' }, { built: 'farm' }, { built: 'fisher' }] },
      onComplete: [{ speaker: 'osric', text: 'Hartsgate stands. Bread, fish and timber — now we can think about the villages.' }],
    },
    {
      id: 'ashby', title: 'Free Ashby',
      text: 'Drive the Order out of Ashby, then bring Maren to the village.',
      hint: 'Ashby lies north up the lane. Destroy the Stag Watchtower and its guard — the village cannot join you while they stand. Then select Maren and right-click the huts.',
      highlight: 'army', activeWhen: { completed: 'hartsgate' },
      completeWhen: { poiDone: 'hamlet' },
      onComplete: [{ speaker: 'tamsin', text: 'You burned their tower! Four years we have made charcoal for the Order\'s forges. Ashby\'s kilns are yours now — and we know where they keep their gatehouse keys.' }],
    },
    {
      id: 'sappers', title: 'Sappers',
      text: 'Upgrade the Barracks to a Drill Yard and train four Sappers.',
      hint: 'Sappers carry heavy mauls: they break towers and walls four times faster than any soldier, and stone walls only yield to them. Keep them behind your shields.',
      highlight: 'build:barracks', activeWhen: { completed: 'ashby' },
      completeWhen: { units: 'sapper', count: 4 },
      onComplete: [{ speaker: 'maren', text: 'Mauls and crowbars. Now the Order\'s walls are just stone.' }],
    },
    {
      id: 'villages', title: 'The river villages',
      text: 'Free Thornwick and Coldwell as well: all three villages must stand with you.',
      hint: 'Thornwick lies south beyond the lower ford, Coldwell north under the crags. Their towers are better manned — take Sappers along.',
      highlight: 'army', activeWhen: { completed: 'ashby' },
      completeWhen: { poiDone: 'hamlet', count: 3 },
      onComplete: [{ speaker: 'maren', text: 'The whole river stands with us. The Order is alone behind its walls now.' }],
    },
    {
      id: 'wardens', title: 'The Wardens ride out',
      text: 'Survive two attacks of the Order.',
      hint: 'Stag longbows outrange your Fletchers: close in with Bladesmen, hold the Wardens with Shieldbearers and Halberdiers.',
      highlight: 'army', activeWhen: { flag: 'raidWarned' },
      completeWhen: { any: [{ raidsRepelled: 2 }, { hostSpent: true }] },
      onComplete: [{ speaker: 'wren', text: 'Their field companies are broken. Only the chapterhouse garrison is left.' }],
    },
    {
      id: 'chapterhouse', title: 'The Chapterhouse',
      text: 'Defeat Master Vane and break the Chapterhouse of the White Stag.',
      hint: 'Its walls shrug off swords and arrows. Clear the defenders with your army, then send the Sappers against the walls.',
      highlight: 'enemy-camp', activeWhen: { all: [{ completed: 'villages' }, { completed: 'sappers' }] },
      completeWhen: { all: [{ unitGone: 'vane' }, { destroyed: 'staghall' }] },
    },
    {
      id: 'crypt', title: 'Optional: The Old Abbey',
      text: 'Find the crypt of the abbey where the Order was founded.',
      hint: 'Explore the far south-west of the vale; anyone who reaches the ruin can open it.', optional: true,
      highlight: 'army', activeWhen: { completed: 'hartsgate' },
      completeWhen: { any: [{ poiDone: 'ruin' }] },
    },
  ],
  events: [
    { id: 'white-banners', when: { minutes: 1 }, say: [{ speaker: 'wren', text: 'Stag patrols on the King\'s Road. They are counting our wagons, Warden.' }] },
    { id: 'vane-letter', when: { any: [{ completed: 'hartsgate' }, { minutes: 8 }] }, actions: [{ flag: 'vaneSpoke' }], say: [
      { speaker: 'vane', text: 'The Lantern Warden, in my vale. You broke Ysolde\'s little toll, I hear. She was a clumsy partner.' },
      { speaker: 'vane', text: 'Whitehart has been orderly for twenty years. The villages are fed, the roads are guarded, the ledgers balance. Go home, Warden. There is nothing here that needs your light.' },
      { speaker: 'maren', text: 'Your villages pay for your guards with their harvests, Master Vane. That is not order. That is a toll with a prayer book.' },
    ] },
    { id: 'ashby-gift', when: { completed: 'ashby' }, actions: [{ grant: { timber: 60, iron: 30 } }], say: [{ speaker: 'tamsin', text: 'Charcoal and pig iron we hid from the Order\'s collectors. Take it for your Sappers.' }] },
    { id: 'deserter', when: { poiDone: 'hamlet', count: 2 }, actions: [{ grant: { taler: 100 } }, { reveal: [125, -40, 40] }], say: [
      { speaker: 'brother', text: 'I served the Order for eleven years, Warden. When we took the villages, I stopped believing. Here is my purse — and the gatehouse plan.' },
      { speaker: 'brother', text: 'The walls are thick, but the mortar on the south side is old. Put your Sappers there, and keep the longbows busy.' },
    ] },
    { id: 'vane-anger', when: { poiDone: 'hamlet', count: 3 }, actions: [{ raidSoon: 90 }], say: [
      { speaker: 'vane', text: 'Three villages in three weeks. You are not a lamplighter, Warden — you are a fire. And fires are put out.' },
    ] },
    { id: 'vane-down', when: { unitGone: 'vane' }, say: [{ speaker: 'maren', text: 'Master Vane has fallen. Bring down the chapterhouse — let the vale keep its own harvests.' }] },
  ],
  warning: [
    { speaker: 'wren', text: 'White tabards on the King\'s Road — the Wardens are riding out! Longbows behind them.' },
    { speaker: 'maren', text: 'Shields to the front! Blades, go for the archers!' },
  ],
  winWhen: { completed: 'chapterhouse' },
  victory: { title: 'The Vale Is Free', text: 'The chapterhouse lies in rubble, and Whitehart\'s villages keep their own harvests for the first time in twenty years. In Vane\'s ledgers Osric finds the names of every lord who took the Order\'s silver — and a debt signed by a name nobody in the valley has heard in a hundred years.' },
  defeat: { title: 'The Lantern Goes Out', text: 'Hartsgate has fallen, and the White Stag keeps the vale. Try again, Warden.' },
};
