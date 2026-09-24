// River water: depth-tinted, animated normals, fresnel sky reflection, shoreline foam.
import * as THREE from 'three';
import { hash2 } from '../core/rng.js';

function makeNormalTexture(size = 256) {
  // tileable height from summed periodic sines + hash noise, converted to a normal map
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    let s = 0;
    s += Math.sin((u * 3 + v * 2) * Math.PI * 2) * 0.5;
    s += Math.sin((u * -5 + v * 4) * Math.PI * 2 + 1.3) * 0.3;
    s += Math.sin((u * 9 + v * -7) * Math.PI * 2 + 0.4) * 0.15;
    s += Math.sin((u * 14 + v * 11) * Math.PI * 2 + 2.1) * 0.08;
    s += (hash2(x, y, 7) - 0.5) * 0.02;
    h[y * size + x] = s;
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
    const d = h[((y - 1 + size) % size) * size + x], u = h[((y + 1) % size) * size + x];
    const nx = (l - r) * 2.2, ny = (d - u) * 2.2, nz = 1;
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
  const geo = new THREE.PlaneGeometry(terrain.size, terrain.size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) depth[i] = terrain.waterLevel - terrain.height(pos.getX(i), pos.getZ(i));
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
  const mat = new THREE.MeshStandardMaterial({ color: '#2d6470', roughness: 0.12, metalness: 0.0, transparent: true, depthWrite: false });
  const uniforms = { uTime: { value: 0 }, tNormal: { value: normalTex }, uSky: { value: new THREE.Color('#9fb8cc') }, uNight: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float depth;\nvarying float vDepth;\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvDepth = depth;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime; uniform sampler2D tNormal; uniform vec3 uSky; uniform float uNight;
varying float vDepth; varying vec3 vWPos;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float d = clamp(vDepth, 0.0, 2.5);
vec3 shallow = vec3(0.16, 0.34, 0.30);
vec3 deep = vec3(0.035, 0.12, 0.15);
diffuseColor.rgb = mix(shallow, deep, smoothstep(0.0, 1.8, d));
float foam = (1.0 - smoothstep(0.0, 0.22, d)) * (0.55 + 0.45 * sin(uTime * 1.3 + vWPos.x * 0.8 + vWPos.z * 0.6));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.82, 0.80), foam * 0.55);
float shore = smoothstep(-0.02, 0.18, vDepth);
diffuseColor.a = (mix(0.35, 0.92, smoothstep(0.0, 0.9, d)) + foam * 0.3) * shore;`)
      .replace('#include <normal_fragment_maps>', `
vec2 flow = vec2(0.035, 0.012);
vec3 n1 = texture2D(tNormal, vWPos.xz * 0.045 + flow * uTime).xyz * 2.0 - 1.0;
vec3 n2 = texture2D(tNormal, vWPos.xz * 0.11 - flow.yx * uTime * 1.7).xyz * 2.0 - 1.0;
vec3 nW = normalize(vec3(n1.x + n2.x, 3.0, n1.y + n2.y));
normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float fres = clamp(pow(1.0 - abs(dot(normalize(-vViewPosition), normal)), 3.0), 0.0, 1.0);
totalEmissiveRadiance += uSky * fres * 0.55 * (1.0 - uNight * 0.7);`);
  };
  mat.customProgramCacheKey = () => 'kh-water-v1';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  mesh.name = 'water';
  scene.add(mesh);

  return {
    id: 'environment-water',
    kind: 'view',
    mesh,
    render(alpha, frame) { uniforms.uTime.value = frame.time; },
    setSky(color, night) { uniforms.uSky.value.copy(color); uniforms.uNight.value = night; },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); normalTex.dispose(); },
  };
}
