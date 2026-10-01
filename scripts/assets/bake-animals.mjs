// Bakes animals from Quaternius' "Ultimate Animated Animal Pack" (CC0) into one compact file for
// the wildlife view: the skinned mesh with its material colours as vertex colours, rigid parts
// (the stag's antlers) bound to their bone, and a few clips sampled at a fixed rate as skinning
// matrices (3x4), turned so the animal faces +Z, stands on y = 0 and has a set size.
//
//   node scripts/assets/bake-animals.mjs <dir with deer.glb, stag.glb>
//
// Output: public/animals/quaternius.bin + quaternius.json (see src/environment/animals-skinned.js).
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { readGlb } from './gltf-lite.mjs';

const SRC = process.argv[2];
if (!SRC) { console.error('usage: node scripts/assets/bake-animals.mjs <dir>'); process.exit(1); }
const OUT = path.resolve('public/animals');
const FPS = 15; // interpolated in the view; small, distant animals need no more
// species, file, height in metres (to the top of the head or antlers) in the game
const SPECIES = [['deer', 'deer.glb', 1.75], ['stag', 'stag.glb', 2.35]];
const CLIPS = ['Walk', 'Gallop', 'Idle', 'Idle_2', 'Eating', 'Idle_Headlow'];

const chunks = [];
let size = 0;
function push(typed) {
  const pad = (4 - (size % 4)) % 4;
  if (pad) { chunks.push(new Uint8Array(pad)); size += pad; }
  const b = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  const at = size;
  chunks.push(b); size += b.byteLength;
  return at;
}
const toSrgb = (c) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)));

function sampleChannel(ch, t) {
  const times = ch.times, vals = ch.values, n = ch.size;
  if (t <= times[0]) return Array.from(vals.slice(0, n));
  const last = times.length - 1;
  if (t >= times[last]) return Array.from(vals.slice(last * n, last * n + n));
  let k = 0; while (times[k + 1] < t) k++;
  const a = (t - times[k]) / (times[k + 1] - times[k]);
  if (ch.interp === 'STEP') return Array.from(vals.slice(k * n, k * n + n));
  if (n === 4) { const out = [0, 0, 0, 0]; THREE.Quaternion.slerpFlat(out, 0, vals, k * 4, vals, (k + 1) * 4, a); return out; }
  return Array.from({ length: n }, (_, c) => vals[k * n + c] + (vals[(k + 1) * n + c] - vals[k * n + c]) * a);
}
function write34(out, o, m) {
  const e = m.elements;
  out[o] = e[0]; out[o + 1] = e[4]; out[o + 2] = e[8]; out[o + 3] = e[12];
  out[o + 4] = e[1]; out[o + 5] = e[5]; out[o + 6] = e[9]; out[o + 7] = e[13];
  out[o + 8] = e[2]; out[o + 9] = e[6]; out[o + 10] = e[10]; out[o + 11] = e[14];
}

