// Shared PBR material for procedural props, buildings and characters.
// Vertex colours give the base albedo; a per-vertex `pattern` id selects a procedural
// world-space surface pattern (masonry, planks, thatch, shingles, plaster, cloth,
// foliage, metal) so geometry reads as crafted material without texture files.
import * as THREE from 'three';

/** Shared season uniform: 0 = summer, 1 = full winter snow cover (set by the environment view). */
export const SNOW = { value: 0 };

/** Shared exploration shroud (set by the environment view): texture of explored land. */
export const SHROUD = { tex: { value: null }, half: { value: 128 }, on: { value: 0 }, linear: { value: 0 } };

/** GLSL: brightness factor 0.1..1 from the shroud at a world position. Outside the map the
 * scenery keeps a dim, misty look instead of turning black. */
export const SHROUD_GLSL = `
uniform sampler2D tShroud; uniform float uShroudHalf; uniform float uShroudOn; uniform float uShroudLinear;
float khShroudK(vec3 wp) {
  if (uShroudOn < 0.5) return 1.0;
  vec2 uv = (wp.xz + uShroudHalf) / (2.0 * uShroudHalf);
  float e = texture2D(tShroud, clamp(uv, 0.004, 0.996)).r;
  float outside = max(max(-uv.x, uv.x - 1.0), max(-uv.y, uv.y - 1.0)) * 2.0 * uShroudHalf;
  e = max(e, smoothstep(0.0, 24.0, outside) * 0.45);
  return mix(0.07, 1.0, smoothstep(0.08, 0.92, e));
}
vec3 khShroud(vec3 col, vec3 wp) {
  float k = khShroudK(wp);
  // with post-processing the colour is still linear here: darken on the same perceptual scale
  if (uShroudLinear > 0.5) return mix(vec3(0.0012, 0.0015, 0.0022), col, pow(k, 2.2)); // the haze on top lifts it as before
  return mix(vec3(0.018, 0.022, 0.03), col, k);
}
`;

/** Shared image-based light flag (1 when the sky environment is baked; metals may then shine). */
export const ENV = { on: { value: 0 } };

/** Drifting cloud shadows: a small tileable noise texture scrolled over the land by the wind.
 * Only direct sunlight is dimmed, the sky light stays. Strength 0 at night. */
function makeCloudTexture(n = 128) {
  const data = new Uint8Array(n * n);
  let s = 90210;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const g = 16; // lattice cells per side (tileable)
  const lat = new Float32Array(g * g).map(() => rnd());
  const L = (x, y) => lat[((y % g + g) % g) * g + ((x % g + g) % g)];
  const sm = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
    return (L(xi, yi) * (1 - fx) + L(xi + 1, yi) * fx) * (1 - fy) + (L(xi, yi + 1) * (1 - fx) + L(xi + 1, yi + 1) * fx) * fy; };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i / n) * g, y = (j / n) * g;
    // two octaves on the same lattice period stay tileable
    const v = noise(x, y) * 0.65 + noise(x * 2, y * 2) * 0.35;
    data[j * n + i] = Math.round(v * 255);
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RedFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
export const CLOUDS = { tex: { value: null }, time: { value: 0 }, strength: { value: 0 } };
export function cloudTexture() { if (!CLOUDS.tex.value) CLOUDS.tex.value = makeCloudTexture(); return CLOUDS.tex.value; }
export const CLOUD_GLSL = `
uniform sampler2D tCloud; uniform float uCloudT; uniform float uCloudK;
float khCloud(vec3 wp) {
  if (uCloudK < 0.001) return 1.0;
  vec2 uv = wp.xz * 0.0042 + vec2(uCloudT * 0.0036, uCloudT * 0.0014);
  float n = texture2D(tCloud, uv).r * 0.7 + texture2D(tCloud, uv * 2.7 + vec2(0.37, 0.11)).r * 0.3;
  return 1.0 - uCloudK * smoothstep(0.56, 0.7, n);
}
`;
export function bindClouds(shader) {
  shader.uniforms.tCloud = { value: cloudTexture() };
  shader.uniforms.uCloudT = CLOUDS.time;
  shader.uniforms.uCloudK = CLOUDS.strength;
}

