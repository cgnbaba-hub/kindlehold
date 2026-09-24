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
  playerStart: { x: -46, z: 50 },
  enemyCamp: { x: 72, z: -70 },
  settlerEntry: { x: -96, z: 96 },
  reinforcementEntry: { x: 100, z: -100 },
});
