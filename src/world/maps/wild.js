// Random maps for free play ("the Wildlands"): a whole valley generated from one number, so a
// save only needs the world's seed to rebuild it. Same layout vocabulary as the handcrafted maps
// (hills, flats, a river with fords, lakes, forests, rocks, iron, salt, places of interest), with
// guarantees that make every seed playable: the home flat has forest, rock and iron in reach and
// water for a fisher, the river always has a ford between the two seats, nothing blocks a start.
// Metres, +Y up, north = -Z.

function rngFrom(seed) {
  let a = (Number(seed) >>> 0) ^ 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (v) => Math.round(v * 10) / 10;
const pt = (x, z) => ({ x: r1(x), z: r1(z) });

/** Distance from a point to the polyline (for keeping things off the river). */
function distToLine(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

export const WILD_LIMIT = 150; // everything important stays inside this radius (border hills beyond)

/**
 * Generate a map from a seed.
 * @param {number|string} seed
 */
export function generateWildMap(seed) {
  const rnd = rngFrom(typeof seed === 'string' ? [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) : seed);
  const range = (a, b) => a + (b - a) * rnd();
  const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

  // the two seats face each other across the middle of the map
  const axis = rnd() * Math.PI * 2;
  const ux = Math.sin(axis), uz = Math.cos(axis); // from the enemy towards the player
  const vx = uz, vz = -ux; // across the axis
  const home = pt(ux * range(100, 118), uz * range(100, 118));
  const foe = pt(-ux * range(100, 118) + vx * range(-20, 20), -uz * range(100, 118) + vz * range(-20, 20));

  // the river runs across the axis, winding, with a ford near the middle and one or two more
  const off = range(-18, 18);
  const river = [];
  for (let s = -210; s <= 210; s += 42) {
    const wob = s === -210 || s === 210 ? 0 : range(-16, 16);
    river.push([r1(vx * s + ux * (off + wob)), r1(vz * s + uz * (off + wob))]);
  }
  const mid = river[Math.floor(river.length / 2)];
  const fords = [{ x: mid[0], z: mid[1], r: 11, bed: -0.3 }];
  for (const k of [2, river.length - 3]) if (rnd() < 0.8) fords.push({ x: river[k][0], z: river[k][1], r: 9, bed: -0.3 });

  const taken = []; // circles that must stay clear (flats, water)
  const clear = (x, z, r, riverGap = 14) => Math.hypot(x, z) < WILD_LIMIT + 10 && distToLine(x, z, river) > riverGap + r && taken.every((c) => Math.hypot(x - c.x, z - c.z) > c.r + r);
  const place = (r, riverGap, tries = 60, near = null) => {
    for (let i = 0; i < tries; i++) {
      const a = rnd() * Math.PI * 2;
      const d = near ? range(near.min, near.max) : Math.sqrt(rnd()) * WILD_LIMIT;
      const x = (near ? near.x : 0) + Math.sin(a) * d, z = (near ? near.z : 0) + Math.cos(a) * d;
      if (clear(x, z, r, riverGap)) return pt(x, z);
    }
    return null;
  };

  taken.push({ ...home, r: 36 }, { ...foe, r: 34 });
  const flats = [{ ...home, r: 34, h: 3.4 }, { ...foe, r: 30, h: r1(range(4.5, 6)) }];

  // home resources: iron on a terrace, a forest and an outcrop within a workshop's reach
  const ironHome = place(12, 8, 80, { x: home.x, z: home.z, min: 40, max: 52 }) || pt(home.x + vx * 44, home.z + vz * 44);
  flats.push({ ...ironHome, r: 14, h: 4.2 });
  taken.push({ ...ironHome, r: 12 });
  const forestHome = place(14, 6, 80, { x: home.x, z: home.z, min: 36, max: 46 }) || pt(home.x - vx * 40, home.z - vz * 40);
  taken.push({ ...forestHome, r: 12 });
  const rockHome = place(6, 6, 80, { x: home.x, z: home.z, min: 34, max: 42 }) || pt(home.x + ux * 38, home.z + uz * 38);
  taken.push({ ...rockHome, r: 6 });

  // water: a pond near home unless the river is close enough for a fisher, then random lakes
  const lakes = [];
  const saltPans = [];
  if (distToLine(home.x, home.z, river) > 55) {
    const pond = place(12, 10, 80, { x: home.x, z: home.z, min: 44, max: 56 });
    if (pond) { lakes.push({ ...pond, rx: 12, rz: 9, bed: -1.2 }); taken.push({ ...pond, r: 14 }); }
  }
  const lakeCount = Math.floor(range(1, 3.99));
  for (let i = 0; i < lakeCount; i++) {
    const rx = range(16, 34), rz = rx * range(0.6, 0.9);
    const c = place(rx, 18);
    if (!c) continue;
    lakes.push({ ...c, rx: r1(rx), rz: r1(rz), bed: -1.5 });
    taken.push({ ...c, r: rx + 6 });
    // some lakes are salt lakes with pans on the shore
    if (rnd() < 0.5) for (let k = 0; k < 3; k++) { const a = rnd() * Math.PI * 2; saltPans.push(pt(c.x + Math.sin(a) * (rx + 4), c.z + Math.cos(a) * (rz + 4))); }
  }

  // hills away from the seats and the river; a few big ones near the rim
  const hills = [];
  for (let i = 0; i < 10; i++) {
    const r = range(26, 48);
    const c = place(r * 0.55, 6);
    if (c) hills.push({ ...c, h: r1(range(5, 14)), r: r1(r) });
  }
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2, d = range(150, 175);
    hills.push({ ...pt(Math.sin(a) * d, Math.cos(a) * d), h: r1(range(9, 18)), r: r1(range(36, 56)) });
  }

  // forests and rocks
  const forests = [{ ...forestHome, r: 16, count: 56 }];
  const nearFoe = place(10, 6, 60, { x: foe.x, z: foe.z, min: 38, max: 55 });
  if (nearFoe) forests.push({ ...nearFoe, r: 14, count: 30 });
  for (let i = 0; i < 12; i++) {
    const c = place(10, 6);
    if (c) forests.push({ ...c, r: r1(range(10, 20)), count: Math.round(range(14, 40)) });
  }
  const rocks = [{ ...rockHome, count: 4, spread: 6 }];
  for (let i = 0; i < 7; i++) {
    const c = place(6, 8);
    if (c) rocks.push({ ...c, count: Math.round(range(2, 5)), spread: Math.round(range(4, 8)) });
  }
  const ironVeins = [ironHome];
  for (let i = 0; i < 3; i++) {
    const c = place(10, 10);
    if (c) { ironVeins.push(c); flats.push({ ...c, r: 12, h: 4.4 }); taken.push({ ...c, r: 10 }); }
  }

  // a road from home over the middle ford to the enemy seat
  const roads = [{ id: 'wild-road', width: 3.0, points: [[home.x, home.z], [r1((home.x + mid[0]) / 2), r1((home.z + mid[1]) / 2)], [mid[0], mid[1]], [r1((foe.x + mid[0]) / 2), r1((foe.z + mid[1]) / 2)], [foe.x, foe.z]] }];

  // places of interest: a trader by the road, cairns, a hamlet on our side, a ruin far away
  const pois = [];
  const trader = place(8, 10, 60, { x: mid[0], z: mid[1], min: 18, max: 34 });
  if (trader) {
    const label = pick(['Crossroads Market', 'Ford Inn', 'Wayfarers\' Rest']);
    pois.push({ type: 'trader', ...trader, label, line: ['wren', `A merchant's camp near the ford — ${label}. They trade goods for good Taler.`] });
    taken.push({ ...trader, r: 8 });
  }
  const hamlet = place(10, 10, 80, { x: home.x, z: home.z, min: 55, max: 85 });
  if (hamlet) {
    const label = pick(['Ashby', 'Fenwick', 'Mossfold', 'Thornwell']);
    pois.push({ type: 'hamlet', ...hamlet, label, line: ['wren', `Smoke from chimneys — a hamlet called ${label}. They will only trust the Warden herself.`] });
    flats.push({ ...hamlet, r: 14, h: 3.6 }); taken.push({ ...hamlet, r: 12 });
  }
  for (let i = 0; i < 2; i++) {
    const c = place(4, 8);
    if (c) { pois.push({ type: 'cairn', ...c, line: ['wren', 'An old cairn on a rise. Whoever climbs it would see far across the land.'] }); taken.push({ ...c, r: 6 }); }
  }
  let ruin = null;
  for (let i = 0; i < 80 && !ruin; i++) { const c = place(8, 8, 1); if (c && Math.hypot(c.x - home.x, c.z - home.z) > 110) ruin = c; }
  ruin = ruin || place(8, 8);
  if (ruin) pois.push({ type: 'ruin', ...ruin, label: 'Old Vault', reward: { taler: 220, iron: 30 }, line: ['osric', 'Old stones out in the wilds — a vault, they say, sealed since the Long Frost.'] });

  const out = (p, d) => { const l = Math.hypot(p.x, p.z) || 1; return pt((p.x / l) * d, (p.z / l) * d); };
  return Object.freeze({
    id: 'wild',
    seed: String(seed),
    half: 192,
    noiseSeed: Math.floor(range(1000, 9999)),
    baseHeight: r1(range(2.8, 4.0)),
    noiseAmp: r1(range(5, 7.5)),
    minLand: 0.9,
    borderStart: 165,
    borderHeight: 30,
    hills, flats, lakes, islands: [],
    river: { points: river, halfWidth: r1(range(4.5, 6)), bankWidth: 12, bedHeight: -1.7, fords },
    roads, forests, rocks, ironVeins, saltPans, pois,
    playerStart: home,
    enemyCamp: foe,
    palisade: { r: 25, gateHalfAngle: 0.16, step: 0.034 },
    settlerEntry: out(home, 160),
    reinforcementEntry: out(foe, 160),
  });
}