export function bindShroud(shader) {
  shader.uniforms.tShroud = SHROUD.tex;
  shader.uniforms.uShroudHalf = SHROUD.half;
  shader.uniforms.uShroudOn = SHROUD.on;
  shader.uniforms.uShroudLinear = SHROUD.linear;
}

export const PATTERN = { plain: 0, stone: 1, planks: 2, thatch: 3, shingles: 4, plaster: 5, cloth: 6, foliage: 7, metal: 8, rock: 9 };

const GLSL_COMMON = `
uniform float uSnow; uniform float uEnvOn;
varying float vPattern; varying vec3 vWPos; varying vec3 vWNormal;
float khHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float khNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(khHash(i), khHash(i + vec2(1, 0)), u.x), mix(khHash(i + vec2(0, 1)), khHash(i + vec2(1, 1)), u.x), u.y);
}
vec2 khPlane(vec3 p, vec3 n) {
  vec3 a = abs(n);
  if (a.y > 0.72) return p.xz;
  return a.x > a.z ? vec2(p.z, p.y) : vec2(p.x, p.y);
}
float khRough = 0.85; float khMetal = 0.0;
vec3 khPattern(float pat, vec3 wp, vec3 n) {
  vec2 p = khPlane(wp, n);
  float grain = khNoise(p * 9.0) * 0.5 + khNoise(p * 23.0) * 0.5;
  if (pat < 0.5) { khRough = 0.82; return vec3(0.94 + grain * 0.1); }
  if (pat < 1.5) { // masonry
    float rowH = 0.42; float row = floor(p.y / rowH);
    float off = mod(row, 2.0) * 0.38;
    vec2 cell = vec2(floor((p.x + off) / 0.76), row);
    vec2 f = vec2(fract((p.x + off) / 0.76), fract(p.y / rowH));
    float edge = min(min(f.x, 1.0 - f.x) * 0.76, min(f.y, 1.0 - f.y) * rowH);
    float mortar = smoothstep(0.018, 0.045, edge);
    float tint = 0.84 + khHash(cell) * 0.28;
    khRough = 0.9;
    return vec3(mix(0.55, tint * (0.92 + grain * 0.14), mortar));
  }
  if (pat < 2.5) { // planks (horizontal boards on walls, along x on floors)
    float h = 0.26; float row = floor(p.y / h);
    float f = fract(p.y / h);
    float gap = smoothstep(0.0, 0.07, f) * smoothstep(1.0, 0.93, f);
    float tint = 0.82 + khHash(vec2(row, floor(p.x / 2.3 + row * 0.37))) * 0.3;
    float wood = 0.9 + khNoise(vec2(p.x * 1.5, p.y * 30.0)) * 0.2;
    khRough = 0.8;
    return vec3(mix(0.5, tint * wood, gap));
  }
  if (pat < 3.5) { // thatch: vertical straw streaks with bundle rows
    float streak = khNoise(vec2(p.x * 14.0, p.y * 1.4)) * 0.6 + khNoise(vec2(p.x * 40.0, p.y * 3.0)) * 0.4;
    float band = 0.9 + 0.1 * smoothstep(0.0, 0.25, fract(p.y / 0.33));
    khRough = 0.97;
    return vec3((0.72 + streak * 0.42) * band);
  }
  if (pat < 4.5) { // shingles / slate
    float h = 0.3; float row = floor(p.y / h);
    float off = mod(row, 2.0) * 0.18;
    vec2 cell = vec2(floor((p.x + off) / 0.36), row);
    float fy = fract(p.y / h);
    float fx = fract((p.x + off) / 0.36);
    float shade = mix(0.62, 1.0, smoothstep(0.0, 0.35, fy));
    float sep = smoothstep(0.0, 0.06, fx) * smoothstep(1.0, 0.94, fx);
    float tint = 0.85 + khHash(cell) * 0.25;
    khRough = 0.7;
    return vec3(tint * shade * mix(0.7, 1.0, sep));
  }
  if (pat < 5.5) { // limewash plaster
    float blot = khNoise(p * 1.7) * 0.6 + khNoise(p * 5.0) * 0.4;
    khRough = 0.93;
    return vec3(0.9 + blot * 0.14);
  }
  if (pat < 6.5) { // cloth
    float weave = 0.92 + 0.08 * sin(p.x * 90.0) * sin(p.y * 90.0);
    khRough = 0.95;
    return vec3(weave * (0.93 + grain * 0.1));
  }
  if (pat < 7.5) { // foliage mottling
    float m = khNoise(wp.xz * 2.5 + wp.y * 1.7) * 0.6 + khNoise(wp.xy * 7.0) * 0.4;
    khRough = 0.9;
    return vec3(0.72 + m * 0.5);
  }
  if (pat < 8.5) { khRough = 0.42; khMetal = mix(0.3, 0.65, uEnvOn); return vec3(1.0 + grain * 0.15); } // metals shine only with the sky light (else they turn black)
  // rock
  float r = khNoise(p * 1.3) * 0.5 + khNoise(p * 4.0) * 0.3 + khNoise(p * 12.0) * 0.2;
  khRough = 0.88;
  return vec3(0.78 + r * 0.38);
}
`;

