// Seeded, serializable PRNG (sfc32). The only randomness source allowed in
// simulation and content generation (see ARCHITECTURE.md §6).

/** Hash an arbitrary string or number into a 32-bit unsigned seed (cyrb53-lite). */
export function hashSeed(input) {
  const str = String(input);
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}

/**
 * @typedef {Object} Rng
 * @property {() => number} next      float in [0, 1)
 * @property {(min:number, max:number) => number} range   float in [min, max)
 * @property {(min:number, max:number) => number} int     integer in [min, max] inclusive
 * @property {<T>(arr:T[]) => T} pick
 * @property {(p:number) => boolean} chance
 * @property {() => number[]} getState
 * @property {(s:number[]) => void} setState
 */

/** @returns {Rng} */
export function createRng(seed) {
  let s = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  let a = 0x9e3779b9, b = 0x243f6a88, c = 0xb7e15162, d = s;
  const raw = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 15; i++) raw();
  return {
    next: raw,
    range: (min, max) => min + raw() * (max - min),
    int: (min, max) => min + Math.floor(raw() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(raw() * arr.length)],
    chance: (p) => raw() < p,
    getState: () => [a >>> 0, b >>> 0, c >>> 0, d >>> 0],
    setState: (st) => { [a, b, c, d] = st.map((v) => v >>> 0); },
  };
}

/** Stateless hash noise helpers (deterministic, allocation-free). */
export function hash2(x, y, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) { return t * t * (3 - 2 * t); }

/** Value noise in [0,1). */
export function valueNoise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal value noise in roughly [0,1). */
export function fbm2(x, y, seed = 0, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * freq, y * freq, seed + i * 1013);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
