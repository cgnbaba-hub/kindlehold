// Deterministic heightfield for a map layout. Pure data — used by the simulation
// (slope/water/navigation) and by terrain rendering. No three.js here.
import { fbm2, valueNoise2 } from '../core/rng.js';

export const WATER_LEVEL = 0;

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t, cz = az + dz * t;
  return Math.hypot(px - cx, pz - cz);
}

export function distToPolyline(px, pz, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Raw analytic height at (x, z) for a map layout.
 * @param {object} map layout (see maps/harrowmere.js)
 */
export function rawHeight(map, x, z) {
  const s = map.noiseSeed;
  let h = map.baseHeight + (fbm2(x * 0.017 + 100, z * 0.017 + 100, s, 4) - 0.5) * map.noiseAmp;
  // fine ground undulation
  h += (valueNoise2(x * 0.11, z * 0.11, s + 7) - 0.5) * 0.35;
  for (const hill of map.hills) {
    const d2 = (x - hill.x) ** 2 + (z - hill.z) ** 2;
    const bump = Math.exp(-d2 / (2 * (hill.r * 0.5) ** 2));
    const rough = 0.75 + 0.5 * fbm2(x * 0.05, z * 0.05, s + 31, 3);
    h += hill.h * bump * rough;
  }
  // border mountains keep the play space enclosed
  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > map.borderStart) {
    const t = (edge - map.borderStart) / (map.half - map.borderStart);
    h += t * t * map.borderHeight * (0.7 + 0.6 * fbm2(x * 0.04, z * 0.04, s + 91, 3));
  }
  // flattened building grounds
  for (const f of map.flats) {
    const d = Math.hypot(x - f.x, z - f.z);
    const w = 1 - smoothstep(f.r * 0.55, f.r, d);
    h = h * (1 - w) + (f.h + (valueNoise2(x * 0.2, z * 0.2, s + 3) - 0.5) * 0.15) * w;
  }
  h = Math.max(h, map.minLand);
  // river channel
  const dr = distToPolyline(x, z, map.river.points);
  if (dr < map.river.bankWidth) {
    let bed = map.river.bedHeight;
    for (const ford of map.river.fords) {
      const df = Math.hypot(x - ford.x, z - ford.z);
      const w = 1 - smoothstep(ford.r * 0.5, ford.r, df);
      bed = bed * (1 - w) + ford.bed * w;
    }
    const t = smoothstep(map.river.halfWidth * 0.55, map.river.bankWidth, dr);
    h = bed * (1 - t) + h * t;
  }
  return h;
}

/**
 * Build a sampled heightfield (1 m resolution) with fast bilinear lookups.
 */
export function createTerrainData(map) {
  const size = map.half * 2;
  const res = size; // samples per side - 1
  const n = res + 1;
  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = -map.half + (j / res) * size;
    for (let i = 0; i < n; i++) {
      const x = -map.half + (i / res) * size;
      heights[j * n + i] = rawHeight(map, x, z);
    }
  }
  const step = size / res;

  function height(x, z) {
    const fx = Math.min(res - 1e-6, Math.max(0, (x + map.half) / step));
    const fz = Math.min(res - 1e-6, Math.max(0, (z + map.half) / step));
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const a = heights[j * n + i], b = heights[j * n + i + 1];
    const c = heights[(j + 1) * n + i], d = heights[(j + 1) * n + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  /** gradient magnitude (rise/run) */
  function slope(x, z) {
    const e = 1;
    const dx = (height(x + e, z) - height(x - e, z)) / (2 * e);
    const dz = (height(x, z + e) - height(x, z - e)) / (2 * e);
    return Math.hypot(dx, dz);
  }

  function isWater(x, z) { return height(x, z) < WATER_LEVEL - 0.05; }
  function waterDepth(x, z) { return Math.max(0, WATER_LEVEL - height(x, z)); }
  function inBounds(x, z, margin = 0) { return Math.abs(x) <= map.half - margin && Math.abs(z) <= map.half - margin; }

  return { map, half: map.half, size, res, n, step, heights, height, slope, isWater, waterDepth, inBounds, waterLevel: WATER_LEVEL };
}