const meta = { source: 'Ultimate Animated Animal Pack by Quaternius (quaternius.com), CC0 1.0', fps: FPS, species: {} };
for (const [name, file, height] of SPECIES) {
  const g = readGlb(path.join(SRC, file));
  const nodes = g.nodes;
  const parentOf = new Array(nodes.length).fill(-1);
  nodes.forEach((n, i) => (n.children || []).forEach((c) => { parentOf[c] = i; }));
  const order = [];
  { const seen = new Set(); const visit = (i) => { if (seen.has(i)) return; if (parentOf[i] >= 0) visit(parentOf[i]); seen.add(i); order.push(i); }; nodes.forEach((_, i) => visit(i)); }
  const rest = nodes.map((n) => ({ t: new THREE.Vector3(...(n.translation || [0, 0, 0])), r: new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])), s: new THREE.Vector3(...(n.scale || [1, 1, 1])) }));
  const local = new THREE.Matrix4();
  const worldOf = (pose) => {
    const w = nodes.map(() => new THREE.Matrix4());
    for (const i of order) { local.compose(pose[i].t, pose[i].r, pose[i].s); if (parentOf[i] >= 0) w[i].multiplyMatrices(w[parentOf[i]], local); else w[i].copy(local); }
    return w;
  };
  const restWorld = worldOf(rest);
  const skin = g.skins[0];
  const joints = skin.joints;
  const jointIndex = new Map(joints.map((n, j) => [n, j]));
  const invBind = []; { const ib = g.read(skin.inverseBindMatrices).data; for (let j = 0; j < joints.length; j++) invBind.push(new THREE.Matrix4().fromArray(ib, j * 16)); }
  const B = joints.length;

  // geometry: skinned meshes as they are; rigid meshes bound to their parent bone (bind pose)
  const pos = [], nor = [], col = [], jo = [], we = [], idx = [];
  const v = new THREE.Vector3();
  nodes.forEach((n, ni) => {
    if (n.mesh == null) return;
    const skinned = n.skin != null;
    let rigidJoint = 0, rigidM = null;
    if (!skinned) {
      let p = parentOf[ni];
      while (p >= 0 && !jointIndex.has(p)) p = parentOf[p];
      if (p < 0) return;
      rigidJoint = jointIndex.get(p);
      // into bind space: (bindWorld of the joint) * (the node's transform under the joint)
      const bindWorld = invBind[rigidJoint].clone().invert();
      rigidM = bindWorld.multiply(restWorld[p].clone().invert().multiply(restWorld[ni]));
    }
    const nm = rigidM ? new THREE.Matrix3().getNormalMatrix(rigidM) : null;
    for (const p of g.meshes[n.mesh].primitives) {
      const base = pos.length / 3;
      const P = g.read(p.attributes.POSITION).data, N = g.read(p.attributes.NORMAL).data;
      const C = p.attributes.COLOR_0 != null ? g.read(p.attributes.COLOR_0) : null;
      const J = skinned ? g.read(p.attributes.JOINTS_0).data : null;
      const Wa = skinned ? g.read(p.attributes.WEIGHTS_0) : null;
      const mat = g.materials[p.material] || {};
      const bc = (mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorFactor) || [1, 1, 1, 1];
      const count = P.length / 3;
      for (let i = 0; i < count; i++) {
        v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); if (rigidM) v.applyMatrix4(rigidM); pos.push(v.x, v.y, v.z);
        v.set(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); if (nm) v.applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
        let cr = bc[0], cg = bc[1], cb = bc[2];
        if (C) { const k = C.normalized ? (C.componentType === 5121 ? 255 : 65535) : 1; cr *= C.data[i * C.size] / k; cg *= C.data[i * C.size + 1] / k; cb *= C.data[i * C.size + 2] / k; }
        col.push(toSrgb(cr), toSrgb(cg), toSrgb(cb));
        if (skinned) {
          const ws = [0, 1, 2, 3].map((k) => Wa.data[i * 4 + k] / (Wa.normalized ? (Wa.componentType === 5121 ? 255 : 65535) : 1));
          const sum = ws.reduce((a, b) => a + b, 0) || 1;
          const q = ws.map((w) => Math.round((w / sum) * 255)); q[0] += 255 - q.reduce((a, b) => a + b, 0);
          jo.push(J[i * 4], J[i * 4 + 1], J[i * 4 + 2], J[i * 4 + 3]); we.push(...q);
        } else { jo.push(rigidJoint, 0, 0, 0); we.push(255, 0, 0, 0); }
      }
      const I = p.indices != null ? g.read(p.indices).data : Uint32Array.from({ length: count }, (_, i) => i);
      for (let i = 0; i < I.length; i++) idx.push(base + I[i]);
    }
  });

  // turn, lift and size: from the rest pose (skinning matrices = world * inverse bind)
  const restSkin = joints.map((n, j) => new THREE.Matrix4().multiplyMatrices(restWorld[n], invBind[j]));
  const box = new THREE.Box3();
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.length / 3; i++) {
    tmp.set(0, 0, 0);
    for (let k = 0; k < 4; k++) { const w = we[i * 4 + k] / 255; if (w) tmp.add(v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(restSkin[jo[i * 4 + k]]).multiplyScalar(w)); }
    box.expandByPoint(tmp);
  }
  const headJ = joints.findIndex((n) => /head/i.test(nodes[n].name || ''));
  const hipsJ = 0;
  const headP = new THREE.Vector3().setFromMatrixPosition(restWorld[joints[headJ >= 0 ? headJ : B - 1]]);
  const hipsP = new THREE.Vector3().setFromMatrixPosition(restWorld[joints[hipsJ]]);
  const fwd = headP.clone().sub(hipsP); fwd.y = 0;
  const yaw = Math.atan2(fwd.x, fwd.z); // turn so the head points along +Z
  const scale = height / (box.max.y - box.min.y);
  const fix = new THREE.Matrix4().makeScale(scale, scale, scale)
    .premultiply(new THREE.Matrix4().makeRotationY(-yaw))
    .premultiply(new THREE.Matrix4().makeTranslation(0, -box.min.y * scale, 0));
  // the centre of the body over the origin
  const c = new THREE.Vector3((box.min.x + box.max.x) / 2, 0, (box.min.z + box.max.z) / 2).multiplyScalar(scale).applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
  fix.premultiply(new THREE.Matrix4().makeTranslation(-c.x, 0, -c.z));

  const clips = {};
  const m = new THREE.Matrix4();
  for (const cname of CLIPS) {
    const anim = g.animations.find((a) => a.name === cname) || g.animations.find((a) => a.name.endsWith(`|${cname}`));
    if (!anim) { console.warn(`${name}: missing clip ${cname}`); continue; }
    const channels = anim.channels.map((ch) => {
      const s = anim.samplers[ch.sampler];
      const out = g.read(s.output);
      return { node: ch.target.node, path: ch.target.path, times: g.read(s.input).data, values: out.data, size: out.size, interp: s.interpolation || 'LINEAR' };
    });
    let dur = 0; for (const ch of channels) dur = Math.max(dur, ch.times[ch.times.length - 1]);
    const frames = Math.max(1, Math.round(dur * FPS) + 1);
    const data = new Float32Array(frames * B * 12);
    for (let f = 0; f < frames; f++) {
      const t = Math.min(dur, f / FPS);
      const pose = rest.map((r) => ({ t: r.t.clone(), r: r.r.clone(), s: r.s.clone() }));
      for (const ch of channels) {
        const val = sampleChannel(ch, t);
        if (ch.path === 'translation') pose[ch.node].t.fromArray(val);
        else if (ch.path === 'rotation') pose[ch.node].r.fromArray(val);
        else if (ch.path === 'scale') pose[ch.node].s.fromArray(val);
      }
      const w = worldOf(pose);
      for (let j = 0; j < B; j++) { m.multiplyMatrices(w[joints[j]], invBind[j]).premultiply(fix); write34(data, (f * B + j) * 12, m); }
    }
    clips[cname] = { frames, duration: +dur.toFixed(4), offset: push(data) };
  }
  const vc = pos.length / 3;
  meta.species[name] = {
    bones: B, vertexCount: vc, indexCount: idx.length,
    position: push(new Float32Array(pos)), normal: push(new Float32Array(nor)), color: push(new Uint8Array(col)),
    joints: push(new Uint8Array(jo)), weights: push(new Uint8Array(we)),
    index: push(vc > 65535 ? new Uint32Array(idx) : new Uint16Array(idx)), index32: vc > 65535,
    height, clips,
  };
  console.log(`${name}: ${vc} vertices, ${idx.length / 3} triangles, ${B} bones, clips ${Object.keys(clips).join(' ')}`);
}
fs.mkdirSync(OUT, { recursive: true });
const bin = new Uint8Array(size);
{ let o = 0; for (const ch of chunks) { bin.set(ch, o); o += ch.byteLength; } }
fs.writeFileSync(path.join(OUT, 'quaternius.bin'), bin);
fs.writeFileSync(path.join(OUT, 'quaternius.json'), JSON.stringify(meta));
console.log(`bin ${(size / 1024).toFixed(0)} KB`);
