// Handcrafted layout of the Iron March (original map), the highlands north of the valley.
// Metres, +Y up, north = -Z. The Iceburn runs from the north-western glacier down to the
// south-east and splits the march in two: the old border fort Stonewatch on the south-western
// slopes, House Morrow's black hold on a mountain shelf in the north-east. Three old border
// beacons stand on the heights; the miners of Delvholm dig under the central crags.

export const IRONMARCH_MAP = Object.freeze({
  id: 'ironmarch',
  half: 192,
  noiseSeed: 7331,
  baseHeight: 4.2,
  noiseAmp: 6,
  minLand: 1.0,
  borderStart: 162,
  borderHeight: 36,
  hills: [
    { x: -160, z: -150, h: 22, r: 60 },  // the Glacier Horn (north-west)
    { x: 170, z: 160, h: 16, r: 50 },    // south-eastern crags
    { x: -30, z: -10, h: 12, r: 34 },    // the Delv crags (centre)
    { x: 130, z: -150, h: 18, r: 46 },   // behind the hold
    { x: -170, z: 40, h: 12, r: 36 },    // western shoulder
    { x: 30, z: 170, h: 10, r: 40 },     // southern fells
    { x: 150, z: 20, h: 9, r: 34 },      // eastern fells
  ],
  flats: [
    { x: -110, z: 110, r: 32, h: 5.2 },  // Stonewatch, the old border fort
    { x: 112, z: -104, r: 32, h: 9.0 },  // the mountain shelf of Morrow Hold
    { x: -52, z: 36, r: 16, h: 5.0 },    // Delvholm, the miners' village
    { x: -132, z: 138, r: 12, h: 5.6 },  // iron terrace by the fort
  ],
  lakes: [
    { x: -80, z: 150, rx: 13, rz: 9, bed: -1.2 },   // Tarn below Stonewatch
    { x: 40, z: -140, rx: 18, rz: 12, bed: -1.4 },  // Blackwater tarn (north)
  ],
  islands: [],
  river: {
    // the Iceburn: from the glacier down the middle of the march to the south-eastern gorge
    points: [[-120, -210], [-96, -150], [-60, -100], [-10, -64], [30, -10], [50, 40], [80, 100], [110, 150], [130, 210]],
    halfWidth: 5,
    bankWidth: 14,
    bedHeight: -1.6,
    fords: [
      { x: -60, z: -100, r: 10, bed: -0.3 },  // Glacier ford (north)
      { x: 30, z: -10, r: 11, bed: -0.3 },    // the Old Bridge ford (middle)
      { x: 80, z: 100, r: 10, bed: -0.3 },    // Gorge ford (south)
    ],
  },
  roads: [
    { id: 'march-road', width: 3.2, points: [[-174, 150], [-140, 126], [-110, 110], [-80, 84], [-52, 36], [-10, 10], [30, -10], [70, -50], [100, -90]] },
    { id: 'beacon-way', width: 2.2, points: [[-80, 84], [-120, 40], [-150, -30]] },
    { id: 'gorge-track', width: 2.2, points: [[-80, 84], [-20, 110], [20, 130], [60, 110], [80, 100]] },
    { id: 'glacier-track', width: 2.2, points: [[-52, 36], [-60, -40], [-60, -100], [-20, -130]] },
  ],
  forests: [
    { x: -140, z: 80, r: 16, count: 40 },
    { x: -90, z: 140, r: 12, count: 20 },
    { x: -150, z: 170, r: 14, count: 24 },
    { x: -100, z: 60, r: 14, count: 28 },
    { x: -110, z: -10, r: 16, count: 28 },
    { x: -10, z: 70, r: 18, count: 30 },
    { x: 60, z: 160, r: 14, count: 18 },
    { x: 90, z: 30, r: 16, count: 24 },
    { x: 150, z: -60, r: 14, count: 18 },
    { x: 0, z: -110, r: 14, count: 18 },
    { x: 120, z: 90, r: 12, count: 14 },
  ],
  rocks: [
    { x: -84, z: 110, count: 4, spread: 5 },
    { x: -124, z: 92, count: 3, spread: 5 },
    { x: -40, z: 20, count: 4, spread: 7 },
    { x: -70, z: -60, count: 3, spread: 6 },
    { x: 40, z: 80, count: 3, spread: 6 },
    { x: 150, z: -10, count: 4, spread: 7 },
    { x: 60, z: -80, count: 3, spread: 6 },
    { x: -150, z: -80, count: 3, spread: 6 },
  ],
  ironVeins: [{ x: -132, z: 138 }, { x: -86, z: 94 }, { x: -64, z: 20 }, { x: -36, z: 50 }, { x: 20, z: 60 }, { x: 130, z: -30 }],
  pois: [
    { type: 'cairn', x: -150, z: -30, label: 'West Beacon', line: ['wren', 'The West Beacon on the shoulder. From up there you can see half the march — once the fire burns again.'] },
    { type: 'cairn', x: 20, z: 130, label: 'South Beacon', line: ['wren', 'The South Beacon above the gorge. Nobody has lit it since the Long Frost.'] },
    { type: 'cairn', x: 64, z: -30, label: 'Iron Beacon', line: ['wren', 'The Iron Beacon — on Morrow\'s side of the Iceburn. Lighting that one will not go unnoticed.'] },
    { type: 'hamlet', x: -52, z: 36, label: 'Delvholm', line: ['wren', 'Delvholm, the miners\' village under the crags. Morrow banners on the pithead — and a bastion over the lane.'] },
    { type: 'trader', x: -20, z: 110, label: 'Tinker\'s Rest', line: ['wren', 'A tinker\'s camp on the gorge track. They trade with anyone who is not wearing black and gold.'] },
    { type: 'ruin', x: 150, z: 120, label: 'The Old Mint', reward: { taler: 300, iron: 40 }, line: ['osric', 'The Morrows struck their own coin once, in a mint by the south-eastern crags. Abandoned since their fortunes turned.'] },
  ],
  playerStart: { x: -110, z: 110 },
  enemyCamp: { x: 112, z: -104 },
  palisade: { r: 25, gateHalfAngle: 0.16, step: 0.034 },
  settlerEntry: { x: -174, z: 152 },
  reinforcementEntry: { x: 176, z: -100 },
});
