// Skinned, instanced animals from Quaternius' Ultimate Animated Animal Pack (CC0), baked by
// scripts/assets/bake-animals.mjs. Like the figures: each species is one InstancedMesh; every
// animal writes its bone matrices into one row of a float texture and the vertex shader skins
// from there. Clips cross-fade when an animal changes from grazing to walking or running.
import * as THREE from 'three';
import { patchStructureShader, PATTERN } from '../render/structure-material.js';
import { flushInstances } from '../render/instancing.js';

/** Fetch the baked animals (null when they cannot be loaded: the simple deer stay). */
export async function loadAnimalAssets(base) {
  try {
    const root = base ?? (import.meta.env && import.meta.env.BASE_URL) ?? '/';
    const [meta, bin] = await Promise.all([
      fetch(`${root}animals/quaternius.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(`${root}animals/quaternius.bin`).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }),
    ]);
    return { meta, bin };
  } catch {
    return null;
  }
}

const VERT = `
uniform highp sampler2D anBones;
attribute float anRow; attribute vec4 anJoints; attribute vec4 anWeights;
mat4 anBone(float j) {
  int x = int(j + 0.5) * 3, y = int(anRow + 0.5);
  vec4 a = texelFetch(anBones, ivec2(x, y), 0), b = texelFetch(anBones, ivec2(x + 1, y), 0), c = texelFetch(anBones, ivec2(x + 2, y), 0);
  return mat4(a.x, b.x, c.x, 0.0, a.y, b.y, c.y, 0.0, a.z, b.z, c.z, 0.0, a.w, b.w, c.w, 1.0);
}
mat4 anSkin() { return anBone(anJoints.x) * anWeights.x + anBone(anJoints.y) * anWeights.y + anBone(anJoints.z) * anWeights.z + anBone(anJoints.w) * anWeights.w; }
`;

function material(uniforms, depth) {
  const mat = depth ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    if (!depth) patchStructureShader(shader);
    shader.uniforms.anBones = uniforms.anBones;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${VERT}`);
    if (!depth) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb = pow(color.rgb, vec3(2.2));')
        .replace('#include <beginnormal_vertex>', 'mat4 anS = anSkin();\nvec3 objectNormal = mat3(anS) * normal;')
        .replace('#include <begin_vertex>', 'vec3 transformed = (anS * vec4(position, 1.0)).xyz;');
    } else {
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = (anSkin() * vec4(position, 1.0)).xyz;');
    }
  };
  mat.customProgramCacheKey = () => (depth ? 'kh-animal-depth' : 'kh-animal');
  return mat;
}

// which clip an animal plays, by what the simulation says it does
const CLIP = { walk: 'Walk', run: 'Gallop', graze: 'Eating', idle: 'Idle' };

export function createSkinnedAnimals({ scene, assets, max = 96 }) {
  const { meta, bin } = assets;
  const species = {};
  for (const [name, sp] of Object.entries(meta.species)) {
    const B = sp.bones, W = B * 3;
    const data = new Float32Array(W * max * 4);
    const tex = new THREE.DataTexture(data, W, max, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
    const uniforms = { anBones: { value: tex } };
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bin, sp.position, sp.vertexCount * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(bin, sp.normal, sp.vertexCount * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(bin, sp.color, sp.vertexCount * 3), 3, true));
    g.setAttribute('anJoints', new THREE.BufferAttribute(new Uint8Array(bin, sp.joints, sp.vertexCount * 4), 4));
    g.setAttribute('anWeights', new THREE.BufferAttribute(new Uint8Array(bin, sp.weights, sp.vertexCount * 4), 4, true));
    g.setAttribute('pattern', new THREE.BufferAttribute(new Float32Array(sp.vertexCount).fill(PATTERN.plain), 1));
    g.setIndex(new THREE.BufferAttribute(sp.index32 ? new Uint32Array(bin, sp.index, sp.indexCount) : new Uint16Array(bin, sp.index, sp.indexCount), 1));
    const row = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    row.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('anRow', row);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 3);
    const mesh = new THREE.InstancedMesh(g, material(uniforms, false), max);
    mesh.customDepthMaterial = material(uniforms, true);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0; mesh.castShadow = true; mesh.frustumCulled = false;
    scene.add(mesh);
    const clips = {};
    for (const [cn, c] of Object.entries(sp.clips)) clips[cn] = { ...c, data: new Float32Array(bin, c.offset, c.frames * B * 12) };
    species[name] = { B, data, tex, mesh, row, clips, n: 0, uniforms };
  }

  const STRIDE = (B) => B * 12;
  const a = new Float32Array(64 * 12), b = new Float32Array(64 * 12);
  function sample(sp, clip, t, out) {
    const c = sp.clips[clip] || sp.clips.Idle;
    const n = c.frames, S = STRIDE(sp.B);
    let ft = (t * meta.fps) % Math.max(1, n - 1); if (ft < 0) ft += n - 1;
    const f0 = Math.floor(ft), f1 = Math.min(n - 1, f0 + 1), k = ft - f0;
    const d = c.data, o0 = f0 * S, o1 = f1 * S;
    for (let i = 0; i < S; i++) out[i] = d[o0 + i] + (d[o1 + i] - d[o0 + i]) * k;
  }
  const state = new Map(); // animal id -> { clip, t, from, fromT, since }
  let now = 0;

  return {
    begin() { for (const k in species) species[k].n = 0; },
    /** Draw one animal: { id, kind ('deer'|'stag'), anim, matrix (root), dt, speed }. */
    draw(f) {
      const sp = species[f.kind] || species.deer;
      if (!sp || sp.n >= max) return;
      let st = state.get(f.id);
      const want = f.anim === 'idle' && (f.id % 2) ? 'Idle_2' : (f.anim === 'graze' && Math.sin(now * 0.35 + f.id) > 0.6 ? 'Idle_Headlow' : (CLIP[f.anim] || 'Idle'));
      if (!st) { st = { clip: want, t: (f.id % 7) * 0.37, from: null, fromT: 0, since: 1, seen: 0 }; state.set(f.id, st); }
      st.seen = now;
      // walking pace follows the ground covered (the clips are modelled in place)
      const rate = f.anim === 'walk' ? Math.min(1.6, Math.max(0.6, (f.speed || 1.4) / 1.4)) : f.anim === 'run' ? Math.min(1.5, Math.max(0.7, (f.speed || 5) / 5)) : 1;
      if (want !== st.clip) { st.from = st.clip; st.fromT = st.t; st.clip = want; st.t = 0; st.since = 0; }
      st.t += (f.dt || 0) * rate; st.fromT += f.dt || 0; st.since += f.dt || 0;
      const S = STRIDE(sp.B);
      sample(sp, st.clip, st.t, a);
      if (st.from && st.since < 0.3) {
        sample(sp, st.from, st.fromT, b);
        const w = st.since / 0.3, s = w * w * (3 - 2 * w);
        for (let i = 0; i < S; i++) a[i] = b[i] + (a[i] - b[i]) * s;
      }
      const r = sp.n++;
      const o = r * sp.B * 3 * 4;
      for (let j = 0; j < sp.B; j++) { // 3 texels of 4 floats per bone
        const src = j * 12, dst = o + j * 12;
        for (let i = 0; i < 12; i++) sp.data[dst + i] = a[src + i];
      }
      sp.mesh.setMatrixAt(r, f.matrix);
      sp.row.array[r] = r;
    },
    end(dt) {
      now += dt || 0;
      for (const k in species) {
        const sp = species[k];
        sp.mesh.count = sp.n;
        if (sp.n) { sp.tex.needsUpdate = true; sp.row.needsUpdate = true; flushInstances(sp.mesh); }
      }
      if (state.size > max * 4) for (const [id, st] of state) if (now - st.seen > 5) state.delete(id);
    },
    dispose() {
      for (const k in species) { const sp = species[k]; scene.remove(sp.mesh); sp.mesh.geometry.dispose(); sp.mesh.material.dispose(); sp.mesh.customDepthMaterial.dispose(); sp.tex.dispose(); }
    },
  };
}
