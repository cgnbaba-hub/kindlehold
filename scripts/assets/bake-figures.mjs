#!/usr/bin/env node
// Asset baker: turns the KayKit "Adventurers" character pack (CC0, Kay Lousberg) into the compact
// figure data the game loads (public/figures/kaykit.json + .bin):
//  - skinned body and head meshes with vertex colours from the palette textures, a tint slot per
//    vertex (skin, hair, three cloth colours, metal, leather) so roles and factions can be recoloured,
//  - rigid attachments (helmets, hats, capes, weapons, shields) in the space of the bone that
//    carries them,
//  - the shared rig's animations sampled at a fixed rate as skinning matrices (3x4) for the
//    deforming bones plus the model-space matrices of the attachment bones.
// Usage: node scripts/assets/bake-figures.mjs [path/to/kaykit-character-pack-adventures-1.0]
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { readGlb, readPng } from './gltf-lite.mjs';
import { inRepo } from '../verification/lib/paths.mjs';

const SRC = process.argv[2] || '/home/user/kaykit-game-assets/kaykit-character-pack-adventures-1.0';
const DIR = path.join(SRC, 'addons/kaykit_character_pack_adventures/Characters/gltf');
const OUT = inRepo('public', 'figures');
const FPS = 24;

// palette cell (column,row of the 8x4 texture) -> tint slot, per character texture
// slots: 0 keep, 1 skin, 2 hair, 3 cloth A, 4 cloth B, 5 cloth C, 6 metal, 7 leather
export const SLOT_NAMES = ['keep', 'skin', 'hair', 'clothA', 'clothB', 'clothC', 'metal', 'leather'];
const COMMON = { '0,0': 1, '1,0': 2 };
const CELLS = {
  knight: { ...COMMON, '3,0': 6, '7,0': 6, '2,1': 6, '3,1': 6, '6,0': 7, '5,0': 7, '0,1': 3, '1,1': 4, '0,2': 4 },
  barbarian: { ...COMMON, '6,0': 7, '5,0': 7, '0,1': 3, '1,1': 3, '3,0': 6, '7,0': 5, '7,1': 5, '7,2': 5, '3,2': 4 },
  rogue: { ...COMMON, '0,1': 3, '1,1': 4, '6,0': 7, '5,0': 7, '7,1': 7, '5,2': 7, '3,0': 6, '3,2': 5 },
  mage: { ...COMMON, '0,1': 3, '1,1': 3, '7,1': 4, '3,0': 6, '4,0': 6, '5,0': 7, '2,2': 5, '2,1': 5, '7,2': 1, '3,2': 7 },
};
const CHARS = [
  { name: 'Knight', tex: 'knight', body: true },
  { name: 'Barbarian', tex: 'barbarian', body: true },
  { name: 'Rogue', tex: 'rogue', body: true },
  { name: 'Rogue_Hooded', tex: 'rogue', body: false },
  { name: 'Mage', tex: 'mage', body: true },
];
// rigid parts worth keeping (by node name) and how they take a tint: one slot for the whole part,
// palette cells -> slot for parts with several materials (the painted wood of a shield), or none
const WOOD = { '3,1': 'clothA', '5,1': 'leather', '6,1': 'clothB' };
const RIGID = {
  Knight_Helmet: 'metal', Knight_Cape: 'clothA', Barbarian_Hat: null, Barbarian_Cape: 'clothC', Rogue_Cape: 'clothB', Mage_Hat: 'clothA', Mage_Cape: 'clothC',
  '1H_Sword': null, '2H_Sword': null, '1H_Axe': null, '2H_Axe': null, Badge_Shield: WOOD, Rectangle_Shield: WOOD, Round_Shield: WOOD, Spike_Shield: WOOD, Barbarian_Round_Shield: { '2,2': 'clothA', '0,2': 'clothB' },
  '1H_Crossbow': null, '2H_Crossbow': null, Knife: null, '2H_Staff': null, '1H_Wand': null, Spellbook: null, Mug: null,
};
// animations used by the game
const CLIPS = ['Idle', 'Unarmed_Idle', '2H_Melee_Idle', 'Walking_A', 'Walking_B', 'Walking_C', 'Running_A', 'Running_B',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab',
  '2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Stab', '1H_Ranged_Aiming', '1H_Ranged_Shoot',
  '2H_Ranged_Aiming', '2H_Ranged_Shoot', '2H_Ranged_Reload', 'Block', 'Blocking', 'Hit_A', 'Hit_B', 'Death_A', 'Death_B',
  'Cheer', 'Interact', 'PickUp', 'Use_Item', 'Throw', 'Spellcast_Raise', 'Spellcast_Shoot', 'Spellcasting',
  'Sit_Floor_Idle', 'Lie_Idle', 'Unarmed_Melee_Attack_Punch_A'];
