// Skinned, instanced figures from the KayKit characters (baked by scripts/assets/bake-figures.mjs).
// Every body and head kind is one InstancedMesh; each figure writes its bone matrices and tint
// colours into one row of a float texture, and the vertex shader skins from there. Headgear,
// cloaks, shields and weapons are rigid instances placed at the animated bones (hands hold their
// tools at the modelled hand slots). Same interface as the procedural renderer in figures.js.
import * as THREE from 'three';
import { patchStructureShader, PATTERN } from '../render/structure-material.js';
import { flushInstances } from '../render/instancing.js';
import { buildParts } from './figures.js';
import { paint, place, merge, cyl, sphere } from '../render/geometry-kit.js';
import { costume, TOOL, HAT, SETTLER_TUNICS } from './cast.js';

/** Fetch the baked figure data (null when it cannot be loaded: the procedural figures stay). */
export async function loadFigureAssets(base) {
  try {
    const root = base ?? (import.meta.env && import.meta.env.BASE_URL) ?? '/';
    const [meta, bin] = await Promise.all([
      fetch(`${root}figures/kaykit.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(`${root}figures/kaykit.bin`).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }),
    ]);
    return { meta, bin };
  } catch {
    return null;
  }
}

const MODEL_SCALE = 0.82; // KayKit characters stand 2.3 m; ours were modelled about 1.9 m tall
const SLOTS = { skin: 1, hair: 2, clothA: 3, clothB: 4, clothC: 5, metal: 6, leather: 7 };
const BODY_PARTS = ['Body', 'ArmLeft', 'ArmRight', 'LegLeft', 'LegRight'];
// our own tools (from figures.js) held at the KayKit hand slots: grip at the origin, working end +Y
// held upright in the world when not striking with them (a spear on the march, Maren's pole)
const UPRIGHT = { spear: 0.12, halberd: 0.1, pole: 0.25, rod: 0.2, bow: 0 };
const OWN_PROPS = { spear: 1, halberd: 1, pole: 1, rod: 1, pick: -1, hammer: -1, sickle: -1, ladle: -1, maul: -1, axe: -1, rake: -1, sling: -1, greataxe: -1 };
const CARRY = { timber: 'log', stone: 'stone', provisions: 'sack', iron: 'ingot', flour: 'floursack', bread: 'basket', tools: 'toolbundle' };
// how goods are carried: on the right shoulder (a log), the left one (a sack), or in both arms
const CARRY_ARMS = { timber: 'r', provisions: 'l', flour: 'l' };
const carryClip = (good) => (CARRY_ARMS[good] ? '2H_Melee_Idle' : '2H_Ranged_Aiming');
const carrySide = (good) => CARRY_ARMS[good] || null;

const VERT_COMMON = `
uniform highp sampler2D khBones;
attribute float khRow; attribute float khSlot; attribute float khShade;
#ifdef KH_SKINNED
attribute vec4 khJoints; attribute vec4 khWeights;
mat4 khBone(float j) {
  int x = int(j + 0.5) * 3, y = int(khRow + 0.5);
  vec4 a = texelFetch(khBones, ivec2(x, y), 0), b = texelFetch(khBones, ivec2(x + 1, y), 0), c = texelFetch(khBones, ivec2(x + 2, y), 0);
  return mat4(a.x, b.x, c.x, 0.0, a.y, b.y, c.y, 0.0, a.z, b.z, c.z, 0.0, a.w, b.w, c.w, 1.0);
}
mat4 khSkinMat() { return khBone(khJoints.x) * khWeights.x + khBone(khJoints.y) * khWeights.y + khBone(khJoints.z) * khWeights.z + khBone(khJoints.w) * khWeights.w; }
#endif
`;
const TINT = `
vColor.rgb = pow(color.rgb, vec3(2.2)); // the palette is in sRGB
if (khSlot > 0.5) {
  vec4 khT = texelFetch(khBones, ivec2(KH_TINT_X + int(khSlot + 0.5), int(khRow + 0.5)), 0);
  if (khT.a > 0.5) vColor.rgb = khT.rgb * pow(khShade * 2.0, 2.2);
}
`;

function figureMaterial(uniforms, tintX, skinned) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
  mat.defines = { KH_TINT_X: tintX, ...(skinned ? { KH_SKINNED: '' } : {}) };
  mat.onBeforeCompile = (shader) => {
    patchStructureShader(shader);
    shader.uniforms.khBones = uniforms.khBones;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_COMMON}`)
      .replace('#include <color_vertex>', `#include <color_vertex>\n${TINT}`);
    if (skinned) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <beginnormal_vertex>', 'mat4 khSkin = khSkinMat();\nvec3 objectNormal = mat3(khSkin) * normal;')
        .replace('#include <begin_vertex>', 'vec3 transformed = (khSkin * vec4(position, 1.0)).xyz;');
    }
  };
  mat.customProgramCacheKey = () => `kh-figure-${skinned ? 's' : 'r'}`;
  return mat;
}

function depthMaterial(uniforms) {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.khBones = uniforms.khBones;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n#define KH_SKINNED\n${VERT_COMMON}`)
      .replace('#include <begin_vertex>', 'vec3 transformed = (khSkinMat() * vec4(position, 1.0)).xyz;');
  };
  mat.customProgramCacheKey = () => 'kh-figure-depth';
  return mat;
}

