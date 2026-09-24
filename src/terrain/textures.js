// Procedural, tileable ground textures (project-authored, generated at runtime).
import * as THREE from 'three';
import { hash2 } from '../core/rng.js';

function periodicNoise(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (a) => ((a % period) + period) % period;
  const a = hash2(m(xi), m(yi), seed), b = hash2(m(xi + 1), m(yi), seed);
  const c = hash2(m(xi), m(yi + 1), seed), d = hash2(m(xi + 1), m(yi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Tileable fbm: coordinates in [0,1). */
function tfbm(u, v, baseFreq, octaves, seed) {
  let sum = 0, amp = 0.5, norm = 0, f = baseFreq;
  for (let o = 0; o < octaves; o++) {
    sum += amp * periodicNoise(u * f, v * f, f, seed + o * 17);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

/** Tileable cellular noise distance to nearest feature point (0..~1). */
function cellular(u, v, cells, seed) {
  const x = u * cells, y = v * cells;
  const xi = Math.floor(x), yi = Math.floor(y);
  let best = 9, second = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j;
    const mx = ((cx % cells) + cells) % cells, my = ((cy % cells) + cells) % cells;
    const px = cx + hash2(mx, my, seed), py = cy + hash2(mx, my, seed + 1);
    const d = Math.hypot(px - x, py - y);
    if (d < best) { second = best; best = d; } else if (d < second) second = d;
  }
  return [best, second];
}

function hex(c) { const col = new THREE.Color(c); return [col.r, col.g, col.b]; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

const GENERATORS = {
  grass(u, v) {
    const n = tfbm(u, v, 4, 5, 11);
    const fine = tfbm(u, v, 64, 2, 12);
    const blade = tfbm(u * 1.0, v * 1.0, 128, 1, 13);
    let c = mix(hex('#546a36'), hex('#7c8e50'), n);
    c = mix(c, hex('#8e9a60'), Math.max(0, fine - 0.55) * 1.4);
    const k = 0.82 + blade * 0.3;
    c = [c[0] * k, c[1] * k, c[2] * k];
    // dry patches
    const dry = Math.max(0, tfbm(u, v, 3, 3, 14) - 0.62) * 2.2;
    c = mix(c, hex('#9a9055'), Math.min(1, dry));
    // sparse flowers
    const f = hash2(Math.floor(u * 256), Math.floor(v * 256), 15);
    if (f > 0.9965) c = f > 0.9985 ? hex('#e8e0c8') : hex('#d8b64a');
    return [c, 0.3 + fine * 0.4];
  },
  dirt(u, v) {
    const n = tfbm(u, v, 5, 5, 21);
    let c = mix(hex('#6a5038'), hex('#9a7b58'), n);
    const [d1] = cellular(u, v, 24, 22);
    const pebble = d1 < 0.22 ? 1 - d1 / 0.22 : 0;
    const shade = hash2(Math.floor(u * 24), Math.floor(v * 24), 23);
    c = mix(c, shade > 0.5 ? hex('#b39b7c') : hex('#5a4634'), pebble * 0.7);
    const fine = tfbm(u, v, 96, 2, 24);
    const k = 0.88 + fine * 0.24;
    return [[c[0] * k, c[1] * k, c[2] * k], 0.35 + pebble * 0.5 + n * 0.2];
  },
  rock(u, v) {
    const n = tfbm(u, v, 4, 6, 31);
    let c = mix(hex('#5f615f'), hex('#9a9b96'), n);
    const [d1, d2] = cellular(u, v, 8, 32);
    const crack = Math.max(0, 1 - (d2 - d1) * 14);
    c = mix(c, hex('#3a3b3a'), crack * 0.75);
    const lichen = Math.max(0, tfbm(u, v, 6, 4, 33) - 0.6) * 3;
    c = mix(c, hex('#7f8a52'), Math.min(0.6, lichen));
    return [c, 0.5 + n * 0.5 - crack * 0.4];
  },
  mud(u, v) {
    const n = tfbm(u, v, 6, 5, 41);
    let c = mix(hex('#5d5642'), hex('#8e8466'), n);
    const ripple = 0.5 + 0.5 * Math.sin((v * 40 + tfbm(u, v, 4, 2, 42) * 6) * Math.PI);
    c = mix(c, hex('#a39a78'), ripple * 0.12);
    const [d1] = cellular(u, v, 30, 43);
    if (d1 < 0.15) c = mix(c, hex('#b8ae90'), 0.5 * (1 - d1 / 0.15));
    return [c, 0.4 + n * 0.3];
  },
};

/**
 * @returns {{ map: THREE.DataTexture, height: Float32Array }}
 */
export function generateGroundTexture(kind, size = 512) {
  const gen = GENERATORS[kind];
  const data = new Uint8Array(size * size * 4);
  const tmp = new THREE.Color();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [c, h] = gen(x / size, y / size);
      const i = (y * size + x) * 4;
      // linear -> sRGB encode for storage (texture flagged sRGB)
      const col = tmp.setRGB(c[0], c[1], c[2]).convertLinearToSRGB();
      data[i] = Math.round(Math.min(1, col.r) * 255);
      data[i + 1] = Math.round(Math.min(1, col.g) * 255);
      data[i + 2] = Math.round(Math.min(1, col.b) * 255);
      data[i + 3] = Math.round(Math.min(1, Math.max(0, h)) * 255); // height in alpha for height-blending
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Low-frequency tileable noise (RGB = three independent fields) for macro variation. */
export function generateMacroTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const i = (y * size + x) * 4;
    data[i] = Math.round(tfbm(u, v, 3, 4, 51) * 255);
    data[i + 1] = Math.round(tfbm(u, v, 5, 4, 52) * 255);
    data[i + 2] = Math.round(tfbm(u, v, 2, 3, 53) * 255);
    data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
