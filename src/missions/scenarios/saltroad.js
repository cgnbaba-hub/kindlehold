// Campaign chapter 4 — "The Salt Road": a new map (Saltmere), a new enemy (the Legion of Varr)
// and a new trade (salt). Original story data, declarative like the other chapters.

export const SALTROAD_SCENARIO = {
  id: 'saltroad',
  chapter: 4,
  map: 'saltmere',
  title: 'The Salt Road',
  blurb: 'Spring after the Tollbreaker\'s winter. The valley lives on salt, and all of it comes up the Salt Road from the Saltmere beyond the eastern pass. Now the Margravine of Varr has claimed the salt pans and taxes every sack. Maren leads a company over the pass to build a waystation and keep the road free.',
  startResources: { timber: 150, stone: 100, iron: 20, provisions: 100, taler: 120 },
  raidWarningAt: { story: 18 * 60, normal: 14 * 60, hard: 12 * 60 },
  raidWarnAfter: 'none', // the legion marches on the Margravine's schedule, not ours
  speakers: {
    maren: { name: 'Maren Ashgrove', role: 'Lantern Warden' },
    osric: { name: 'Osric Tallow', role: 'Reeve of Kindlehold' },
    wren: { name: 'Wren Fenmore', role: 'Scout' },
    ysolde: { name: 'Ysolde of Varr', role: 'Margravine of Varr' },
    aelric: { name: 'Aelric of Pannholt', role: 'Salt-reeve of the southern shore' },
  },
  setup: {
    keepLit: false, techs: ['bracing', 'axes'], settlers: 10,
    soldiers: [['shield', 1], 'shield', ['fletcher', 1], 'fletcher', 'blade'],
  },
  // legionaries are tougher than reavers: fewer of them per attack
  ai: { reserves: 0.9, spawnInterval: 1.1, garrisonCap: 1.0, firstRaid: -3, growth: -1 },
  enemy: {
    faction: 'varr', hallBarred: true,
    extraTowers: [[-2, 26], [22, -2]],
    garrison: ['varrspear', 'varrspear', 'varrknight', 'varrbow', 'varrbow', 'varrknight'],
  },
  cinematic: [
    { x: -160, z: -14, zoom: 70, yaw: 1.2, line: 0 },
    { x: 30, z: 60, zoom: 150, yaw: 0.5, line: 1 },
    { x: 120, z: -70, zoom: 64, yaw: 3.7, line: 2 },
    { x: -108, z: 20, zoom: 60, yaw: 0.6, line: 3 },
  ],
  intro: [
    { speaker: 'wren', text: 'Over the pass and down into the lowlands. That glitter ahead is the Saltmere — half the valley\'s winter depends on what they boil out of it.' },
    { speaker: 'osric', text: 'Salt carts used to come up this road every week. Since the Margravine\'s men took the pans, we have not seen one all spring.' },
    { speaker: 'maren', text: 'Then we make our own. A waystation here at the ford, salt works on the shore, and a road that stays open.' },
    { speaker: 'wren', text: 'The manor on the eastern rise is hers. Red banners, stone walls, crossbows. This is no Rustfang camp, Warden.' },
  ],
  objectives: [
    {
      id: 'waystation', title: 'Light the waystation',
      text: 'Select the Waystation and rekindle its hearth: settlers from the valley will follow the light.',
      hint: 'Left-click the waystation (the round hall), then press "Rekindle the Hearth".',
      highlight: 'keep', activeWhen: { always: true }, completeWhen: { keepLit: true },
      onComplete: [{ speaker: 'maren', text: 'The lantern burns over Lanternford. Now — timber, bread and salt.' }],
    },
    {
      id: 'salt', title: 'Salt and silver',
      text: 'Build two Salt Works on the lake shore and hold 250 Taler.',
      hint: 'The salt pans glitter white on the western shore. A Salt Works must stand within 12 m of one; its salt is sold for Taler.',
      highlight: 'build:saltworks', activeWhen: { completed: 'waystation' },
      completeWhen: { all: [{ built: 'saltworks', count: 2 }, { stock: 'taler', amount: 250 }] },
      onComplete: [{ speaker: 'osric', text: 'Salt in the sacks and silver in the chest. The Margravine will have heard of it by now.' }],
    },
    {
      id: 'pannholt', title: 'The salters of Pannholt',
      text: 'Maren must visit Pannholt on the southern shore.',
      hint: 'Follow the track south along the western shore. Select Maren and right-click near the huts.',
      highlight: 'army', activeWhen: { completed: 'waystation' },
      completeWhen: { poiDone: 'hamlet' },
      onComplete: [{ speaker: 'aelric', text: 'A lantern on the Salt Road again! Pannholt boiled salt for Varr at swordpoint all winter. Our hands and our boats are yours.' }],
    },
    {
      id: 'toll', title: 'The Margravine\'s toll',
      text: 'Pay Ysolde\'s tribute for a truce (Diplomacy) — or stand firm and throw back her first attack.',
      hint: 'Tribute buys five quiet minutes to build walls and soldiers. Refusing costs nothing — until the legion comes.',
      highlight: 'diplomacy', activeWhen: { flag: 'heraldCame' },
      completeWhen: { any: [{ stance: { with: 'p2', is: 'truce' } }, { raidsRepelled: 1 }] },
    },
    {
      id: 'legion', title: 'Break the legion',
      text: 'Survive two attacks of the Legion of Varr.',
      hint: 'Crossbow bolts pierce armour: meet crossbowmen with Bladesmen, knights with Shieldbearers. The manor keeps its gates barred until the field army is broken.',
      highlight: 'army', activeWhen: { flag: 'raidWarned' },
      completeWhen: { any: [{ raidsRepelled: 2 }, { hostSpent: true }] },
      onComplete: [{ speaker: 'maren', text: 'Their field army is broken. The manor must open its gates for bread soon — and we will be waiting.' }],
    },
    {
      id: 'manor', title: 'Take the manor',
      text: 'Defeat Ysolde and bring down the Manor of Varr.',
      hint: 'The Margravine fights at her gate with sword and shield. Two stone towers guard the rise.',
      highlight: 'enemy-camp', activeWhen: { completed: 'legion' },
      completeWhen: { all: [{ unitGone: 'ysolde' }, { destroyed: 'varrkeep' }] },
    },
    {
      id: 'cellar', title: 'Optional: The Salt-King\'s cellar',
      text: 'Find the old salt-kings\' cellar under the northern hills.',
      hint: 'Explore north of the Salt Road; anyone who reaches the ruin can open it.', optional: true,
      highlight: 'army', activeWhen: { completed: 'waystation' },
      completeWhen: { any: [{ poiDone: 'ruin' }] },
    },
  ],
  events: [
    { id: 'quiet-road', when: { minutes: 1 }, say: [{ speaker: 'wren', text: 'Not a cart, not a drover on the whole road. Whoever holds the pans holds the valley by the throat.' }] },
    { id: 'herald', when: { any: [{ completed: 'salt' }, { minutes: 10 }] }, actions: [{ flag: 'heraldCame' }], say: [
      { speaker: 'ysolde', text: 'Travellers from Kindlehold, boiling salt on my shore. The Saltmere belongs to the March of Varr. You may keep your little fire — for a third of every sack, paid to my treasury.' },
      { speaker: 'maren', text: 'The road was free before your banners came, Margravine. It will be free after.' },
      { speaker: 'ysolde', text: 'Brave words cost nothing. My legion does. Pay the tribute, or they will collect it themselves.' },
    ] },
    { id: 'pannholt-gift', when: { completed: 'pannholt' }, actions: [{ grant: { taler: 80, provisions: 40 } }], say: [{ speaker: 'aelric', text: 'Take what we hid from the Margravine\'s tallymen — it was always meant for the road.' }] },
    { id: 'legion-broken', when: { completed: 'legion' }, actions: [{ unflag: 'hallBarred' }], say: [{ speaker: 'wren', text: 'Their gates are open for the supply carts. If we strike now, we are inside before they can bar them again.' }] },
    { id: 'ysolde-down', when: { unitGone: 'ysolde' }, say: [{ speaker: 'maren', text: 'The Margravine has fallen. Bring down her manor — the Salt Road is ours to keep.' }] },
  ],
  warning: [
    { speaker: 'wren', text: 'Red banners on the road — the legion is marching! Pikes in front, crossbows behind.' },
    { speaker: 'maren', text: 'Shields to the ford! Blades for their crossbowmen!' },
  ],
  winWhen: { completed: 'manor' },
  victory: { title: 'The Road Is Free', text: 'The Manor of Varr has fallen and the salt carts roll up the pass again. But among Ysolde\'s letters Osric finds seals of a white stag — someone further down in the lowlands paid the Margravine to close the road. The road east is longer than anyone knew.' },
  defeat: { title: 'The Lantern Goes Out', text: 'Lanternford has fallen, and the Salt Road stays closed. Try again, Warden.' },
};
