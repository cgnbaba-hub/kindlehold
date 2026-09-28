// Handcrafted layout of the Whitehart vale (original map), the lowland forest south-east of the
// Saltmere. Metres, +Y up, north = -Z. The broad Varrow river runs north to south through the
// middle of the vale; three villages lie along it, each held by an outpost of the Order of the
// White Stag, whose walled chapterhouse stands on the eastern downs.

export const WHITEHART_MAP = Object.freeze({
  id: 'whitehart',
  half: 192,
  noiseSeed: 5147,
  baseHeight: 3.1,
  noiseAmp: 5.5,
  minLand: 0.9,
  borderStart: 165,
  borderHeight: 28,
  hills: [
    { x: -150, z: -40, h: 11, r: 42 },   // the Hartwood heights (west)
    { x: -160, z: 110, h: 9, r: 36 },    // south-western downs
    { x: 130, z: -40, h: 7, r: 44 },     // the Chapter downs under the chapterhouse
    { x: 150, z: -150, h: 12, r: 40 },   // north-eastern crags
    { x: 140, z: 140, h: 9, r: 38 },     // south-eastern hills
    { x: -60, z: -160, h: 10, r: 40 },   // northern ridge
    { x: 60, z: 40, h: 4, r: 30 },
  ],
  flats: [
    { x: -120, z: 40, r: 32, h: 3.6 },   // the camp at Hartsgate
    { x: 125, z: -40, r: 32, h: 6.6 },   // the Chapterhouse of the White Stag
    { x: -52, z: -104, r: 16, h: 3.0 },  // Ashby (north-west, this side of the river)
    { x: 76, z: 118, r: 16, h: 2.6 },    // Thornwick (south, beyond the lower ford)
    { x: 70, z: -128, r: 16, h: 3.4 },   // Coldwell (north, under the crags)
    { x: -140, z: 64, r: 12, h: 4.4 },   // iron terrace below the western heights
    { x: 14, z: 30, r: 12, h: 2.4 },     // the middle ford
  ],
  lakes: [
    { x: -86, z: 76, rx: 13, rz: 9, bed: -1.2 },   // Hart's Mere by the camp
    { x: -120, z: -140, rx: 22, rz: 16, bed: -1.3 }, // Bittern Water (north-west)
  ],
  islands: [],
  river: {
    // the Varrow: out of the northern hills, down the vale, into the southern marshes
    points: [[4, -210], [0, -150], [12, -100], [22, -50], [16, 0], [14, 30], [24, 80], [34, 130], [26, 210]],
    halfWidth: 5,
    bankWidth: 14,
    bedHeight: -1.7,
    fords: [
      { x: 13, z: -96, r: 10, bed: -0.3 },  // Coldwell ford (north)
      { x: 14, z: 30, r: 11, bed: -0.3 },   // the King's ford (middle)
      { x: 30, z: 110, r: 10, bed: -0.3 },  // Thornwick ford (south)
    ],
  },
  roads: [
    { id: 'kings-road', width: 3.2, points: [[-176, 36], [-150, 38], [-120, 40], [-80, 36], [-40, 30], [14, 30], [50, 10], [86, -20], [110, -30]] },
    { id: 'ashby-lane', width: 2.4, points: [[-80, 36], [-70, -20], [-60, -70], [-52, -100]] },
    { id: 'thornwick-lane', width: 2.4, points: [[50, 10], [44, 60], [34, 104], [60, 116], [76, 118]] },
    { id: 'coldwell-lane', width: 2.2, points: [[-60, -70], [-20, -92], [13, -96], [44, -116], [70, -128]] },
  ],
  forests: [
    { x: -150, z: 10, r: 18, count: 48 },
    { x: -96, z: 6, r: 14, count: 30 },
    { x: -140, z: 90, r: 14, count: 24 },
    { x: -100, z: -50, r: 20, count: 44 },
    { x: -30, z: -40, r: 18, count: 26 },
    { x: -40, z: 90, r: 20, count: 28 },
    { x: -20, z: 160, r: 16, count: 18 },
    { x: 60, z: -60, r: 16, count: 22 },
    { x: 90, z: 60, r: 18, count: 24 },
    { x: 150, z: 60, r: 14, count: 16 },
    { x: 110, z: -120, r: 14, count: 16 },
    { x: -150, z: -110, r: 14, count: 14 },
    { x: 40, z: -160, r: 14, count: 14 },
  ],
  rocks: [
    { x: -104, z: 18, count: 4, spread: 6 },
    { x: -138, z: 24, count: 3, spread: 5 },
    { x: -150, z: 56, count: 3, spread: 5 },
    { x: -70, z: -60, count: 3, spread: 6 },
    { x: 40, z: -30, count: 3, spread: 6 },
    { x: 100, z: 150, count: 3, spread: 6 },
    { x: 150, z: -100, count: 4, spread: 7 },
  ],
  ironVeins: [{ x: -140, z: 64 }, { x: -84, z: -124 }],
  pois: [
    { type: 'hamlet', x: -52, z: -104, label: 'Ashby', line: ['wren', 'Ashby, a charcoal-burners\' village at the edge of the Hartwood — and a white banner over its well. The Order is there.'] },
    { type: 'hamlet', x: 76, z: 118, label: 'Thornwick', line: ['wren', 'Thornwick beyond the lower ford. Stag longbows on the tower, and the villagers working the Order\'s fields.'] },
    { type: 'hamlet', x: 70, z: -128, label: 'Coldwell', line: ['wren', 'Coldwell under the crags — closest to the chapterhouse, and the best guarded of the three.'] },
    { type: 'trader', x: -30, z: 40, label: 'Hart & Hound', line: ['wren', 'An inn on the King\'s Road — the Hart & Hound. The landlord trades, as long as nobody in white is watching.'] },
    { type: 'cairn', x: -60, z: -160, label: 'Ridge Cairn' },
    { type: 'ruin', x: -150, z: 150, label: 'Old Abbey Crypt', reward: { taler: 220, iron: 30 }, line: ['osric', 'The Order was founded in an abbey down in the south-west, they say. Long abandoned — but monks never took their silver with them.'] },
  ],
  playerStart: { x: -120, z: 40 },
  enemyCamp: { x: 125, z: -40 },
  palisade: { r: 25, gateHalfAngle: 0.16, step: 0.034 },
  settlerEntry: { x: -174, z: 34 },
  reinforcementEntry: { x: 174, z: -40 },
});
