// Terrain rendering: heightfield mesh, height-blended splat material (grass, dirt/road,
// rock, riverbank mud), dynamic worn paths from walkers, and ground detail.
import * as THREE from 'three';
import { generateGroundTexture, generateMacroTexture } from './textures.js';
import { distToPolyline, rawHeight, sceneryRelief } from '../world/terrain-data.js';
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
      const nearWater = h < 2.2 || distToPolyline(x, z, map.river.points) < map.river.bankWidth + 5;
      let rock = (nearWater ? 0 : smoothstep(0.55, 1.0, slope)) + smoothstep(14, 22, h) * 0.8;
      let mud = (1 - smoothstep(0.35, 1.3, h)) + (nearWater ? smoothstep(0.35, 0.9, slope) * 0.8 : 0);
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
    macro: generateMacroTexture(256),
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
    pos.setY(i, terrain.height(x, z) + sceneryRelief(terrain.map, x, z));
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
    tWear: { value: wearTex }, tMacro: { value: tex.macro }, uHalf: { value: terrain.half }, uSize: { value: terrain.size }, uSnow: { value: 0 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 splat;\nvarying vec4 vSplat;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSplat = splat;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tGrass; uniform sampler2D tDirt; uniform sampler2D tRock; uniform sampler2D tMud; uniform sampler2D tWear; uniform sampler2D tMacro;
uniform float uHalf; uniform float uSize; uniform float uSnow;
varying vec4 vSplat; varying vec3 vWPos; varying vec3 vWNrm;
vec4 sampleAT(sampler2D t, vec2 p) {
  // two scales to hide tiling
  return mix(texture2D(t, p * 0.19), texture2D(t, p * 0.043 + vec2(0.31, 0.77)), 0.38);
}
float kRough = 0.92;
float kHgt = 0.0;`)
      .replace('#include <map_fragment>', `
vec2 wp = vWPos.xz;
vec4 cG = sampleAT(tGrass, wp);
vec4 cD = sampleAT(tDirt, wp);
// rock: triplanar on steep faces so cliffs are not smeared by the top-down projection
vec3 tn = abs(normalize(vWNrm));
tn = pow(tn, vec3(4.0)); tn /= (tn.x + tn.y + tn.z);
vec4 cR = sampleAT(tRock, wp * 0.8) * tn.y + sampleAT(tRock, vWPos.zy * 0.8) * tn.x + sampleAT(tRock, vWPos.xy * 0.8) * tn.z;
// sedimentary strata and weathering on high cliffs
float strata = sin(vWPos.y * 1.7 + texture2D(tMacro, wp * 0.012).r * 9.0);
cR.rgb *= (0.95 + 0.05 * strata) * 0.82 * mix(vec3(1.0), vec3(1.05, 0.98, 0.9), smoothstep(0.2, 0.9, texture2D(tMacro, vWPos.xy * 0.006 + vWPos.zy * 0.004).g));
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
// gentle desaturation towards the art-direction sage palette
float gl = dot(ground, vec3(0.299, 0.587, 0.114));
ground = mix(vec3(gl), ground, 0.66) * vec3(0.98, 1.0, 0.92);
// macro variation: large meadow patches (dry/lush), medium mottling, per-material tint
vec4 mac = texture2D(tMacro, wp * 0.0042);
vec4 mac2 = texture2D(tMacro, wp * 0.021 + vec2(0.4, 0.1));
kHgt = dot(ww, vec4(cG.a * 0.3, cD.a * 0.6, cR.a * 1.8, cM.a * 0.4)) + mac2.r * 2.0; // relief from rock and low-frequency swells, not per-pixel grass grain
vec3 lush = vec3(0.66, 0.86, 0.62), dry = vec3(1.2, 1.08, 0.72);
vec3 grassTint = mix(lush, dry, smoothstep(0.3, 0.75, mac.r)) * (0.8 + mac2.g * 0.38);
// clover-dark mottling at medium scale
grassTint *= mix(0.86, 1.04, smoothstep(0.35, 0.6, mac2.r));
ground *= mix(vec3(1.0), grassTint, ww.x);
ground *= 0.9 + mac.b * 0.2;
// wet bank darkening near the water line
ground *= mix(0.72, 1.0, smoothstep(-0.2, 0.6, vWPos.y));
// mountain cover: dark forest carpet on the less steep flanks, bare rock on steep faces
// and towards the peaks (visual only, the border is outside the playable area)
float up = normalize(vWNrm).y;
float high = smoothstep(7.0, 15.0, vWPos.y);
float cover = high * smoothstep(0.3, 0.55, up) * (1.0 - smoothstep(30.0, 50.0, vWPos.y + mac.r * 14.0));
vec3 forestFloor = vec3(0.15, 0.22, 0.11) * (0.75 + mac2.g * 0.5) * mix(1.0, 1.25, cG.a);
ground = mix(ground, forestFloor, cover * 0.9);
// weathered, lichen-dark mountain rock rather than pale quarry stone
ground *= mix(vec3(1.0), vec3(0.68, 0.7, 0.62) * (0.85 + mac2.b * 0.3), high * ww.z * (1.0 - cover));
ground = mix(ground, cG.rgb * vec3(0.5, 0.62, 0.4), high * (1.0 - cover) * smoothstep(0.66, 0.8, up) * 0.6);
kRough = dot(ww, vec4(0.96, 0.9, 0.78, 0.62));
if (uSnow > 0.001) {
  // winter: snow blankets flat ground, thins on slopes, trodden paths and the wet banks,
  // and drifts unevenly so the relief still reads
  float drift = texture2D(tMacro, wp * 0.035).g * 0.6 + mac2.r * 0.4;
  float snowK = smoothstep(0.62, 0.86, up + (drift - 0.5) * 0.35) * (1.0 - wear * 0.75) * (1.0 - ww.w * 0.55) * smoothstep(-0.1, 0.5, vWPos.y);
  snowK = clamp(snowK * (0.7 + drift * 0.45), 0.0, 0.94) * uSnow;
  vec3 snowCol = vec3(0.8, 0.84, 0.9) * (0.88 + drift * 0.16);
  ground = mix(ground, snowCol, snowK);
  kHgt = mix(kHgt, drift * 1.5, snowK);
  kRough = mix(kRough, 0.82, snowK);
}
diffuseColor.rgb *= ground;
`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = kRough;')
      .replace('#include <fog_fragment>', `#include <fog_fragment>
#ifdef USE_FOG
// aerial perspective: distant high ground sinks into the haze, so the valley walls read as far mountains
gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(6.0, 70.0, vWPos.y) * smoothstep(90.0, 300.0, vFogDepth) * 0.5);
#endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ // procedural bump from the blended texture heights: pebbles, cracks and tufts catch the light
  vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
  float dhx = dFdx(kHgt), dhy = dFdy(kHgt);
  vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  normal = normalize(abs(det) * normal - grad * 0.12);
}`);
  };
  mat.customProgramCacheKey = () => 'kh-terrain-v4';

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);

  // scenery ring: the valley's hills continue beyond the playable map, so no camera angle
  // ever shows the edge of the world. Inside the map it sits hidden below the real terrain.
  const OUTER = terrain.half + 150;
  // beyond the map edge the range climbs gently instead of continuing the steep border ramp,
  // so the far mountains lean back into the haze rather than standing as a wall
  const outerHeight = (x, z) => {
    const e = Math.max(Math.abs(x), Math.abs(z));
    if (e <= terrain.half) return rawHeight(terrain.map, x, z);
    const k = terrain.half / e;
    return rawHeight(terrain.map, x * k, z * k) + (e - terrain.half) * 0.55;
  };
  const skirtGeo = new THREE.PlaneGeometry(OUTER * 2, OUTER * 2, 150, 150);
  skirtGeo.rotateX(-Math.PI / 2);
  const sp = skirtGeo.attributes.position;
  const sSplat = new Float32Array(sp.count * 4);
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), z = sp.getZ(i);
    const inside = Math.max(Math.abs(x), Math.abs(z)) < terrain.half - 3;
    const h = (inside ? terrain.height(x, z) - 2 : outerHeight(x, z)) + sceneryRelief(terrain.map, x, z);
    sp.setY(i, h);
    const hh = (a, b) => outerHeight(a, b) + sceneryRelief(terrain.map, a, b);
    const sl = Math.min(1, Math.abs(hh(x + 2, z) - hh(x - 2, z)) / 4 + Math.abs(hh(x, z + 2) - hh(x, z - 2)) / 4);
    const rock = smoothstep(0.6, 1.1, sl * 1.4) * 0.8;
    sSplat.set([1 - rock, 0, rock, 0], i * 4);
  }
  skirtGeo.computeVertexNormals();
  skirtGeo.setAttribute('splat', new THREE.BufferAttribute(sSplat, 4));
  const skirt = new THREE.Mesh(skirtGeo, mat);
  skirt.receiveShadow = true;
  skirt.name = 'terrain-scenery';
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
    setSnow(v) { uniforms.uSnow.value = v; },
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
      geo.dispose(); mat.dispose(); skirtGeo.dispose();
      for (const k in tex) tex[k].dispose();
      wearTex.dispose();
    },
  };
}
