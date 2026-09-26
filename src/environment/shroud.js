// Exploration shroud presentation: uploads the explored-land bitset from the world into a
// small, softly blurred texture that the terrain, water and structure shaders darken by.
// View-only: reads the world, never changes it.
import * as THREE from 'three';
import { SHROUD } from '../render/structure-material.js';
import { EXPLORE_GRID } from '../exploration/index.js';

export function createShroud({ world, terrain, enabled = () => true }) {
  const N = EXPLORE_GRID;
  const data = new Uint8Array(N * N);
  const raw = new Float32Array(N * N);
  const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  SHROUD.tex.value = tex;
  SHROUD.half.value = terrain.half;
  let timer = Infinity;
  let lastKey = '';

  function upload() {
    const bits = world().explored;
    const on = !!bits && enabled();
    SHROUD.on.value = on ? 1 : 0;
    if (!on) return;
    const key = bits.join(',');
    if (key === lastKey) return;
    lastKey = key;
    for (let k = 0; k < N * N; k++) raw[k] = (bits[k >>> 5] & (1 << (k & 31))) ? 1 : 0;
    // one 3x3 blur pass for a soft edge between explored and hidden land
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const x = i + di, y = j + dj;
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        s += raw[y * N + x]; n++;
      }
      data[j * N + i] = Math.round((s / n) * 255);
    }
    tex.needsUpdate = true;
  }

  return {
    id: 'environment-shroud',
    kind: 'view',
    render(alpha, frame) { timer += frame.dt || 0; if (timer >= 0.4) { timer = 0; upload(); } },
    snap() { timer = 0; lastKey = ''; upload(); },
    dispose() { SHROUD.on.value = 0; SHROUD.tex.value = null; tex.dispose(); },
  };
}