export function patchStructureShader(shader) {
  shader.uniforms.uSnow = SNOW;
  shader.uniforms.uEnvOn = ENV.on;
  bindShroud(shader);
  bindClouds(shader);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float pattern;\nvarying float vPattern; varying vec3 vWPos; varying vec3 vWNormal;')
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
vPattern = pattern;
vec4 khW = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
khW = instanceMatrix * khW;
#endif
khW = modelMatrix * khW;
vWPos = khW.xyz;
vec3 khN = objectNormal;
#ifdef USE_INSTANCING
khN = mat3(instanceMatrix) * khN;
#endif
vWNormal = normalize(mat3(modelMatrix) * khN);`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + GLSL_COMMON + SHROUD_GLSL + CLOUD_GLSL)
    .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n{ float khCl = khCloud(vWPos); reflectedLight.directDiffuse *= khCl; reflectedLight.directSpecular *= khCl; }')
    .replace('#include <fog_fragment>', 'gl_FragColor.rgb = khShroud(gl_FragColor.rgb, vWPos);\n#include <fog_fragment>')
    .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= khPattern(vPattern, vWPos, normalize(vWNormal));
if (uSnow > 0.001 && vPattern > 0.5 && vPattern < 9.5 && (vPattern < 5.5 || vPattern > 6.5) && (vPattern < 7.5 || vPattern > 8.5)) {
  // winter: snow settles on up-facing roofs, ledges, foliage and rocks (not on cloth or metal)
  float khUp = normalize(vWNormal).y;
  float khSn = khNoise(vWPos.xz * 1.7) * 0.6 + khNoise(vWPos.xz * 6.0) * 0.4;
  float khSnowK = uSnow * smoothstep(0.34, 0.72, khUp + (khSn - 0.5) * 0.4) * (vPattern > 6.5 ? 0.72 : 0.92);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.83, 0.86, 0.92) * (0.92 + khSn * 0.1), khSnowK);
  khRough = mix(khRough, 0.75, khSnowK);
}`)
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * khRough / 0.85;')
    .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = max(metalness, khMetal);');
}

/** @param {THREE.MeshStandardMaterialParameters} params */
export function createStructureMaterial(params = {}, key = 'kh-structure') {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...params });
  mat.onBeforeCompile = patchStructureShader;
  mat.customProgramCacheKey = () => key;
  return mat;
}

/** Fade an overlay material (rings, discs, bars, borders) out over unexplored land. */
export function shroudOverlay(mat) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(mat, shader, renderer);
    bindShroud(shader);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKhW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
vec4 khOW = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
khOW = instanceMatrix * khOW;
#endif
vKhW = (modelMatrix * khOW).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKhW;\n' + SHROUD_GLSL)
      .replace('#include <fog_fragment>', 'gl_FragColor.a *= smoothstep(0.25, 0.8, khShroudK(vKhW));\n#include <fog_fragment>');
  };
  mat.customProgramCacheKey = () => `${prevKey}|kh-overlay-shroud`;
  return mat;
}
