// Terrain rendering: heightfield mesh, height-blended splat material (grass, dirt/road,
// rock, riverbank mud), dynamic worn paths from walkers, and ground detail.
import * as THREE from 'three';
import { generateGroundTexture } from './textures.js';
import { distToPolyline } from '../world/terrain-data.js';
import { all } from '../world/world.js';

function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

const WEAR_RES = 128;

export function computeSplat(terrain) {
  const map = terrain.map;
  const n = terrain.n;
  const splat = new Float32Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    const z = -terrain.half + j * terrain.step;
    for (let i = 0; i < n; i++) {
      const x = -terrain.half + i * terrain.step;
      const h = terrain.heights[j * n + i];
      const slope = terrain.slope(x, z);
      const nearWater = h < 2.2;
      let rock = (nearWater ? smoothstep(0.9, 1.4, slope) : smoothstep(0.5, 0.95, slope)) + smoothstep(14, 22, h) * 0.8;
      let mud = 1 - smoothstep(0.35, 1.3, h);
      let dirt = 0;
      for (const rd of map.roads) {
        const d = distToPolyline(x, z, rd.points);
        dirt = Math.max(dirt, 1 - smoothstep(rd.width * 0.45, rd.width + 1.4, d));
      }
      // trodden yards around the keep and the enemy fort
      const dk = Math.hypot(x - map.playerStart.x, z - map.playerStart.z);
      dirt = Math.max(dirt, (1 - smoothstep(7, 14, dk)) * 0.9);
      const de = Math.hypot(x - map.enemyCamp.x, z - map.enemyCamp.z);
      dirt = Math.max(dirt, (1 - smoothstep(10, 24, de)) * 0.95);
      rock = Math.min(1, rock);
      mud = Math.min(1, mud) * (1 - rock);
      dirt *= (1 - rock) * (1 - mud * 0.8);
      let grass = Math.max(0, 1 - rock - mud - dirt);
      const sum = rock + mud + dirt + grass || 1;
      const k = (j * n + i) * 4;
      splat[k] = grass / sum; splat[k + 1] = dirt / sum; splat[k + 2] = rock / sum; splat[k + 3] = mud / sum;
    }
  }
  return splat;
}