const ATTACH = ['head', 'chest', 'handslot.l', 'handslot.r', 'hips'];

const gltfs = Object.fromEntries(CHARS.map((c) => [c.name, readGlb(path.join(DIR, `${c.name}.glb`))]));
const texes = {};
for (const c of CHARS) texes[c.tex] ||= readPng(path.join(DIR, `${c.tex}_texture.png`));

const ref = gltfs.Knight;
const skin0 = ref.skins[0];
const jointNodes = skin0.joints;
const jointName = jointNodes.map((i) => ref.nodes[i].name);

// ---- which joints deform anything --------------------------------------------------------
const used = new Set();
for (const c of CHARS) {
  const g = gltfs[c.name];
  for (const n of g.nodes) if (n.skin !== undefined) {
    for (const p of g.meshes[n.mesh].primitives) {
      const J = g.read(p.attributes.JOINTS_0).data, W = g.read(p.attributes.WEIGHTS_0);
      const w = W.data, scale = W.normalized ? (W.componentType === 5121 ? 255 : 65535) : 1;
      for (let i = 0; i < J.length; i++) if (w[i] / scale > 0.001) used.add(J[i]);
    }
  }
}
const deform = [...used].sort((a, b) => a - b); // indices into skin.joints
const compact = new Map(deform.map((j, k) => [j, k]));
console.log(`deforming bones: ${deform.length} of ${jointNodes.length}: ${deform.map((j) => jointName[j]).join(' ')}`);

// ---- binary writer ------------------------------------------------------------------------
const chunks = [];
let size = 0;
function push(typed) {
  const pad = (4 - (size % 4)) % 4;
  if (pad) { chunks.push(new Uint8Array(pad)); size += pad; }
  const off = size;
  chunks.push(new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength));
  size += typed.byteLength;
  return off;
}

// ---- geometry ------------------------------------------------------------------------------
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function sample(tex, u, v) {
  const x = Math.min(tex.width - 1, Math.max(0, Math.floor(u * tex.width)));
  const y = Math.min(tex.height - 1, Math.max(0, Math.floor(v * tex.height)));
  const o = (y * tex.width + x) * 4;
  return [tex.rgba[o], tex.rgba[o + 1], tex.rgba[o + 2]];
}
// reference colour of each slot per texture: the average over its cells' middles
const refColors = {};
for (const [tname, cells] of Object.entries(CELLS)) {
  const tex = texes[tname];
  const acc = {};
  for (const [cell, slot] of Object.entries(cells)) {
    const [cx, cy] = cell.split(',').map(Number);
    const c = sample(tex, (cx + 0.5) / 8, (cy + 0.5) / 4);
    (acc[slot] ||= []).push(c);
  }
  refColors[tname] = {};
  for (const [slot, list] of Object.entries(acc)) refColors[tname][slot] = [0, 1, 2].map((i) => Math.round(list.reduce((s, c) => s + c[i], 0) / list.length));
}

