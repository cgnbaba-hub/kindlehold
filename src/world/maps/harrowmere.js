// Handcrafted layout of the Harrowmere valley (original map). Metres, +Y up,
// north = -Z. Player settles the south-west; the Rustfang ford fort lies north-east.

export const HARROWMERE_MAP = Object.freeze({
  id: 'harrowmere',
  half: 128,
  noiseSeed: 4217,
  baseHeight: 3.2,
  noiseAmp: 7,
  minLand: 0.9,
  borderStart: 100,
  borderHeight: 30,
  hills: [
    { x: -104, z: 84, h: 9, r: 34 },    // iron hills (south-west)
    { x: -6, z: 96, h: 6, r: 26 },      // quarry knoll (south)
    { x: 98, z: -98, h: 7, r: 40 },     // behind the fort
    { x: -98, z: -84, h: 15, r: 38 },   // Greymantle crag (north-west)
    { x: 108, z: 64, h: 10, r: 32 },    // Sorrel downs (south-east)
    { x: 36, z: 58, h: 4, r: 26 },
    { x: -30, z: -70, h: 5, r: 30 },
  ],
  flats: [
    { x: -46, z: 50, r: 34, h: 3.4 },   // Kindlehold
    { x: 70, z: -68, r: 28, h: 4.6 },   // Rustfang ford fort
    { x: -88, z: 58, r: 16, h: 4.2 },   // mine terrace
  ],
  river: {
    // the Harrow — flows west to east across the valley
    points: [[-150, -34], [-100, -20], [-58, -26], [-18, -12], [22, -4], [60, 6], [98, -6], [150, 4]],
    halfWidth: 6,
    bankWidth: 13,
    bedHeight: -1.8,
    fords: [
      { x: 22, z: -4, r: 11, bed: -0.3 },    // Tollford (east crossing)
      { x: -100, z: -20, r: 9, bed: -0.3 },  // Reedwade (west crossing)
    ],
  },
  roads: [
    { id: 'valley-road', width: 3.2, points: [[-96, 96], [-84, 86], [-70, 76], [-58, 64], [-50, 58]] },
    { id: 'north-road', width: 3.4, points: [[-40, 44], [-28, 30], [-14, 16], [4, 6], [22, -4], [38, -22], [54, -44], [66, -60]] },
    { id: 'west-track', width: 2.4, points: [[-52, 44], [-70, 28], [-88, 6], [-100, -20], [-92, -48], [-78, -66]] },
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
  ],
  rocks: [
    { x: -20, z: 76, count: 4, spread: 7 },
    { x: -26, z: 88, count: 2, spread: 4 },
    { x: 6, z: -30, count: 3, spread: 6 },
  ],
  ironVeins: [{ x: -80, z: 70 }],
  playerStart: { x: -46, z: 50 },
  enemyCamp: { x: 72, z: -70 },
  palisade: { r: 25, gateHalfAngle: 0.16, step: 0.034 },
  settlerEntry: { x: -96, z: 96 },
  reinforcementEntry: { x: 100, z: -100 },
});
