// Campaign chapters 2 and 3 — original story data, declarative like chapter 1.
// Conditions are evaluated by src/missions/conditions.js; `events` are one-shot story beats
// (dialogue, alerts, small scripted actions) run by src/missions/index.js.

const SPEAKERS = {
  maren: { name: 'Maren Ashgrove', role: 'Lantern Warden' },
  osric: { name: 'Osric Tallow', role: 'Reeve of Kindlehold' },
  wren: { name: 'Wren Fenmore', role: 'Scout' },
  vharek: { name: 'Vharek the Tollbreaker', role: 'Rustfang warlord' },
  morwen: { name: 'Morwen Greyfen', role: 'Chieftain of the Greyfen brigands' },
  hild: { name: 'Hild of Millbrook', role: 'Elder of the river folk' },
};

// A small town around the Castle: the fruit of chapter one.
const TOWN = [
  ['cottage', -54, 64], ['cottage', -58, 30], ['cottage', -40, 74], ['cottage', -62, 50],
  ['lodge', -66, 40, 2], ['lodge', -70, 26], ['farm', -36, 66], ['farm', -60, 78],
  ['quarry', -28, 68], ['mine', -73, 62], ['hunter', -72, 30], ['barracks', -34, 38],
];

export const GREYFEN_SCENARIO = {
  id: 'greyfen',
  chapter: 2,
  title: 'The Greyfen Question',
  blurb: 'A year has passed. Kindlehold is a town again, but Vharek survived the burning of his hall. His reavers have rebuilt the ford fort and now squeeze the whole valley — Millbrook, the fisherfolk, even the Greyfen brigands in the northern fens. Someone will have to choose a side.',
  startResources: { timber: 160, stone: 120, iron: 30, provisions: 120, taler: 180 },
  raidWarningAt: { story: 16 * 60, normal: 12 * 60, hard: 10 * 60 },
  raidWarnAfter: 'millbrook',
  speakers: SPEAKERS,
  setup: {
    keepLevel: 2, keepLit: true, techs: ['bracing', 'axes'], settlers: 16,
    soldiers: ['shield', 'shield', 'blade', 'fletcher', 'fletcher'],
    buildings: TOWN,
  },
  ai: { reserves: 1.25, spawnInterval: 0.9, garrisonCap: 1.2 },
  enemy: { hallBarred: true, extraTowers: [[-2, 24]], garrison: ['brute', 'reaver', 'reaver', 'slinger', 'slinger', 'reaver'] },
  cinematic: [
    { x: -46, z: 50, zoom: 70, yaw: 0.8, line: 0 },
    { x: 72, z: -70, zoom: 60, yaw: 3.6, line: 1 },
    { x: -118, z: -138, zoom: 64, yaw: 0.7, line: 2 },
    { x: -46, z: 50, zoom: 55, yaw: 0.6, line: 3 },
  ],
  intro: [
    { speaker: 'osric', text: 'A year of peace, Warden. Forty souls under our roofs, a castle wall, bread every morning. The valley calls it a miracle.' },
    { speaker: 'wren', text: 'The miracle has a crack in it. Vharek lived. His reavers have raised the ford fort again, bigger than before.' },
    { speaker: 'maren', text: 'And the Greyfen? Morwen\'s people have kept to the fens all year.' },
    { speaker: 'wren', text: 'Hungry and angry. Vharek takes their game and burns their boats. Whoever wins Morwen wins the north.' },
  ],
  objectives: [
    {
      id: 'town', title: 'A town that feeds itself',
      text: "Grow to 24 people and build a Tavern and a Fisher's Hut.",
      hint: 'The Fisher\'s Hut must stand within 30 m of the river. A Tavern turns provisions into hot meals.',
      highlight: 'build', activeWhen: { always: true },
      completeWhen: { all: [{ pop: 24 }, { built: 'canteen', count: 1 }, { built: 'fisher', count: 1 }] },
      onComplete: [{ speaker: 'osric', text: 'Fish on the tables and stew in the pots. Now we can think beyond our own walls.' }],
    },
    {
      id: 'millbrook', title: 'Word from Millbrook',
      text: 'Maren must visit the hamlet of Millbrook in the south-east.',
      hint: 'Select Maren and right-click near the hamlet. Scout the way first — the Rustfang roam the southern road.',
      highlight: 'army', activeWhen: { always: true },
      completeWhen: { poiDone: 'hamlet' },
      onComplete: [{ speaker: 'hild', text: 'Kindlehold came when we called. Millbrook will not forget it — nor will Vharek, I fear.' }],
    },
    {
      id: 'greyfen', title: 'The Greyfen Question',
      text: 'Win Morwen\'s alliance with gifts — or destroy the Greyfen Hold.',
      hint: 'Diplomacy (the banner next to the clock): gifts raise the relation, 60 makes allies. Building near their hold or attacking them means war.',
      highlight: 'diplomacy', activeWhen: { completed: 'millbrook' },
      completeWhen: { any: [{ stance: { with: 'p3', is: 'allied' } }, { destroyed: 'brigandhall' }] },
    },
    {
      id: 'hold', title: 'Hold the river',
      text: 'Survive two Rustfang raids.',
      hint: 'Veterans hit harder: keep your soldiers alive between raids. Watchtowers help at the river crossings. The fort keeps its gates barred until its raiders are broken.',
      highlight: 'army', activeWhen: { flag: 'raidWarned' },
      completeWhen: { any: [{ raidsRepelled: 2 }, { hostSpent: true }] },
      onComplete: [{ speaker: 'maren', text: 'Twice they came, twice they broke. The ford fort is next.' }],
    },
    {
      id: 'fort', title: 'The ford fort, again',
      text: 'Destroy the rebuilt Rustfang Warhall.',
      hint: 'Vharek is not in the fort this time — his war-captains hold it. Bring your veterans and the Greyfen, if they ride with you.',
      highlight: 'enemy-camp', activeWhen: { all: [{ completed: 'hold' }, { completed: 'greyfen' }] },
      completeWhen: { destroyed: 'warhall' },
    },
    {
      id: 'veterans', title: 'Optional: Seasoned blades',
      text: 'Have three soldiers become Veterans.',
      hint: 'A soldier becomes a Veteran after three victories.', optional: true,
      highlight: 'army', activeWhen: { always: true },
      completeWhen: { veterans: 3 },
    },
  ],
  events: [
    { id: 'wren-south', when: { minutes: 2 }, say: [{ speaker: 'wren', text: 'Smoke over Millbrook, Warden. Not cooking fires. If we want the river folk on our side, we should go soon.' }] },
    { id: 'morwen-envoy', when: { completed: 'millbrook' }, say: [
      { speaker: 'morwen', text: 'So the Lantern Warden remembers there are people north of her walls. The Rustfang burned my boats last month. Talk is cheap, Warden. Grain and silver are not.' },
      { speaker: 'maren', text: 'Gifts it is, then — or a reckoning. We cannot fight Vharek with the fens at our back.' },
    ] },
    { id: 'allied', when: { stance: { with: 'p3', is: 'allied' } }, say: [{ speaker: 'morwen', text: 'You have kept your word. When the Rustfang horns blow, the Greyfen will ride with you.' }], actions: [{ flag: 'greyfenAllied' }] },
    { id: 'hold-fallen', when: { all: [{ destroyed: 'brigandhall' }, { minutes: 1 }] }, say: [{ speaker: 'maren', text: 'The Greyfen are scattered. It had to be done — but I will remember their fires.' }], actions: [{ flag: 'greyfenDefeated' }] },
    { id: 'tithe', when: { all: [{ completed: 'millbrook' }, { minutes: 14 }] }, say: [{ speaker: 'hild', text: 'Our boats brought you salted fish and what silver we could spare. Hold the river, Kindlehold.' }], actions: [{ grant: { provisions: 60, taler: 60 } }] },
    { id: 'captains', when: { completed: 'hold' }, actions: [{ unflag: 'hallBarred' }], say: [{ speaker: 'wren', text: 'Two war-captains command the fort now. Vharek himself has ridden east to rally the hill clans. Strike before he returns.' }] },
  ],
  warning: [
    { speaker: 'wren', text: 'Rustfang horns at the ford! They are coming for the town — and they have more spears than last year.' },
    { speaker: 'maren', text: 'Veterans to the front. Everyone else behind the castle.' },
  ],
  winWhen: { all: [{ destroyed: 'warhall' }, { completed: 'greyfen' }] },
  victory: { title: 'The North Is Decided', text: 'The ford fort burns a second time. Millbrook\'s boats sail again, and in the fens the Greyfen talk about Kindlehold — as friends or as a warning. But somewhere in the eastern hills, Vharek is gathering the clans.' },
  defeat: { title: 'The Castle Falls', text: 'Kindlehold could not hold both the river and the fens. Try again, Warden — and choose your friends with care.' },
};