/** Build one part from glTF primitives: colours and tint slots from the palette. */
function buildGeometry(g, meshIndex, tname, { rigidSlot, transform, skinned }) {
  const tex = texes[tname];
  const cells = CELLS[tname];
  const pos = [], nor = [], col = [], slot = [], shade = [], joints = [], weights = [], idx = [];
  const m = transform || new THREE.Matrix4();
  const nm = new THREE.Matrix3().getNormalMatrix(m);
  const v = new THREE.Vector3();
  for (const p of g.meshes[meshIndex].primitives) {
    const base = pos.length / 3;
    const P = g.read(p.attributes.POSITION).data, N = g.read(p.attributes.NORMAL).data, UV = g.read(p.attributes.TEXCOORD_0).data;
    const count = P.length / 3;
    let J = null, W = null, wscale = 1;
    if (skinned) { J = g.read(p.attributes.JOINTS_0).data; const Wa = g.read(p.attributes.WEIGHTS_0); W = Wa.data; wscale = Wa.normalized ? (Wa.componentType === 5121 ? 255 : 65535) : 1; }
    for (let i = 0; i < count; i++) {
      v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.set(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      const u = UV[i * 2], vv = UV[i * 2 + 1];
      const c = sample(tex, u, vv);
      col.push(...c);
      const cell = `${Math.min(7, Math.floor(u * 8))},${Math.min(3, Math.floor(vv * 4))}`;
      let s = rigidSlot === undefined ? (cells[cell] || 0) : typeof rigidSlot === 'object' ? (SLOT_OF[rigidSlot[cell]] || 0) : rigidSlot;
      // eyes, mouths and other dark details stay as they are
      if (lum(...c) < 40) s = 0;
      slot.push(s);
      const r = s ? refColors[tname][s] : null;
      shade.push(r ? Math.min(255, Math.round((lum(...c) / Math.max(1, lum(...r))) * 128)) : 128);
      if (skinned) {
        const ws = [0, 1, 2, 3].map((k) => W[i * 4 + k] / wscale);
        const js = [0, 1, 2, 3].map((k) => (ws[k] > 0.001 ? compact.get(J[i * 4 + k]) : 0));
        const sum = ws.reduce((a, b) => a + b, 0) || 1;
        const q = ws.map((w) => Math.round((w / sum) * 255));
        q[0] += 255 - q.reduce((a, b) => a + b, 0);
        joints.push(...js); weights.push(...q);
      }
    }
    const I = g.read(p.indices).data;
    for (let i = 0; i < I.length; i++) idx.push(I[i] + base);
  }
  const vc = pos.length / 3;
  const part = {
    vertexCount: vc, indexCount: idx.length,
    position: push(new Float32Array(pos)), normal: push(new Float32Array(nor)),
    color: push(new Uint8Array(col)), slot: push(new Uint8Array(slot)), shade: push(new Uint8Array(shade)),
    index: push(vc > 65535 ? new Uint32Array(idx) : new Uint16Array(idx)), index32: vc > 65535,
  };
  if (skinned) { part.joints = push(new Uint8Array(joints)); part.weights = push(new Uint8Array(weights)); }
  return part;
}

const SLOT_OF = { skin: 1, hair: 2, clothA: 3, clothB: 4, clothC: 5, metal: 6, leather: 7 };
const parts = {};
for (const c of CHARS) {
  const g = gltfs[c.name];
  for (const n of g.nodes) {
    if (n.mesh === undefined) continue;
    const isHead = /_Head/.test(n.name);
    if (n.skin !== undefined) {
      if (!c.body && !isHead) continue; // Rogue_Hooded shares the Rogue body
      parts[n.name] = { kind: 'skinned', char: c.name, tex: c.tex, ...buildGeometry(g, n.mesh, c.tex, { skinned: true }) };
    } else if (Object.hasOwn(RIGID, n.name) && !parts[n.name]) {
      const parent = g.nodes.findIndex((p) => (p.children || []).includes(g.nodes.indexOf(n)));
      const local = new THREE.Matrix4().compose(new THREE.Vector3(...(n.translation || [0, 0, 0])), new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])), new THREE.Vector3(...(n.scale || [1, 1, 1])));
      const slotName = RIGID[n.name];
      parts[n.name] = { kind: 'rigid', char: c.name, tex: c.tex, bone: g.nodes[parent].name, ...buildGeometry(g, n.mesh, c.tex, { rigidSlot: slotName === null ? 0 : typeof slotName === 'object' ? slotName : SLOT_OF[slotName], transform: local }) };
    }
  }
}

