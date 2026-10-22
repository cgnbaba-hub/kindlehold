// Custom maps (map editor): the same layout vocabulary as the handcrafted maps (hills, flats, a
// river with fords, lakes, roads, forests, rocks, iron, salt, places of interest, two seats), as a
// small JSON object. It travels inside every save (world.meta.customMap), so a game on a custom map
// loads anywhere. Maps typed in or imported are untrusted: normalizeMap() keeps only known fields,
// rounds and clamps every number and caps every list; validateMap() checks a finished map strictly
// (saves); mapProblems() says what would make it unplayable or unfair.
import { v, ValidationError, validate } from '../core/validate.js';
import { distToPolyline } from '../world/terrain-data.js';

export const MAP_HALF = 192;
export const MAP_LIMIT = 160; // everything stays inside this square (border mountains beyond 165)
export const LIMITS = { hills: 40, flats: 16, lakes: 8, islands: 6, river: 16, fords: 5, roads: 8, roadPoints: 16, forests: 60, rocks: 40, iron: 8, salt: 6, pois: 12 };
export const POI_TYPES = ['trader', 'cairn', 'ruin', 'hamlet'];
const START_FLAT = { r: 34, h: 3.4 }, CAMP_FLAT = { r: 28, h: 4.6 };

const r1 = (x) => Math.round(x * 10) / 10;
const num = (x, lo, hi, d) => (Number.isFinite(Number(x)) ? Math.min(hi, Math.max(lo, Number(x))) : d);
const coord = (x, d = 0) => r1(num(x, -MAP_LIMIT, MAP_LIMIT, d));
const list = (a, max) => (Array.isArray(a) ? a.slice(0, max) : []);
const text = (s, max) => String(s ?? '').replace(/[^\p{L}\p{N} '’.,!?-]/gu, '').trim().slice(0, max);
const out = (p, d) => { const l = Math.hypot(p.x, p.z) || 1; return { x: r1((p.x / l) * d), z: r1((p.z / l) * d) }; };

/** A gentle valley to start from: meadows, a river with one ford, the two seats facing each other. */
export function blankMap(name = 'New valley') {
  return normalizeMap({
    name, noiseSeed: 2024, baseHeight: 3.2, noiseAmp: 5,
    hills: [{ x: -110, z: 110, h: 8, r: 34 }, { x: 110, z: -110, h: 8, r: 34 }],
    river: { points: [[-200, 10], [-100, 0], [0, 6], [100, -4], [200, 4]], halfWidth: 5, fords: [{ x: 0, z: 6, r: 11 }] },
    forests: [{ x: -60, z: 100, r: 18, count: 40 }, { x: 60, z: -100, r: 18, count: 40 }],
    rocks: [{ x: -110, z: 60, count: 4, spread: 6 }, { x: 110, z: -60, count: 4, spread: 6 }],
    ironVeins: [{ x: -80, z: 120 }, { x: 80, z: -120 }],
    pois: [{ type: 'trader', x: 20, z: 30 }, { type: 'ruin', x: -130, z: -120 }],
    playerStart: { x: -100, z: 90 }, enemyCamp: { x: 100, z: -90 },
  });
}

/** An editable copy of a built-in map. */
export function mapFrom(map, name) {
  return normalizeMap({ ...map, name });
}

/** Keep only what a map may hold, rounded and clamped, with the derived parts filled in. */
export function normalizeMap(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const playerStart = { x: coord(m.playerStart && m.playerStart.x, -100), z: coord(m.playerStart && m.playerStart.z, 90) };
  const enemyCamp = { x: coord(m.enemyCamp && m.enemyCamp.x, 100), z: coord(m.enemyCamp && m.enemyCamp.z, -90) };
  const rv = m.river && typeof m.river === 'object' ? m.river : {};
  let pts = list(rv.points, LIMITS.river).map((p) => [r1(num(p && p[0], -210, 210, 0)), r1(num(p && p[1], -210, 210, 0))]);
  if (pts.length < 2) pts = [[-200, 150], [200, 150]]; // a river is required: along the southern edge
  // (the seats' own flats are derived: an already normalized map does not get them twice)
  const seatFlat = (f) => [m.playerStart, m.enemyCamp].some((s) => s && Math.hypot(f.x - s.x, f.z - s.z) < 4);
  const flats = list(m.flats, LIMITS.flats + 2).filter((f) => f && !seatFlat(f)).slice(0, LIMITS.flats)
    .map((f) => ({ x: coord(f.x), z: coord(f.z), r: r1(num(f.r, 8, 40, 16)), h: r1(num(f.h, 1, 8, 3.5)) }));
  return {
    id: 'custom',
    name: text(m.name, 32) || 'Untitled valley',
    half: MAP_HALF,
    noiseSeed: Math.round(num(m.noiseSeed, 1, 99999, 2024)),
    baseHeight: r1(num(m.baseHeight, 1.5, 6, 3.2)),
    noiseAmp: r1(num(m.noiseAmp, 0, 9, 5)),
    minLand: 0.9,
    borderStart: 165,
    borderHeight: 30,
    hills: list(m.hills, LIMITS.hills).map((h) => ({ x: coord(h.x), z: coord(h.z), h: r1(num(h.h, -6, 18, 6)), r: r1(num(h.r, 8, 60, 26)) })),
    // the two seats always stand on level ground of their own
    flats: [...flats, { x: playerStart.x, z: playerStart.z, ...START_FLAT }, { x: enemyCamp.x, z: enemyCamp.z, ...CAMP_FLAT }],
    lakes: list(m.lakes, LIMITS.lakes).map((l) => ({ x: coord(l.x), z: coord(l.z), rx: r1(num(l.rx, 8, 50, 20)), rz: r1(num(l.rz, 8, 50, 16)), bed: r1(num(l.bed, -3, -0.6, -1.6)) })),
    islands: list(m.islands, LIMITS.islands).map((i) => ({ x: coord(i.x), z: coord(i.z), rx: r1(num(i.rx, 4, 20, 8)), rz: r1(num(i.rz, 4, 20, 6)), h: r1(num(i.h, 0.5, 4, 1.5)) })),
    river: {
      points: pts,
      halfWidth: r1(num(rv.halfWidth, 3, 8, 5)),
      bankWidth: r1(num(rv.bankWidth, 9, 16, 12)),
      bedHeight: r1(num(rv.bedHeight, -2.5, -1, -1.7)),
      fords: list(rv.fords, LIMITS.fords).map((f) => ({ x: coord(f.x), z: coord(f.z), r: r1(num(f.r, 6, 14, 10)), bed: -0.3 })),
    },
    roads: list(m.roads, LIMITS.roads).map((rd, i) => ({ id: `road-${i + 1}`, width: r1(num(rd.width, 2, 4, 2.8)), points: list(rd.points, LIMITS.roadPoints).map((p) => [coord(p && p[0]), coord(p && p[1])]) })).filter((rd) => rd.points.length >= 2),
    forests: list(m.forests, LIMITS.forests).map((f) => ({ x: coord(f.x), z: coord(f.z), r: r1(num(f.r, 4, 30, 14)), count: Math.round(num(f.count, 1, 90, 24)) })),
    rocks: list(m.rocks, LIMITS.rocks).map((c) => ({ x: coord(c.x), z: coord(c.z), count: Math.round(num(c.count, 1, 8, 3)), spread: r1(num(c.spread, 2, 10, 5)) })),
    ironVeins: list(m.ironVeins, LIMITS.iron).map((p) => ({ x: coord(p.x), z: coord(p.z) })),
    saltPans: list(m.saltPans, LIMITS.salt).map((p) => ({ x: coord(p.x), z: coord(p.z) })),
    pois: list(m.pois, LIMITS.pois).filter((p) => POI_TYPES.includes(p && p.type)).map((p) => ({
      type: p.type, x: coord(p.x), z: coord(p.z), ...(text(p.label, 32) ? { label: text(p.label, 32) } : {}),
      ...(p.type === 'ruin' ? { reward: { taler: 200, iron: 30 } } : {}),
    })),
    playerStart, enemyCamp,
    palisade: { r: 25, gateHalfAngle: 0.16, step: 0.034 },
    settlerEntry: out(playerStart, 160),
    reinforcementEntry: out(enemyCamp, 160),
  };
}

// --- strict check of a finished map (saves; anything normalize could not have produced fails) ------
const n = (lo, hi) => v.number({ min: lo, max: hi });
const c = n(-MAP_LIMIT, MAP_LIMIT);
const pt = v.object({ x: c, z: c }, { allowExtra: false });
const pair = (lo, hi) => (x, p) => { if (!Array.isArray(x) || x.length !== 2) throw new ValidationError('expected [x, z]', p); n(lo, hi)(x[0], p); n(lo, hi)(x[1], p); };
const schema = v.object({
  id: v.string({ oneOf: ['custom'] }), name: v.string({ max: 32 }), half: n(MAP_HALF, MAP_HALF), noiseSeed: v.number({ min: 1, max: 99999, int: true }),
  baseHeight: n(1.5, 6), noiseAmp: n(0, 9), minLand: n(0.9, 0.9), borderStart: n(165, 165), borderHeight: n(30, 30),
  hills: v.array(v.object({ x: c, z: c, h: n(-6, 18), r: n(8, 60) }, { allowExtra: false }), { max: LIMITS.hills }),
  flats: v.array(v.object({ x: c, z: c, r: n(8, 40), h: n(1, 8) }, { allowExtra: false }), { max: LIMITS.flats + 2 }),
  lakes: v.array(v.object({ x: c, z: c, rx: n(8, 50), rz: n(8, 50), bed: n(-3, -0.6) }, { allowExtra: false }), { max: LIMITS.lakes }),
  islands: v.array(v.object({ x: c, z: c, rx: n(4, 20), rz: n(4, 20), h: n(0.5, 4) }, { allowExtra: false }), { max: LIMITS.islands }),
  river: v.object({
    points: v.array(pair(-210, 210), { max: LIMITS.river }), halfWidth: n(3, 8), bankWidth: n(9, 16), bedHeight: n(-2.5, -1),
    fords: v.array(v.object({ x: c, z: c, r: n(6, 14), bed: n(-0.3, -0.3) }, { allowExtra: false }), { max: LIMITS.fords }),
  }, { allowExtra: false }),
  roads: v.array(v.object({ id: v.string({ max: 12 }), width: n(2, 4), points: v.array(pair(-MAP_LIMIT, MAP_LIMIT), { max: LIMITS.roadPoints }) }, { allowExtra: false }), { max: LIMITS.roads }),
  forests: v.array(v.object({ x: c, z: c, r: n(4, 30), count: v.number({ min: 1, max: 90, int: true }) }, { allowExtra: false }), { max: LIMITS.forests }),
  rocks: v.array(v.object({ x: c, z: c, count: v.number({ min: 1, max: 8, int: true }), spread: n(2, 10) }, { allowExtra: false }), { max: LIMITS.rocks }),
  ironVeins: v.array(pt, { max: LIMITS.iron }),
  saltPans: v.array(pt, { max: LIMITS.salt }),
  pois: v.array(v.object({ type: v.string({ oneOf: POI_TYPES }), x: c, z: c, label: v.optional(v.string({ max: 32 })), reward: v.optional(v.object({ taler: n(200, 200), iron: n(30, 30) }, { allowExtra: false })) }, { allowExtra: false }), { max: LIMITS.pois }),
  playerStart: pt, enemyCamp: pt,
  palisade: v.object({ r: n(25, 25), gateHalfAngle: n(0.16, 0.16), step: n(0.034, 0.034) }, { allowExtra: false }),
  settlerEntry: v.object({ x: n(-200, 200), z: n(-200, 200) }, { allowExtra: false }),
  reinforcementEntry: v.object({ x: n(-200, 200), z: n(-200, 200) }, { allowExtra: false }),
}, { allowExtra: false });

/** Throws a ValidationError unless `map` is a finished custom map. */
export function validateMap(map, root = 'map') {
  validate(schema, map, root);
  if (map.river.points.length < 2) throw new ValidationError('a river needs two points', `${root}.river`);
  return map;
}
/** Schema function for the save format. */
export const customMapSchema = (x, p) => validateMap(x, p);

/**
 * What stands in the way of a fair game: `errors` block playing, `warnings` are advice.
 * `height(x, z)` is the terrain height (rawHeight of the map; water below 0).
 */
export function mapProblems(map, height) {
  const errors = [], warnings = [];
  const dry = (p) => height(p.x, p.z) > 0.4 && distToPolyline(p.x, p.z, map.river.points) > map.river.bankWidth + 8;
  if (!dry(map.playerStart)) errors.push('Your Keep would stand in water or on the riverbank: move your start.');
  if (!dry(map.enemyCamp)) errors.push('The enemy seat would stand in water or on the riverbank: move it.');
  const apart = Math.hypot(map.playerStart.x - map.enemyCamp.x, map.playerStart.z - map.enemyCamp.z);
  if (apart < 110) errors.push(`The two seats are only ${Math.round(apart)} m apart: at least 110 m.`);
  for (const [label, at] of [['your start', map.playerStart], ['the enemy seat', map.enemyCamp]]) {
    const d = (p) => Math.hypot(p.x - at.x, p.z - at.z);
    if (!map.forests.some((f) => d(f) - f.r < 36)) warnings.push(`No forest within reach of ${label} (36 m): timber will be scarce.`);
    if (!map.rocks.some((r) => d(r) < 50)) warnings.push(`No rocks within 50 m of ${label}: no Quarry near home.`);
    if (!map.ironVeins.some((r) => d(r) < 60)) warnings.push(`No iron within 60 m of ${label}: no soldiers without trade.`);
  }
  if (!map.river.fords.length && !map.roads.length) warnings.push('The river has no ford: armies may not find a way across.');
  if (!map.pois.some((p) => p.type === 'ruin')) warnings.push('No ruin: the optional goal "Explore the land" cannot be met.');
  return { errors, warnings };
}
