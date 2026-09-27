// Handcrafted layout of the Harrowmere valley (original map). Metres, +Y up,
// north = -Z. Player settles the south-west; the Rustfang ford fort lies north-east.

export const HARROWMERE_MAP = Object.freeze({
  id: 'harrowmere',
  half: 192,
  noiseSeed: 4217,
  baseHeight: 3.2,
  noiseAmp: 7,
  minLand: 0.9,
  borderStart: 165,
  borderHeight: 30,
  hills: [
    { x: -104, z: 84, h: 9, r: 34 },    // iron hills (south-west)
    { x: -6, z: 96, h: 6, r: 26 },      // quarry knoll (south)
    { x: 98, z: -98, h: 7, r: 40 },     // behind the fort
    { x: -98, z: -84, h: 15, r: 38 },   // Greymantle crag (north-west)
    { x: 108, z: 64, h: 10, r: 32 },    // Sorrel downs (south-east)
    { x: 36, z: 58, h: 4, r: 26 },
    { x: -30, z: -70, h: 5, r: 30 },
    // the wider valley (level 2.8)
    { x: -150, z: 20, h: 8, r: 34 },    // Westmarch heights
    { x: 0, z: -150, h: 11, r: 44 },    // Northwatch ridge
    { x: 150, z: 110, h: 12, r: 40 },   // Saltbridge downs
    { x: -140, z: 150, h: 9, r: 36 },   // Barrowmoor (south-west)
    { x: 140, z: -150, h: 10, r: 40 },  // beyond the Rustfang fort
  ],
  flats: [
    { x: -46, z: 50, r: 34, h: 3.4 },   // Kindlehold
    { x: 70, z: -68, r: 28, h: 4.6 },   // Rustfang ford fort
    { x: -88, z: 58, r: 16, h: 4.2 },   // mine terrace
    { x: -118, z: -138, r: 28, h: 5 },  // Greyfen hold (brigands)
    { x: -118, z: 22, r: 14, h: 4.2 },  // west iron terrace
    { x: 130, z: 50, r: 20, h: 5 },     // Saltbridge market
  ],
  river: {
    // the Harrow — flows west to east across the valley
    points: [[-210, -46], [-150, -34], [-100, -20], [-58, -26], [-18, -12], [22, -4], [60, 6], [98, -6], [150, 4], [210, 14]],
    halfWidth: 6,
    bankWidth: 13,
    bedHeight: -1.8,
    fords: [
      { x: 22, z: -4, r: 11, bed: -0.3 },    // Tollford (east crossing)
      { x: -100, z: -20, r: 9, bed: -0.3 },  // Reedwade (west crossing)
      { x: 150, z: 4, r: 9, bed: -0.3 },     // Saltford (far east crossing)
    ],
  },
  roads: [
    { id: 'valley-road', width: 3.2, points: [[-96, 96], [-84, 86], [-70, 76], [-58, 64], [-50, 58]] },
    { id: 'north-road', width: 3.4, points: [[-40, 44], [-28, 30], [-14, 16], [4, 6], [22, -4], [38, -22], [54, -44], [66, -60]] },
    { id: 'west-track', width: 2.4, points: [[-52, 44], [-70, 28], [-88, 6], [-100, -20], [-92, -48], [-78, -66]] },
    { id: 'greyfen-track', width: 2.4, points: [[-78, -66], [-92, -96], [-106, -120], [-118, -134]] },
    { id: 'south-road', width: 2.6, points: [[-40, 62], [-20, 90], [6, 118], [12, 136]] },
    { id: 'east-road', width: 2.6, points: [[36, 58], [80, 50], [128, 50]] },
  ],
  forests: [
    { x: -82, z: 32, r: 20, count: 70 },
    { x: -38, z: 12, r: 11, count: 20 },
    { x: -12, z: 58, r: 8, count: 12 },
    { x: -50, z: 94, r: 14, count: 24 },
    { x: 16, z: 42, r: 20, count: 36 },
    { x: -26, z: -54, r: 22, count: 40 },
    { x: 38, z: -38, r: 14, count: 22 },
    { x: 96, z: 16, r: 18, count: 30 },
    { x: -108, z: 6, r: 11, count: 16 },
    { x: 32, z: 94, r: 15, count: 24 },
    { x: 84, z: -104, r: 12, count: 14 },
    { x: -66, z: -30, r: 12, count: 18 },
    { x: -150, z: 56, r: 20, count: 46 },
    { x: 60, z: 132, r: 18, count: 34 },
    { x: -84, z: 142, r: 16, count: 28 },
    { x: 142, z: -8, r: 16, count: 24 },
    { x: -64, z: -132, r: 18, count: 30 },
    { x: 34, z: -128, r: 18, count: 26 },
  ],
  rocks: [
    { x: -20, z: 76, count: 4, spread: 7 },
    { x: -26, z: 88, count: 2, spread: 4 },
    { x: -70, z: 18, count: 3, spread: 5 },
    { x: 6, z: -30, count: 3, spread: 6 },
    { x: 10, z: 140, count: 5, spread: 8 },
    { x: -130, z: 104, count: 3, spread: 6 },
    { x: 118, z: 92, count: 4, spread: 7 },
    { x: -20, z: -118, count: 3, spread: 6 },
  ],
  ironVeins: [{ x: -80, z: 70 }, { x: -118, z: 22 }],
  // places worth exploring (see src/pois/)
  pois: [
    { type: 'trader', x: 8, z: 14 },     // Crossroads trader on the north road
    { type: 'cairn', x: 36, z: 58 },     // Lookout cairn on the eastern knoll
    { type: 'ruin', x: -60, z: -62 },    // Old watch ruins beyond the Harrow (north-west)
    { type: 'hamlet', x: 74, z: 46 },    // Millbrook hamlet (south-east)
    { type: 'trader', x: 130, z: 50, label: 'Saltbridge Market', discount: 0.8, line: ['wren', 'A market town at the far eastern ford — Saltbridge! Their merchants trade on better terms than the crossroads peddler.'] },
    { type: 'cairn', x: 0, z: -150, label: 'Northwatch Cairn' },
    { type: 'cairn', x: -140, z: 150, label: 'Barrowmoor Cairn' },
    { type: 'ruin', x: 140, z: -128, label: 'Tollkeeper\'s Vault', reward: { taler: 200, iron: 40 }, line: ['osric', 'Beyond the Rustfang fort lies the old tollkeeper\'s vault. Whatever Vharek missed may still be down there.'] },
  ],
  brigandCamp: { x: -118, z: -138 },
  playerStart: { x: -46, z: 50 },
  enemyCamp: { x: 72, z: -70 },
  palisade: { r: 25, gateHalfAngle: 0.16, step: 0.034 },
  settlerEntry: { x: -96, z: 96 },
  reinforcementEntry: { x: 100, z: -100 },
});