// ---- animation ----------------------------------------------------------------------------
const nodes = ref.nodes;
const parentOf = new Array(nodes.length).fill(-1);
nodes.forEach((n, i) => (n.children || []).forEach((c) => { parentOf[c] = i; }));
const rest = nodes.map((n) => ({ t: new THREE.Vector3(...(n.translation || [0, 0, 0])), r: new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])), s: new THREE.Vector3(...(n.scale || [1, 1, 1])) }));
const invBind = [];
{ const ib = ref.read(skin0.inverseBindMatrices).data; for (let j = 0; j < jointNodes.length; j++) invBind.push(new THREE.Matrix4().fromArray(ib, j * 16)); }
const footNode = nodes.findIndex((n) => n.name === 'foot.l');
const handNode = nodes.findIndex((n) => n.name === 'handslot.r');
const attachNodes = ATTACH.map((name) => nodes.findIndex((n) => n.name === name));
// the order in which world matrices can be computed (parents first)
const order = [];
{ const seen = new Set(); const visit = (i) => { if (seen.has(i)) return; if (parentOf[i] >= 0) visit(parentOf[i]); seen.add(i); order.push(i); }; nodes.forEach((_, i) => visit(i)); }

function sampleChannel(ch, t) {
  const times = ch.times, vals = ch.values, n = ch.size;
  if (t <= times[0]) return vals.slice(0, n);
  const last = times.length - 1;
  if (t >= times[last]) return vals.slice(last * n, last * n + n);
  let k = 0; while (times[k + 1] < t) k++;
  const a = (t - times[k]) / (times[k + 1] - times[k]);
  if (ch.interp === 'STEP') return vals.slice(k * n, k * n + n);
  if (n === 4) { const out = [0, 0, 0, 0]; THREE.Quaternion.slerpFlat(out, 0, vals, k * 4, vals, (k + 1) * 4, a); return out; }
  return Array.from({ length: n }, (_, c) => vals[k * n + c] + (vals[(k + 1) * n + c] - vals[k * n + c]) * a);
}

