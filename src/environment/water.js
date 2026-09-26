// River water: depth-tinted, animated normals, fresnel sky reflection, shoreline foam.
import * as THREE from 'three';
import { hash2 } from '../core/rng.js';
import { rawHeight } from '../world/terrain-data.js';

function makeNormalTexture(size = 256) {
  // tileable height from summed periodic sines + hash noise, converted to a normal map
  const h = new Float32Array(size * size);
  // tileable value-noise fbm (no axis-aligned sine patterns that read as a grid)
  const P = 8;
  const pn = (x, y, period, seed) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const m = (a) => ((a % period) + period) % period;
    const a = hash2(m(xi), m(yi), seed), b = hash2(m(xi + 1), m(yi), seed), c = hash2(m(xi), m(yi + 1), seed), d = hash2(m(xi + 1), m(yi + 1), seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    let s = 0, amp = 0.5, f = P;
    for (let o = 0; o < 4; o++) { s += pn(u * f, v * f, f, 11 + o) * amp; amp *= 0.5; f *= 2; }
    h[y * size + x] = s;
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
    const d = h[((y - 1 + size) % size) * size + x], u = h[((y + 1) % size) * size + x];
    const nx = (l - r) * 6, ny = (d - u) * 6, nz = 1;
    const len = Math.hypot(nx, ny, nz);
    const i = (y * size + x) * 4;
    data[i] = Math.round((nx / len * 0.5 + 0.5) * 255);
    data[i + 1] = Math.round((ny / len * 0.5 + 0.5) * 255);
    data[i + 2] = Math.round((nz / len * 0.5 + 0.5) * 255);
    data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export function createWater({ scene, terrain }) {
  const seg = 256;
  const size = terrain.size + 300;
  const geo = new THREE.PlaneGeometry(size, size, seg + 150, seg + 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const inside = Math.max(Math.abs(x), Math.abs(z)) < terrain.half;
    depth[i] = terrain.waterLevel - (inside ? terrain.height(x, z) : rawHeight(terrain.map, x, z));
  }
  // keep only triangles touching water
  const idx = geo.index.array;
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (Math.max(depth[a], depth[b], depth[c]) > -0.35) keep.push(a, b, c);
  }
  geo.setIndex(keep);
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrain.waterLevel);
  geo.setAttribute('depth', new THREE.BufferAttribute(depth, 1));
  geo.computeVertexNormals();

  const normalTex = makeNormalTexture();
  const mat = new THREE.MeshStandardMaterial({ color: '#2d6470', roughness: 0.34, metalness: 0.0, transparent: true, depthWrite: false });
  const uniforms = { uTime: { value: 0 }, tNormal: { value: normalTex }, uSky: { value: new THREE.Color('#9fb8cc') }, uNight: { value: 0 }, uIce: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float depth;\nvarying float vDepth;\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvDepth = depth;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime; uniform sampler2D tNormal; uniform vec3 uSky; uniform float uNight; uniform float uIce;
varying float vDepth; varying vec3 vWPos;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float d = clamp(vDepth, 0.0, 2.5);
vec3 shallow = vec3(0.34, 0.44, 0.33);
vec3 deep = vec3(0.015, 0.06, 0.09);
float depthK = smoothstep(0.0, 2.2, d);
diffuseColor.rgb = mix(shallow, deep, depthK * depthK * (3.0 - 2.0 * depthK));
// soft flow streaks along the current, strongest in the shallows
float streak = texture2D(tNormal, vec2(vWPos.x * 0.02 + uTime * 0.03, vWPos.z * 0.12)).r;
diffuseColor.rgb += vec3(0.05, 0.07, 0.06) * smoothstep(0.55, 0.8, streak) * (1.0 - depthK * 0.6);
float foam = (1.0 - smoothstep(0.0, 0.6, d)) * (0.55 + 0.45 * sin(uTime * 1.3 + vWPos.x * 0.8 + vWPos.z * 0.6));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.88), foam * 0.7);
float shore = smoothstep(-0.02, 0.18, vDepth);
diffuseColor.a = (mix(0.35, 0.92, smoothstep(0.0, 0.9, d)) + foam * 0.3) * shore;
if (uIce > 0.001) {
  // winter ice: milky blue-white sheet with darker clear patches and pale cracks
  float ic = texture2D(tNormal, vWPos.xz * 0.03).r;
  float crack = 1.0 - smoothstep(0.0, 0.035, abs(texture2D(tNormal, vWPos.xz * 0.018 + 0.3).g - 0.5));
  vec3 iceCol = mix(vec3(0.62, 0.74, 0.8), vec3(0.86, 0.91, 0.95), smoothstep(0.35, 0.7, ic));
  iceCol = mix(iceCol, vec3(0.3, 0.42, 0.5), (1.0 - smoothstep(0.2, 0.45, ic)) * depthK * 0.6);
  iceCol = mix(iceCol, vec3(0.97, 0.98, 1.0), crack * 0.55);
  diffuseColor.rgb = mix(diffuseColor.rgb, iceCol, uIce);
  diffuseColor.a = mix(diffuseColor.a, 0.96 * shore, uIce);
}`)
      .replace('#include <normal_fragment_maps>', `
vec2 flow = vec2(0.035, 0.012);
vec3 n1 = texture2D(tNormal, vWPos.xz * 0.045 + flow * uTime).xyz * 2.0 - 1.0;
vec3 n2 = texture2D(tNormal, vWPos.xz * 0.11 - flow.yx * uTime * 1.7).xyz * 2.0 - 1.0;
vec3 nW = normalize(mix(vec3(n1.x + n2.x, 1.8, n1.y + n2.y), vec3(n1.x * 0.15, 1.8, n1.y * 0.15), uIce));
normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float fres = clamp(pow(1.0 - abs(dot(normalize(-vViewPosition), normal)), 3.0), 0.0, 1.0);
totalEmissiveRadiance += uSky * fres * mix(0.55, 0.25, uIce) * (1.0 - uNight * 0.7);`);
  };
  mat.customProgramCacheKey = () => 'kh-water-v2';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  mesh.name = 'water';
  scene.add(mesh);

  return {
    id: 'environment-water',
    kind: 'view',
    mesh,
    render(alpha, frame) { uniforms.uTime.value = frame.time; },
    setIce(v) { uniforms.uIce.value = v; mat.roughness = 0.34 + v * 0.3; },
    setSky(color, night) { uniforms.uSky.value.copy(color); uniforms.uNight.value = night; },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); normalTex.dispose(); },
  };
}