export const TOLLBREAKER_SCENARIO = {
  id: 'tollbreaker',
  chapter: 3,
  title: "The Tollbreaker's Winter",
  blurb: 'Vharek has united the hill clans under one banner. They come with the first snow, when the Harrow freezes and every bank becomes a ford. This time the Tollbreaker leads the host himself. End it.',
  startResources: { timber: 220, stone: 180, iron: 80, provisions: 160, taler: 240 },
  raidWarningAt: { story: 11 * 60, normal: 8 * 60, hard: 7 * 60 },
  raidWarnAfter: 'winter-stores',
  speakers: SPEAKERS,
  setup: {
    keepLevel: 2, keepLit: true, techs: ['bracing', 'axes', 'blades', 'charter'], settlers: 22,
    soldiers: ['shield', 'shield', 'shield', 'blade', 'blade', 'fletcher', 'fletcher', 'fletcher'],
    buildings: [...TOWN, ['canteen', -54, 38], ['fisher', -44, 14], ['cottage', -48, 84], ['tower', -30, 30]],
  },
  ai: { reserves: 2, hpMult: 1.1, spawnInterval: 0.6, waveInterval: 0.85, garrisonCap: 2, growth: 3, firstRaid: 7 },
  enemy: { commanderLate: true, hallBarred: true, extraTowers: [[-2, 24], [20, -4]], garrison: ['brute', 'brute', 'reaver', 'reaver', 'reaver', 'slinger', 'slinger', 'slinger', 'brute', 'reaver', 'slinger', 'reaver'] },
  // the Greyfen remember chapter two: allied if Morwen was won over, gone if the hold fell
  greyfen: 'campaign',
  cinematic: [
    { x: 72, z: -70, zoom: 70, yaw: 3.4, line: 0 },
    { x: 20, z: -6, zoom: 60, yaw: 0.4, line: 1 },
    { x: -46, z: 50, zoom: 60, yaw: 0.7, line: 2 },
  ],
  intro: [
    { speaker: 'vharek', text: 'Kindlehold. Twice you burned my hall. This winter I will warm my hands at yours.' },
    { speaker: 'wren', text: 'Every clan in the eastern hills marches under his banner. When the river freezes, they can cross anywhere.' },
    { speaker: 'maren', text: 'Then we will be ready before the snow. Fill the stores, light the signal towers — and this time, the Tollbreaker does not walk away.' },
  ],
  objectives: [
    {
      id: 'winter-stores', title: 'Before the snow',
      text: 'Store 150 provisions and 120 timber, and build a second Watchtower.',
      hint: 'Winter slows the fields. Fishers and hunters keep working; the Tavern stretches every provision.',
      highlight: 'build:tower', activeWhen: { always: true },
      completeWhen: { all: [{ stock: 'provisions', amount: 150 }, { stock: 'timber', amount: 120 }, { built: 'tower', count: 2 }] },
      onComplete: [{ speaker: 'osric', text: 'Granaries full, woodpiles high. Let the winter come.' }],
    },
    {
      id: 'host', title: 'The great host',
      text: 'Survive three waves of the Rustfang host.',
      hint: 'When the Harrow freezes they can cross anywhere — watch the ice, not only the fords. The fort\'s gates stay barred until the host is broken.',
      highlight: 'army', activeWhen: { flag: 'raidWarned' },
      completeWhen: { any: [{ raidsRepelled: 3 }, { hostSpent: true }] },
      onComplete: [{ speaker: 'maren', text: 'The host is spent. He will come himself now — let him find us ready.' }],
    },
    {
      id: 'tollbreaker', title: 'The Tollbreaker falls',
      text: 'Vharek marches on Kindlehold with his bodyguard. Defeat him — and see his Warhall burn.',
      hint: 'He comes down the east road. Beacon Flare dazzles him; Fletchers wear him down; veterans hold the line.',
      highlight: 'army', activeWhen: { completed: 'host' },
      completeWhen: { all: [{ flag: 'vharekArrived' }, { unitGone: 'vharek' }, { destroyed: 'warhall' }] },
    },
    {
      id: 'elite', title: 'Optional: Hearthguard',
      text: 'Raise a soldier to the Elite rank.',
      hint: 'Eight victories make an Elite soldier.', optional: true,
      highlight: 'army', activeWhen: { always: true },
      completeWhen: { veterans: 1, rank: 2 },
    },
  ],
  events: [
    { id: 'omen', when: { minutes: 3 }, say: [{ speaker: 'osric', text: 'The geese left early this year, Warden. The old folk say that means a long, hard winter.' }] },
    { id: 'greyfen-ride', when: { all: [{ flag: 'raidWarned' }, { stance: { with: 'p3', is: 'allied' } }] }, say: [{ speaker: 'morwen', text: 'The fens remember who stood by us. Greyfen spears are yours this winter, Warden.' }] },
    { id: 'ice', when: { winter: true }, say: [{ speaker: 'wren', text: 'The Harrow is freezing. Every bank is a ford now — guard the whole river!' }] },
    { id: 'vharek-arrives', when: { completed: 'host' }, say: [{ speaker: 'vharek', text: 'You broke my host, Lantern Warden. So I will collect the toll myself — at your gate.' }],
      actions: [{ unflag: 'hallBarred' }, { spawnHost: { commander: 'vharek', units: ['brute', 'brute', 'brute', 'brute', 'reaver', 'reaver', 'reaver', 'reaver', 'reaver', 'slinger', 'slinger', 'slinger', 'slinger', 'brute'], flag: 'vharekArrived', alert: 'Vharek the Tollbreaker marches on Kindlehold with his bodyguard!' } }] },
    { id: 'vharek-down', when: { all: [{ flag: 'vharekArrived' }, { unitGone: 'vharek' }] }, say: [{ speaker: 'maren', text: 'The Tollbreaker is dead. Burn his hall — no one will take a toll at this ford again.' }] },
  ],
  warning: [
    { speaker: 'wren', text: 'The host is on the march! Banners of every hill clan — and Vharek\'s own at the front.' },
    { speaker: 'maren', text: 'To the towers! Hold them at the river!' },
  ],
  winWhen: { completed: 'tollbreaker' },
  victory: { title: 'The Last Toll', text: 'Vharek the Tollbreaker is dead and his hall is ash. When spring comes, the Harrowmere ford belongs to everyone who crosses it — and Kindlehold\'s lantern burns over a free valley.' },
  defeat: { title: 'A Winter Without Dawn', text: 'The host overran the castle. The lantern is out — for now. Try again, Warden.' },
};