export function createTerrainView({ scene, terrain, quality, world }) {
  const texSize = quality && quality.pixelRatio < 1 ? 256 : 512;
  const tex = {
    grass: generateGroundTexture('grass', texSize),
    dirt: generateGroundTexture('dirt', texSize),
    rock: generateGroundTexture('rock', texSize),
    mud: generateGroundTexture('mud', texSize),
  };
  const wearData = new Uint8Array(WEAR_RES * WEAR_RES);
  const wearTex = new THREE.DataTexture(wearData, WEAR_RES, WEAR_RES, THREE.RedFormat);
  wearTex.magFilter = THREE.LinearFilter; wearTex.minFilter = THREE.LinearFilter;
  wearTex.needsUpdate = true;
  const wearAcc = new Float32Array(WEAR_RES * WEAR_RES);

  const geo = new THREE.PlaneGeometry(terrain.size, terrain.size, terrain.res, terrain.res);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  // PlaneGeometry after rotateX: vertex order rows from -z (top) to +z; our heights index j from -half
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrain.height(x, z));
  }
  geo.computeVertexNormals();
  const splatArr = computeSplat(terrain);
  // remap splat to plane vertex order
  const splatAttr = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const ii = Math.round((x + terrain.half) / terrain.step), jj = Math.round((z + terrain.half) / terrain.step);
    const k = (jj * terrain.n + ii) * 4;
    splatAttr.set(splatArr.subarray(k, k + 4), i * 4);
  }
  geo.setAttribute('splat', new THREE.BufferAttribute(splatAttr, 4));

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  const uniforms = {
    tGrass: { value: tex.grass }, tDirt: { value: tex.dirt }, tRock: { value: tex.rock }, tMud: { value: tex.mud },
    tWear: { value: wearTex }, uHalf: { value: terrain.half }, uSize: { value: terrain.size },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 splat;\nvarying vec4 vSplat;\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSplat = splat;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tGrass; uniform sampler2D tDirt; uniform sampler2D tRock; uniform sampler2D tMud; uniform sampler2D tWear;
uniform float uHalf; uniform float uSize;
varying vec4 vSplat; varying vec3 vWPos;
vec4 sampleAT(sampler2D t, vec2 p) {
  // two scales to hide tiling
  return mix(texture2D(t, p * 0.19), texture2D(t, p * 0.043 + vec2(0.31, 0.77)), 0.38);
}
float kRough = 0.92;`)
      .replace('#include <map_fragment>', `
vec2 wp = vWPos.xz;
vec4 cG = sampleAT(tGrass, wp);
vec4 cD = sampleAT(tDirt, wp);
vec4 cR = sampleAT(tRock, wp * 0.8);
vec4 cM = sampleAT(tMud, wp);
float wear = texture2D(tWear, (wp + uHalf) / uSize).r;
vec4 w = vSplat;
w.y = max(w.y, wear * 0.9 * (1.0 - w.z));
w.x *= (1.0 - wear * 0.9);
// height-based blending for crisp natural transitions
vec4 hb = w * (vec4(cG.a, cD.a, cR.a, cM.a) + 0.45);
float mx = max(max(hb.x, hb.y), max(hb.z, hb.w));
vec4 ww = max(hb - (mx - 0.28), 0.0);
ww /= (ww.x + ww.y + ww.z + ww.w + 1e-4);
vec3 ground = cG.rgb * ww.x + cD.rgb * ww.y + cR.rgb * ww.z + cM.rgb * ww.w;
// macro variation
float macro = texture2D(tGrass, wp * 0.0061).g;
ground *= 0.86 + macro * 0.32;
// wet bank darkening near the water line
ground *= mix(0.72, 1.0, smoothstep(-0.2, 0.6, vWPos.y));
diffuseColor.rgb *= ground;
kRough = dot(ww, vec4(0.96, 0.9, 0.78, 0.62));
`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = kRough;');
  };
  mat.customProgramCacheKey = () => 'kh-terrain-v1';

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);

  // under-map skirt so edges never show the void
  const skirtGeo = new THREE.PlaneGeometry(terrain.size * 6, terrain.size * 6);
  skirtGeo.rotateX(-Math.PI / 2);
  const skirt = new THREE.Mesh(skirtGeo, new THREE.MeshStandardMaterial({ color: '#4d5a3a', roughness: 1 }));
  skirt.position.y = 12;
  skirt.renderOrder = -1;
  // skirt only visible beyond the map (mountains hide the seam)
  const skirtHole = terrain.size * 0.5;
  skirt.material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vXZ;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvXZ = (modelMatrix * vec4(transformed,1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec2 vXZ;`).replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (max(abs(vXZ.x), abs(vXZ.y)) < ${skirtHole.toFixed(1)} - 2.0) discard;`);
  };
  scene.add(skirt);

  let wearTimer = 0;
  function updateWear(dt) {
    wearTimer += dt;
    if (wearTimer < 1) return;
    wearTimer = 0;
    const s = WEAR_RES / terrain.size;
    for (let i = 0; i < wearAcc.length; i++) wearAcc[i] *= 0.9995;
    const add = (e, amt) => {
      const i = Math.floor((e.x + terrain.half) * s), j = Math.floor((e.z + terrain.half) * s);
      if (i < 0 || j < 0 || i >= WEAR_RES || j >= WEAR_RES) return;
      wearAcc[j * WEAR_RES + i] += amt;
    };
    for (const e of all(world(), 'settler')) if (e.moving) add(e, 0.012);
    for (const e of all(world(), 'unit')) if (e.moving) add(e, 0.006);
    for (let i = 0; i < wearAcc.length; i++) wearData[i] = Math.min(255, Math.round(Math.min(1, wearAcc[i]) * 255));
    wearTex.needsUpdate = true;
  }

  return {
    id: 'terrain-view',
    kind: 'view',
    mesh,
    render(alpha, frame) { updateWear(frame.dt); },
    /** Pre-wear paths (used for deterministic screenshot presets that fast-forward). */
    seedWear(amount = 0.4) {
      const s = WEAR_RES / terrain.size;
      for (const e of [...all(world(), 'settler'), ...all(world(), 'building')]) {
        const i = Math.floor((e.x + terrain.half) * s), j = Math.floor((e.z + terrain.half) * s);
        if (i >= 0 && j >= 0 && i < WEAR_RES && j < WEAR_RES) wearAcc[j * WEAR_RES + i] += amount * (e.kind === 'building' ? 0.5 : 1);
      }
      wearTimer = 1;
    },
    getHealthStatus() { return { status: 'ok' }; },
    dispose() {
      scene.remove(mesh, skirt);
      geo.dispose(); mat.dispose(); skirtGeo.dispose(); skirt.material.dispose();
      for (const k in tex) tex[k].dispose();
      wearTex.dispose();
    },
  };
}
