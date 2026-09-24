// Shared PBR material for procedural props, buildings and characters.
// Vertex colours give the base albedo; a per-vertex `pattern` id selects a procedural
// world-space surface pattern (masonry, planks, thatch, shingles, plaster, cloth,
// foliage, metal) so geometry reads as crafted material without texture files.
import * as THREE from 'three';

export const PATTERN = { plain: 0, stone: 1, planks: 2, thatch: 3, shingles: 4, plaster: 5, cloth: 6, foliage: 7, metal: 8, rock: 9 };

const GLSL_COMMON = `
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
  if (pat < 8.5) { khRough = 0.38; khMetal = 0.85; return vec3(0.9 + grain * 0.15); }
  // rock
  float r = khNoise(p * 1.3) * 0.5 + khNoise(p * 4.0) * 0.3 + khNoise(p * 12.0) * 0.2;
  khRough = 0.88;
  return vec3(0.78 + r * 0.38);
}
`;

export function patchStructureShader(shader) {
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
    .replace('#include <common>', '#include <common>\n' + GLSL_COMMON)
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= khPattern(vPattern, vWPos, normalize(vWNormal));')
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
