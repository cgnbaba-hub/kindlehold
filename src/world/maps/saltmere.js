// Handcrafted layout of the Saltmere lowlands (original map), east of Harrowmere beyond the
// pass. Metres, +Y up, north = -Z. A broad salt lake fills the south-east; the Salt Road runs
// along its northern shore from the western pass to the Margravine's manor on the eastern rise.

export const SALTMERE_MAP = Object.freeze({
  id: 'saltmere',
  half: 192,
  noiseSeed: 8819,
  baseHeight: 2.9,
  noiseAmp: 5,
  minLand: 0.9,
  borderStart: 165,
  borderHeight: 28,
  hills: [
    { x: -40, z: -150, h: 12, r: 50 },   // the Northreach ridge
    { x: -160, z: 70, h: 10, r: 40 },    // Westfold heights (iron)
    { x: 130, z: -84, h: 7, r: 42 },     // the rise under the manor
    { x: 150, z: 140, h: 6, r: 36 },     // south-eastern dunes
    { x: 140, z: -160, h: 12, r: 40 },   // beyond the manor
    { x: -120, z: -90, h: 8, r: 34 },    // Lanternford's northern hill
    { x: 20, z: -100, h: 5, r: 30 },
  ],
  flats: [
    { x: -110, z: 20, r: 32, h: 3.4 },   // Lanternford waystation
    { x: 120, z: -70, r: 30, h: 6.2 },   // the Margravine's manor
    { x: -150, z: 60, r: 14, h: 4.8 },   // iron terrace
    { x: -30, z: 132, r: 16, h: 1.6 },   // Pannholt on the southern shore
    { x: 0, z: -40, r: 14, h: 3.2 },     // Salt Road crossroads
  ],
  lakes: [
    { x: 40, z: 72, rx: 92, rz: 56, bed: -1.7 },   // the Saltmere
    { x: -150, z: 150, rx: 26, rz: 18, bed: -1.2 }, // Heron pool (south-west)
  ],
  islands: [
    { x: 58, z: 84, rx: 16, rz: 11, h: 1.5 },      // Gull isle
  ],
  river: {
    // the Salt Run: from the Northreach down past Lanternford into the lake
    points: [[-70, -210], [-72, -140], [-62, -90], [-56, -50], [-44, -12], [-26, 22], [-8, 46], [6, 60]],
    halfWidth: 4.5,
    bankWidth: 10,
    bedHeight: -1.6,
    fords: [
      { x: -56, z: -50, r: 9, bed: -0.3 },   // Millstone ford (north)
      { x: -44, z: -12, r: 9, bed: -0.3 },   // Salt Road ford
    ],
  },
  roads: [
    { id: 'salt-road', width: 3.2, points: [[-176, -18], [-150, -8], [-120, 4], [-86, 4], [-60, -6], [-44, -12], [-20, -30], [0, -40], [40, -50], [80, -58], [108, -64]] },
    { id: 'pannholt-track', width: 2.4, points: [[-104, 36], [-92, 70], [-74, 104], [-52, 126], [-30, 132]] },
    { id: 'north-track', width: 2.4, points: [[0, -40], [-4, -80], [-16, -118]] },
    { id: 'east-shore', width: 2.2, points: [[40, -50], [74, -10], [104, 18], [134, 30]] },
  ],
  forests: [
    { x: -140, z: 0, r: 20, count: 56 },
    { x: -86, z: -30, r: 16, count: 34 },
    { x: -130, z: 60, r: 14, count: 22 },
    { x: -150, z: -60, r: 18, count: 36 },
    { x: -96, z: 70, r: 12, count: 18 },
    { x: -20, z: -80, r: 18, count: 30 },
    { x: 30, z: -110, r: 16, count: 26 },
    { x: -70, z: 150, r: 14, count: 20 },
    { x: 80, z: -120, r: 14, count: 20 },
    { x: 150, z: -20, r: 12, count: 16 },
    { x: -160, z: 120, r: 12, count: 16 },
  ],
  rocks: [
    { x: -76, z: 42, count: 4, spread: 6 },
    { x: -150, z: 34, count: 3, spread: 5 },
    { x: -34, z: -64, count: 3, spread: 6 },
    { x: 60, z: -90, count: 4, spread: 7 },
    { x: 150, z: 96, count: 3, spread: 6 },
    { x: -100, z: -120, count: 3, spread: 6 },
  ],
  ironVeins: [{ x: -154, z: 66 }, { x: -100, z: -86 }],
  // salt pans on the lake shore: the Salt Works harvest them without end
  saltPans: [{ x: -58, z: 64 }, { x: -50, z: 38 }, { x: -62, z: 92 }, { x: 62, z: 8 }, { x: 98, z: 22 }, { x: 120, z: 40 }],
  pois: [
    { type: 'trader', x: 4, z: -46, label: 'Salt Road Inn', line: ['wren', 'An inn at the Salt Road crossroads. The innkeeper buys and sells — and hears every rumour between the pass and the manor.'] },
    { type: 'cairn', x: -18, z: -118, label: 'Northreach Cairn' },
    { type: 'hamlet', x: -30, z: 132, label: 'Pannholt', line: ['wren', 'Salt-boilers\' huts on the southern shore — Pannholt. They look like people who have paid too many tolls.'] },
    { type: 'ruin', x: 60, z: -130, label: 'Salt-King\'s Cellar', reward: { taler: 250, iron: 30 }, line: ['osric', 'The old salt-kings kept their silver under the northern hills. The cellar is still sealed, they say.'] },
    { type: 'cairn', x: 150, z: 120, label: 'Dune Cairn' },
  ],
  playerStart: { x: -110, z: 20 },
  enemyCamp: { x: 120, z: -70 },
  palisade: { r: 25, gateHalfAngle: 0.16, step: 0.034 },
  settlerEntry: { x: -172, z: -14 },
  reinforcementEntry: { x: 172, z: -76 },
});
