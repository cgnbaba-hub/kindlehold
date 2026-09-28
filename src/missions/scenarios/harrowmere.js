// "The Rekindling of Harrowmere" — original scenario data. Declarative only: conditions
// are small JSON-like objects evaluated by src/missions/conditions.js (no script hooks).

export const HARROWMERE_SCENARIO = {
  id: 'harrowmere',
  chapter: 1,
  title: 'The Rekindling of Harrowmere',
  blurb: 'Seven winters after the Long Frost, the Hearthbound return to the burnt keep of Kindlehold. The Rustfang toll-raiders who hold the ford will not welcome them.',
  startResources: { timber: 80, stone: 60, iron: 0, provisions: 40, taler: 60 },
  raidWarningAt: { story: 18 * 60, normal: 14 * 60, hard: 13 * 60 }, // seconds, if not triggered earlier
  speakers: {
    maren: { name: 'Maren Ashgrove', role: 'Lantern Warden' },
    osric: { name: 'Osric Tallow', role: 'Reeve of Kindlehold' },
    wren: { name: 'Wren Fenmore', role: 'Scout' },
    vharek: { name: 'Vharek the Tollbreaker', role: 'Rustfang warlord' },
    morwen: { name: 'Morwen Greyfen', role: 'Chieftain of the Greyfen brigands' },
  },
  cinematic: [
    { x: 20, z: -6, zoom: 120, yaw: 0.5, line: null },
    { x: -46, z: 50, zoom: 48, yaw: 0.9, line: 0 },
    { x: 72, z: -70, zoom: 62, yaw: 3.6, line: null },
    { x: -46, z: 50, zoom: 60, yaw: 0.6, line: 1 },
  ],
  intro: [
    { speaker: 'osric', text: 'Seven winters cold, Warden. The hall still stands, but nobody will stay while the hearth is dark.' },
    { speaker: 'maren', text: 'Then we light it. Once the fire burns, the valley folk will come home.' },
  ],
  objectives: [
    {
      id: 'rekindle', title: 'Rekindle the hearth',
      text: 'Select the Keep and press "Rekindle the Hearth".',
      hint: 'Left-click the Keep (the round stone hall), then use the button in the command panel.',
      highlight: 'keep', activeWhen: { always: true }, completeWhen: { keepLit: true },
      onComplete: [{ speaker: 'maren', text: 'The fire takes! Look — smoke on the valley road. Our people are coming.' }],
    },
    {
      id: 'timber-food', title: 'Timber and bread',
      text: "Build a Woodcutter's Lodge near the western trees and a Farmstead on open ground.",
      hint: 'Press {buildMenu} or open the Build menu. Green outlines are valid spots; the Lodge needs trees within 28 m. Tip: select labourers and right-click a tree to fell timber by hand meanwhile.',
      highlight: 'build', activeWhen: { completed: 'rekindle' },
      completeWhen: { all: [{ built: 'lodge', count: 1 }, { built: 'farm', count: 1 }] },
      onComplete: [{ speaker: 'osric', text: 'Logs and grain moving again. We will need roofs for the newcomers.' }],
    },
    {
      id: 'growth', title: 'Room to grow',
      text: 'Build 2 Cottages and reach 12 people.',
      hint: 'Each Cottage houses five. Settlers arrive while there is free housing and provisions in the store.',
      highlight: 'build:cottage', activeWhen: { completed: 'timber-food' },
      completeWhen: { all: [{ built: 'cottage', count: 2 }, { pop: 12 }] },
      onComplete: [{ speaker: 'maren', text: 'A proper village. Now we need stone for walls and iron for blades.' }],
    },
    {
      id: 'stone-iron', title: 'Stone and iron',
      text: 'Build a Quarry and an Iron Mine, and produce 20 iron.',
      hint: 'The rock outcrops lie south-east of the Keep; the iron vein is under the western hill. Miners eat provisions.',
      highlight: 'build:mine', activeWhen: { completed: 'growth' },
      completeWhen: { all: [{ built: 'quarry', count: 1 }, { built: 'mine', count: 1 }, { produced: 'iron', amount: 20 }] },
      onComplete: [{ speaker: 'osric', text: 'Good iron, Warden. Enough for spear-points, if you have hands to hold them.' }],
    },
    {
      id: 'arms', title: 'Take up arms',
      text: 'Build a Barracks and train 6 soldiers.',
      hint: 'Training turns an idle settler into a soldier. Shieldbearers beat blades, Bladesmen beat archers, Fletchers beat shields.',
      highlight: 'build:barracks', activeWhen: { completed: 'stone-iron' },
      completeWhen: { all: [{ built: 'barracks', count: 1 }, { soldiers: 6 }] },
    },
    {
      id: 'survive', title: 'Hold Kindlehold',
      text: 'Survive the Rustfang raid.',
      hint: 'Group soldiers with Ctrl+1 and right-click raiders to attack. Maren: {abilityFlare} = Beacon Flare (blinds a group), {abilityKindle} = Kindle the Line (wards allies). The Keep\'s archers help defend it.',
      highlight: 'army', activeWhen: { flag: 'raidWarned' },
      completeWhen: { raidsRepelled: 1 },
      onComplete: [
        { speaker: 'maren', text: 'They break! Now we end this — march on the ford fort and burn Vharek\'s hall.' },
      ],
    },
    {
      id: 'strike', title: 'Break the toll',
      text: 'Destroy the Rustfang Warhall at the ford fort (north-east).',
      hint: 'Cross the river at the Tollford. Lookout towers guard the camp; Vharek defends his hall when it is threatened.',
      highlight: 'enemy-camp', activeWhen: { completed: 'survive' },
      completeWhen: { destroyed: 'warhall' },
    },
    {
      id: 'charter', title: 'Optional: The March Charter',
      text: 'Research the March Charter and build a Watchtower.',
      hint: 'Research at the Keep. Watchtowers shoot raiders within 16 m.', optional: true,
      highlight: 'research', activeWhen: { completed: 'growth' },
      completeWhen: { all: [{ tech: 'charter' }, { built: 'tower', count: 1 }] },
    },
  ],
  warning: [
    { speaker: 'wren', text: 'Warden! Rustfang war-horns at the ford — a raiding party is gathering. Two minutes, maybe less.' },
    { speaker: 'maren', text: 'Bring everyone inside the walls of the village. Soldiers to the north road!' },
  ],
  victory: { title: 'The Toll Is Broken', text: 'The Warhall burns and the Rustfang scatter into the hills. For the first time in seven winters, the Harrowmere ford is free — and Kindlehold\'s hearth can be seen from both banks.' },
  defeat: { title: 'The Hearth Goes Dark', text: 'Kindlehold has fallen. The valley folk scatter once more — but embers remember. Try again, Warden.' },
};