const clips = {};
const world = nodes.map(() => new THREE.Matrix4());
const local = new THREE.Matrix4(), tmp = new THREE.Matrix4();
const tq = new THREE.Quaternion(), tt = new THREE.Vector3(), ts = new THREE.Vector3();
for (const name of CLIPS) {
  const anim = ref.animations.find((a) => a.name === name);
  if (!anim) { console.warn(`missing clip ${name}`); continue; }
  const channels = anim.channels.map((c) => {
    const s = anim.samplers[c.sampler];
    const out = ref.read(s.output);
    return { node: c.target.node, path: c.target.path, times: ref.read(s.input).data, values: out.data, size: out.size, interp: s.interpolation || 'LINEAR' };
  });
  let dur = 0; for (const ch of channels) dur = Math.max(dur, ch.times[ch.times.length - 1]);
  const frames = Math.max(1, Math.round(dur * FPS) + 1);
  const stride = (deform.length + ATTACH.length) * 12;
  const data = new Float32Array(frames * stride);
  let footMin = Infinity, footMax = -Infinity; // how far a foot travels: the stride of walks and runs
  let prevHand = null, hitT = 0, hitV = -1; // the moment the right hand moves fastest: where a blow lands
  for (let f = 0; f < frames; f++) {
    const t = Math.min(dur, f / FPS);
    const pose = rest.map((r) => ({ t: r.t.clone(), r: r.r.clone(), s: r.s.clone() }));
    for (const ch of channels) {
      const v = sampleChannel(ch, t);
      if (ch.path === 'translation') pose[ch.node].t.fromArray(v);
      else if (ch.path === 'rotation') pose[ch.node].r.fromArray(v);
      else if (ch.path === 'scale') pose[ch.node].s.fromArray(v);
    }
    for (const i of order) {
      local.compose(pose[i].t, pose[i].r, pose[i].s);
      if (parentOf[i] >= 0) world[i].multiplyMatrices(world[parentOf[i]], local); else world[i].copy(local);
    }
    const fz = world[footNode].elements[14];
    footMin = Math.min(footMin, fz); footMax = Math.max(footMax, fz);
    const hand = new THREE.Vector3().setFromMatrixPosition(world[handNode]);
    if (prevHand) { const sp = hand.distanceTo(prevHand); if (sp > hitV) { hitV = sp; hitT = t; } }
    prevHand = hand;
    const base = f * stride;
    deform.forEach((j, k) => { tmp.multiplyMatrices(world[jointNodes[j]], invBind[j]); write34(data, base + k * 12, tmp); });
    attachNodes.forEach((ni, k) => write34(data, base + (deform.length + k) * 12, world[ni]));
  }
  clips[name] = { frames, duration: dur, offset: push(data), stride: +(2 * (footMax - footMin)).toFixed(3), hit: +hitT.toFixed(3) };
}
function write34(out, o, m) {
  const e = m.elements; // column-major: rows of the 3x4 are (e0,e4,e8,e12) (e1,e5,e9,e13) (e2,e6,e10,e14)
  out[o] = e[0]; out[o + 1] = e[4]; out[o + 2] = e[8]; out[o + 3] = e[12];
  out[o + 4] = e[1]; out[o + 5] = e[5]; out[o + 6] = e[9]; out[o + 7] = e[13];
  out[o + 8] = e[2]; out[o + 9] = e[6]; out[o + 10] = e[10]; out[o + 11] = e[14];
}

// bind-pose world matrices of the attachment bones (rest pose), for reference
const restWorld = nodes.map(() => new THREE.Matrix4());
for (const i of order) { local.compose(rest[i].t, rest[i].r, rest[i].s); if (parentOf[i] >= 0) restWorld[i].multiplyMatrices(restWorld[parentOf[i]], local); else restWorld[i].copy(local); }

fs.mkdirSync(OUT, { recursive: true });
const bin = new Uint8Array(size);
{ let o = 0; for (const c of chunks) { bin.set(c, o); o += c.byteLength; } }
fs.writeFileSync(path.join(OUT, 'kaykit.bin'), bin);
const meta = {
  source: 'KayKit Adventurers Character Pack 1.0 by Kay Lousberg (kaylousberg.com), CC0 1.0',
  fps: FPS, bones: deform.map((j) => jointName[j]), attach: ATTACH, slots: SLOT_NAMES,
  refColors, clips, parts,
  restAttach: Object.fromEntries(ATTACH.map((n, k) => [n, restWorld[attachNodes[k]].toArray()])),
};
fs.writeFileSync(path.join(OUT, 'kaykit.json'), JSON.stringify(meta));
fs.copyFileSync(path.join(SRC, 'LICENSE.txt'), path.join(OUT, 'KAYKIT-LICENSE.txt'));
const tris = (n) => Math.round(parts[n].indexCount / 3);
console.log(`parts: ${Object.keys(parts).map((n) => `${n}(${tris(n)})`).join(' ')}`);
console.log(`clips: ${Object.keys(clips).length}, bin ${(size / 1024).toFixed(0)} KB`);