export function createSkinnedFigureRenderer({ scene, assets, maxFigures = 512 }) {
  const { meta, bin } = assets;
  const B = meta.bones.length, NA = meta.attach.length, STRIDE = (B + NA) * 12;
  const A = Object.fromEntries(meta.attach.map((n, k) => [n, B + k])); // attach bone -> matrix index
  const W = B * 3 + 8; // texels per row: bones, then 8 tint slots
  let rows = 256;
  const uniforms = { khBones: { value: null } };
  let data = new Float32Array(W * rows * 4);
  let tex = makeTex();
  function makeTex() {
    const t = new THREE.DataTexture(data, W, rows, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
    uniforms.khBones.value = t;
    return t;
  }

  // ---- geometry from the baked parts ------------------------------------------------------
  function view(T, off, n) { return new T(bin, off, n); }
  function partGeometry(names, skinned) {
    const list = names.map((n) => meta.parts[n]).filter(Boolean);
    const vc = list.reduce((s, p) => s + p.vertexCount, 0), ic = list.reduce((s, p) => s + p.indexCount, 0);
    const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), col = new Uint8Array(vc * 3), slot = new Uint8Array(vc), shade = new Uint8Array(vc), pat = new Float32Array(vc);
    const joints = skinned ? new Uint8Array(vc * 4) : null, weights = skinned ? new Uint8Array(vc * 4) : null;
    const idx = vc > 65535 ? new Uint32Array(ic) : new Uint16Array(ic);
    let v = 0, i = 0;
    for (const p of list) {
      pos.set(view(Float32Array, p.position, p.vertexCount * 3), v * 3);
      nor.set(view(Float32Array, p.normal, p.vertexCount * 3), v * 3);
      col.set(view(Uint8Array, p.color, p.vertexCount * 3), v * 3);
      const sl = view(Uint8Array, p.slot, p.vertexCount);
      slot.set(sl, v); shade.set(view(Uint8Array, p.shade, p.vertexCount), v);
      pat.fill(PATTERN.plain, v, v + p.vertexCount);
      if (skinned) { joints.set(view(Uint8Array, p.joints, p.vertexCount * 4), v * 4); weights.set(view(Uint8Array, p.weights, p.vertexCount * 4), v * 4); }
      const src = p.index32 ? view(Uint32Array, p.index, p.indexCount) : view(Uint16Array, p.index, p.indexCount);
      for (let k = 0; k < p.indexCount; k++) idx[i + k] = src[k] + v;
      v += p.vertexCount; i += p.indexCount;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    g.setAttribute('khSlot', new THREE.BufferAttribute(slot, 1));
    g.setAttribute('khShade', new THREE.BufferAttribute(shade, 1, true));
    g.setAttribute('pattern', new THREE.BufferAttribute(pat, 1));
    if (skinned) { g.setAttribute('khJoints', new THREE.BufferAttribute(joints, 4)); g.setAttribute('khWeights', new THREE.BufferAttribute(weights, 4, true)); }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.1, 0), 3);
    return g;
  }

  const skinMat = figureMaterial(uniforms, B * 3, true), rigidMat = figureMaterial(uniforms, B * 3, false);
  const depthMat = depthMaterial(uniforms);
  const kinds = {}; // name -> { mesh, row attribute, count, skinned }
  function kind(name, names, skinned) {
    if (kinds[name]) return kinds[name];
    const geo = partGeometry(names, skinned);
    const mesh = new THREE.InstancedMesh(geo, skinned ? skinMat : rigidMat, maxFigures);
    const row = new THREE.InstancedBufferAttribute(new Float32Array(maxFigures), 1);
    row.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('khRow', row);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0; mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
    if (skinned) mesh.customDepthMaterial = depthMat;
    scene.add(mesh);
    return (kinds[name] = { mesh, row, n: 0 });
  }
  const bodyKind = (b) => kind(`body:${b}`, BODY_PARTS.map((p) => `${b}_${p}`), true);
  const headKind = (h) => kind(`head:${h}`, [h], true);
  const rigidKind = (r) => kind(`rigid:${r}`, [r], false);

  // our own tools and goods (vertex-coloured structure material, like the procedural figures)
  const own = buildParts();
  // headwear for everyday work, sized for the KayKit heads (in the head bone's space: the head
  // spans about 0..1 upwards, 1.1 wide)
  own.strawhat = merge([
    paint(place(cyl(0.86, 0.9, 0.05, 16), { y: 0.8 }), '#d9c07a', 0, null, PATTERN.cloth),
    paint(place(cyl(0.44, 0.52, 0.34, 14), { y: 0.98 }), '#cdb46c', 0, null, PATTERN.cloth),
    paint(place(cyl(0.53, 0.53, 0.07, 14), { y: 0.86 }), '#8a4a3a', 0, null, PATTERN.cloth),
  ]);
  own.toque = merge([
    paint(place(cyl(0.5, 0.48, 0.42, 14), { y: 1.0 }), '#f2eee4', 0, null, PATTERN.cloth),
    paint(place(sphere(0.56, 12, 6), { y: 1.28, sy: 0.55 }), '#faf7f0', 0, null, PATTERN.cloth),
  ]);
  const ownMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  ownMat.onBeforeCompile = patchStructureShader; ownMat.customProgramCacheKey = () => 'kh-structure';
  const owns = {};
  function ownKind(k) {
    if (owns[k]) return owns[k];
    const mesh = new THREE.InstancedMesh(own[k], ownMat, maxFigures);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0; mesh.castShadow = true; mesh.frustumCulled = false;
    scene.add(mesh);
    return (owns[k] = { mesh, n: 0 });
  }
  // hero lantern cores
  const glowGeo = new THREE.SphereGeometry(0.075, 8, 6);
  const glowMat = new THREE.MeshStandardMaterial({ color: '#40301a', emissive: '#ffbe62', emissiveIntensity: 2.2 });
  const glow = new THREE.InstancedMesh(glowGeo, glowMat, 8);
  glow.count = 0; glow.frustumCulled = false; scene.add(glow);

  // ---- animation sampling -----------------------------------------------------------------
  const clipData = {};
  for (const [name, c] of Object.entries(meta.clips)) clipData[name] = { ...c, name, data: new Float32Array(bin, c.offset, c.frames * STRIDE) };
  const fps = meta.fps;
  const mats = new Float32Array(STRIDE), mats2 = new Float32Array(STRIDE), mats3 = new Float32Array(STRIDE);
  /** Sample a clip at time t (looping or holding the last frame) into out. */
  function sample(clip, t, loop, out) {
    const c = clipData[clip] || clipData.Idle;
    const n = c.frames;
    let ft = t * fps;
    if (loop && n > 1) { ft %= n - 1; if (ft < 0) ft += n - 1; } else ft = Math.min(Math.max(ft, 0), n - 1);
    const f0 = Math.floor(ft), f1 = Math.min(n - 1, f0 + 1), a = ft - f0;
    const d = c.data, o0 = f0 * STRIDE, o1 = f1 * STRIDE;
    for (let k = 0; k < STRIDE; k++) out[k] = d[o0 + k] + (d[o1 + k] - d[o0 + k]) * a;
    return out;
  }
  function mix(outA, b, w) { for (let k = 0; k < STRIDE; k++) outA[k] += (b[k] - outA[k]) * w; }
  const m4 = new THREE.Matrix4(), m4b = new THREE.Matrix4(), m4c = new THREE.Matrix4(), rootM = new THREE.Matrix4();
  function get4(src, idx, out) {
    const o = idx * 12;
    return out.set(src[o], src[o + 1], src[o + 2], src[o + 3], src[o + 4], src[o + 5], src[o + 6], src[o + 7], src[o + 8], src[o + 9], src[o + 10], src[o + 11], 0, 0, 0, 1);
  }
  function put4(dst, idx, m) {
    const e = m.elements, o = idx * 12;
    dst[o] = e[0]; dst[o + 1] = e[4]; dst[o + 2] = e[8]; dst[o + 3] = e[12];
    dst[o + 4] = e[1]; dst[o + 5] = e[5]; dst[o + 6] = e[9]; dst[o + 7] = e[13];
    dst[o + 8] = e[2]; dst[o + 9] = e[6]; dst[o + 10] = e[10]; dst[o + 11] = e[14];
  }
  const ARM_L = ['upperarm.l', 'lowerarm.l', 'wrist.l', 'hand.l'].map((n) => meta.bones.indexOf(n));
  const ARM_R = ['upperarm.r', 'lowerarm.r', 'wrist.r', 'hand.r'].map((n) => meta.bones.indexOf(n));
  /** Upper-body layer: take the arms (and hand slots) of another pose, re-rooted on this chest. */
  function layerArms(base, arms, which) {
    get4(base, A.chest, m4); get4(arms, A.chest, m4b);
    m4c.copy(m4b).invert(); m4.multiply(m4c); // chest(base) * inverse(chest(arms))
    const list = which === 'l' ? ARM_L : which === 'r' ? ARM_R : ARM_L.concat(ARM_R);
    for (const j of list) { get4(arms, j, m4b); m4b.premultiply(m4); put4(base, j, m4b); }
    for (const s of which === 'l' ? ['handslot.l'] : which === 'r' ? ['handslot.r'] : ['handslot.l', 'handslot.r']) { get4(arms, A[s], m4b); m4b.premultiply(m4); put4(base, A[s], m4b); }
  }

  // ---- which clip, at which time ----------------------------------------------------------
  const ATTACK = {
    slash: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal'],
    heavy: ['2H_Melee_Attack_Chop'], thrust: ['1H_Melee_Attack_Stab'], thrust2: ['2H_Melee_Attack_Stab', '2H_Melee_Attack_Slice'],
    bow: ['1H_Ranged_Shoot'], crossbow: ['2H_Ranged_Shoot'], sling: ['Throw'], unarmed: ['Unarmed_Melee_Attack_Punch_A'],
  };
  const GUARD = { slash: 'Idle', heavy: '2H_Melee_Idle', thrust: 'Idle', thrust2: '2H_Melee_Idle', bow: '1H_Ranged_Aiming', crossbow: '2H_Ranged_Aiming', sling: 'Idle', unarmed: 'Idle' };
  const WORK = { chop: '2H_Melee_Attack_Chop', pick: '2H_Melee_Attack_Chop', mine: '2H_Melee_Attack_Chop', hammer: '1H_Melee_Attack_Chop', farm: 'PickUp', sow: 'PickUp', harvest: 'PickUp', stir: 'Use_Item', knead: 'Use_Item', fish: '1H_Ranged_Aiming', cast: 'Spellcast_Shoot', cower: 'Blocking', talk: 'Idle' };
  const state = new Map(); // figure id -> { clip, time, from, fromTime, since, walkT, x, z, speed }
  const pick = { clip: 'Idle', time: 0, loop: true, arms: null, armsTime: 0, armsSide: null };
  function choose(f, c, st) {
    const t = f.t || 0, ph = f.phase || 0;
    pick.arms = null; pick.loop = true;
    const idle = c.weapon === 'heavy' || c.weapon === 'thrust2' ? '2H_Melee_Idle' : 'Idle';
    if (f.fallen > 0) { pick.clip = ph % 3 === 1 ? 'Death_B' : 'Death_A'; pick.time = f.deathT !== undefined ? f.deathT : f.fallen * clipData[pick.clip].duration; pick.loop = false; return pick; }
    if (f.kneel) { pick.clip = 'Sit_Floor_Idle'; pick.time = t; return pick; }
    switch (f.anim) {
      case 'walk': case 'run': case 'carry': {
        const run = f.anim === 'run';
        const clip = run ? (ph % 2 ? 'Running_B' : 'Running_A') : ['Walking_A', 'Walking_B', 'Walking_C'][ph % 3];
        pick.clip = clip; pick.time = st.walkT * clipData[clip].duration;
        if (f.anim === 'carry') { pick.arms = carryClip(f.carry); pick.armsTime = t; pick.armsSide = carrySide(f.carry); }
        return pick;
      }
      case 'carryIdle': pick.clip = 'Idle'; pick.time = t; pick.arms = carryClip(f.carry); pick.armsTime = t; pick.armsSide = carrySide(f.carry); return pick;
      case 'attack': {
        const list = ATTACK[c.weapon] || ATTACK.slash;
        const clip = list[(Math.floor((f.attack && f.attack.n) || 0) + ph) % list.length];
        const cd = clipData[clip], h = cd.hit, L = cd.duration;
        const a = f.attack || { since: 9, until: 9 };
        if (a.since < L - h) { pick.clip = clip; pick.time = h + a.since; pick.loop = false; }
        else if (a.until < h) { pick.clip = clip; pick.time = h - a.until; pick.loop = false; }
        else { pick.clip = c.guard || GUARD[c.weapon] || 'Idle'; pick.time = t; }
        return pick;
      }
      case 'talk': pick.clip = Math.sin(t * 0.45 + ph * 2.1) > 0 ? 'Interact' : 'Idle'; pick.time = t; return pick;
      case 'cast': if (c.weapon === 'bow') { pick.clip = '1H_Ranged_Shoot'; pick.time = t; return pick; } pick.clip = 'Spellcast_Shoot'; pick.time = t; return pick;
      default:
        if (WORK[f.anim]) { pick.clip = WORK[f.anim]; pick.time = t; return pick; }
        pick.clip = idle; pick.time = t;
        // now and then someone idle cheers, stretches or looks about
        if (f.gestures && ((t + ph * 1.7) % 11) < clipData.Cheer.duration && ph % 4 === 0) { pick.clip = 'Cheer'; pick.time = (t + ph * 1.7) % 11; }
        return pick;
    }
  }

  // ---- drawing ----------------------------------------------------------------------------
  let count = 0;
  const q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  const out = new THREE.Matrix4(), boneM = new THREE.Matrix4(), local = new THREE.Matrix4();
  const flipM = new THREE.Matrix4().makeRotationZ(Math.PI);
  const time = { now: 0 };

  function begin() {
    count = 0;
    for (const k in kinds) kinds[k].n = 0;
    for (const k in owns) owns[k].n = 0;
    glow.count = 0;
  }

  function addInstance(k, matrix, row) {
    if (k.n >= maxFigures) return;
    k.mesh.setMatrixAt(k.n, matrix);
    if (k.row) k.row.array[k.n] = row;
    k.n++;
  }

  function draw(f) {
    if (count >= maxFigures) return;
    if (count >= rows) grow();
    const c = costume(f.style, f.phase || 0, f.tunic);
    const id = f.id ?? f.phase ?? count;
    const dt = f.dt || 0;
    let st = state.get(id);
    if (!st) { st = { clip: null, time: 0, from: null, fromTime: 0, since: 1, walkT: ((f.phase || 0) % 7) * 0.13, x: f.x, z: f.z, speed: 0, seen: 0, strikeW: 0 }; state.set(id, st); }
    st.seen = time.now;
    // walking cadence from the ground covered (up to 1.8x the modelled pace, so short legs do not blur)
    const moved = Math.hypot(f.x - st.x, f.z - st.z);
    st.x = f.x; st.z = f.z;
    if (dt > 0 && moved < 3) st.speed += (moved / dt - st.speed) * Math.min(1, dt * 8);
    const scale = (f.scale || 1) * MODEL_SCALE * (c.scale || 1);
    if (f.anim === 'walk' || f.anim === 'run' || f.anim === 'carry') {
      const clip = f.anim === 'run' ? clipData.Running_A : clipData.Walking_A;
      const natural = (clip.stride * scale) / clip.duration; // metres per second at the modelled pace
      const rate = f.walkPh !== undefined && !dt ? 1 : Math.min(1.8, Math.max(0.6, st.speed / Math.max(0.01, natural)));
      st.walkT = f.walkPh !== undefined && !dt ? f.walkPh / (Math.PI * 2) : (st.walkT + (dt * rate) / clip.duration) % 1;
    }
    const p = choose(f, c, st);
    if (p.clip !== st.clip) { st.from = st.clip; st.fromTime = st.time; st.since = 0; st.clip = p.clip; }
    else st.since += dt;
    st.time = p.time;
    sample(p.clip, p.time, p.loop, mats);
    if (p.arms) { sample(p.arms, p.armsTime, true, mats2); layerArms(mats, mats2, p.armsSide); }
    // cross-fade from the previous clip (0.2 s)
    if (st.from && st.since < 0.2) {
      sample(st.from, st.fromTime, true, mats3);
      const w = st.since / 0.2;
      for (let k = 0; k < STRIDE; k++) mats[k] = mats3[k] + (mats[k] - mats3[k]) * (w * w * (3 - 2 * w));
    }
    // a hit makes the figure flinch; an order is answered with a short cheer
    if (f.hit > 0) { sample('Hit_A', 0.25, false, mats2); mix(mats, mats2, f.hit * 0.8); }
    if (f.ack && f.ack.k > 0) { mats3.set(mats); sample('Cheer', 0.55, false, mats2); layerArms(mats3, mats2, null); mix(mats, mats3, f.ack.k * 0.8); }

    // bone texture row: skinning matrices, then the tints
    const row = count++;
    const o = row * W * 4;
    data.set(mats.subarray(0, B * 12), o);
    for (let s = 1; s < 8; s++) data[o + (B * 3 + s) * 4 + 3] = 0;
    for (const [slot, hex] of Object.entries(c.tints)) {
      const s = SLOTS[slot];
      if (!s || !hex) continue;
      tint.set(hex);
      const k = o + (B * 3 + s) * 4;
      data[k] = tint.r; data[k + 1] = tint.g; data[k + 2] = tint.b; data[k + 3] = 1;
    }
    if (f.style === 'settler' && f.tunic) { tint.set(f.tunic); const k = o + (B * 3 + SLOTS.clothA) * 4; data[k] = tint.r; data[k + 1] = tint.g; data[k + 2] = tint.b; data[k + 3] = 1; }

    // root: position, heading, size
    q.setFromAxisAngle(up, f.heading || 0);
    rootM.compose(v3.set(f.x, f.y, f.z), q, s3.set(scale, scale, scale));
    addInstance(bodyKind(c.body), rootM, row);
    addInstance(headKind(c.head), rootM, row);
    const hat = f.style === 'settler' && !f.fallen ? (HAT[f.job] || null) : null;
    if (hat) {
      out.multiplyMatrices(rootM, get4(mats, A.head, boneM));
      local.makeRotationX(-0.12);
      out.multiply(local);
      addInstance(ownKind(hat), out, row);
    }
    for (const r of c.rigid) {
      const part = meta.parts[r];
      if (!part) continue;
      if (f.fallen > 0.5 && /Cape/.test(r)) continue;
      out.multiplyMatrices(rootM, get4(mats, A[part.bone], boneM));
      addInstance(rigidKind(r), out, row);
    }
    // hands: weapons, tools, goods
    const right = f.carry ? null : (f.tool || c.right);
    const left = f.carry ? null : c.left;
    // pole weapons are levelled for a blow and carried upright otherwise
    const striking = (ATTACK[c.weapon] || []).includes(p.clip) || f.anim === 'fish';
    st.strikeW += ((striking ? 1 : 0) - st.strikeW) * Math.min(1, (dt || 0.05) * 10);
    if (right) placeProp(right, 'handslot.r', row, f, st.strikeW);
    if (left) placeProp(left, 'handslot.l', row, f, 0);
    if (f.carry && CARRY[f.carry]) {
      // goods sit in the model's frame: a log along the right shoulder, a sack over the left one,
      // stone and iron held before the chest between both hands
      const g = CARRY[f.carry];
      get4(mats, A.chest, boneM);
      if (CARRY_ARMS[f.carry]) {
        v3.set(boneM.elements[12], boneM.elements[13], boneM.elements[14]).add(pa.set(g === 'log' ? -0.34 : 0.3, 0.42, g === 'log' ? 0 : -0.12));
        local.compose(v3, g === 'log' ? q.setFromEuler(eu.set(0.12, Math.PI / 2, 0)) : q.identity(), s3.set(1.7, 1.7, 1.7));
      } else {
        const l = get4(mats, A['handslot.l'], m4b).elements, r = get4(mats, A['handslot.r'], m4c).elements;
        v3.set((l[12] + r[12]) / 2, (l[13] + r[13]) / 2 + 0.05, (l[14] + r[14]) / 2);
        local.compose(v3, q.identity(), s3.set(1.9, 1.9, 1.9));
      }
      out.multiplyMatrices(rootM, local);
      addInstance(ownKind(g), out, row);
    }
  }

  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), pa = new THREE.Vector3(), sa = new THREE.Vector3(), eu = new THREE.Euler();
  function placeProp(name, slot, row, f, strikeW) {
    const part = meta.parts[name];
    if (part) { // a KayKit weapon or shield: modelled in the space of its hand slot
      out.multiplyMatrices(rootM, get4(mats, A[part.bone], boneM));
      addInstance(rigidKind(name), out, row);
      return;
    }
    out.multiplyMatrices(rootM, get4(mats, A[slot], boneM));
    if (!own[name]) return;
    // our tools: grip at the origin, working end along +Y (blades are modelled pointing down)
    local.makeScale(1.35, 1.35, 1.35);
    if (OWN_PROPS[name] === -1) local.multiply(flipM);
    out.multiply(local);
    if (UPRIGHT[name] !== undefined) {
      // held in the world's frame, facing where the figure faces: poles stand upright and are
      // levelled for a thrust, a rod reaches out over the water, a bow's stave stands with the
      // string towards the archer
      out.decompose(pa, qa, sa);
      const pitch = name === 'bow' ? -Math.PI / 2 : name === 'rod' && f.anim === 'fish' ? 0.95 : UPRIGHT[name] + (Math.PI / 2 - 0.08 - UPRIGHT[name]) * strikeW;
      qb.setFromEuler(eu.set(pitch, f.heading || 0, 0, 'YXZ'));
      out.compose(pa, qb, sa);
    }
    addInstance(ownKind(name), out, row);
    if (name === 'pole') {
      // Maren's lantern hangs from the tip of the pole, level with the world
      v3.set(0, 0.72, 0.28).applyMatrix4(out);
      local.compose(v3, q.identity(), s3.set(1.1, 1.1, 1.1));
      local.multiply(m4.makeTranslation(0, -0.2, 0));
      const s = (f.scale || 1) * MODEL_SCALE;
      local.scale(s3.set(s, s, s));
      addInstance(ownKind('lantern'), local, row);
      if (glow.count < 8) glow.setMatrixAt(glow.count++, local);
      if (f.lanternOut) f.lanternOut.setFromMatrixPosition(local);
    }
    if (name === 'rod' && f.anim === 'fish') {
      v3.set(0, 1.7, 0).applyMatrix4(out);
      const s = (f.scale || 1) * MODEL_SCALE;
      local.compose(v3, q.identity(), s3.set(s * 1.2, s * 1.2, s * 1.2));
      addInstance(ownKind('line'), local, row);
    }
  }
  function grow() {
    rows = Math.min(maxFigures, rows * 2);
    const next = new Float32Array(W * rows * 4);
    next.set(data.subarray(0, Math.min(data.length, next.length)));
    data = next;
    tex.dispose();
    tex = makeTex();
  }

  function end() {
    for (const k in kinds) {
      const { mesh, row, n } = kinds[k];
      mesh.count = n;
      flushInstances(mesh, row ? [row] : []);
    }
    for (const k in owns) { owns[k].mesh.count = owns[k].n; flushInstances(owns[k].mesh); }
    glow.instanceMatrix.needsUpdate = true;
    if (count > 0) tex.needsUpdate = true;
  }

  return {
    begin, draw, end, meshes: kinds, skinned: true,
    setOutline() {},
    /** Advance the renderer's own clock (for forgetting figures that are gone). */
    tick(dt) {
      time.now += dt;
      if (Math.floor(time.now / 5) !== Math.floor((time.now - dt) / 5)) for (const [id, s] of state) if (time.now - s.seen > 3) state.delete(id);
    },
    toolFor: (job) => TOOL[job] || null,
    tunicFor: (id) => SETTLER_TUNICS[id % SETTLER_TUNICS.length],
    dispose() {
      for (const k in kinds) { scene.remove(kinds[k].mesh); kinds[k].mesh.geometry.dispose(); }
      for (const k in owns) scene.remove(owns[k].mesh);
      for (const k in own) own[k].dispose();
      scene.remove(glow); glowGeo.dispose(); glowMat.dispose();
      skinMat.dispose(); rigidMat.dispose(); depthMat.dispose(); ownMat.dispose(); tex.dispose();
    },
  };
}
