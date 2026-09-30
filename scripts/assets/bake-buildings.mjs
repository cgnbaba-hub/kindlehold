// Bakes the KayKit Medieval Hexagon Pack (Kay Lousberg, CC0) into one compact file for the
// buildings view: every model's triangles with colours sampled from the pack's palette texture
// (vertex colours, like the figures) and a surface pattern for the structure shader per palette
// cell (stone, planks, shingles...). Moving parts (the windmill's sails, the watermill's wheel)
// are kept as separate parts with their pivot.
//
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 <dir>
//   node scripts/assets/bake-buildings.mjs <dir>
//
// Output: public/buildings/kaykit.bin + kaykit.json (see src/buildings/kaykit.js).
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { readGltf, readPng } from './gltf-lite.mjs';

const ROOT = process.argv[2];
if (!ROOT) { console.error('usage: node scripts/assets/bake-buildings.mjs <pack dir>'); process.exit(1); }
const DIR = path.join(ROOT, 'addons/kaykit_medieval_hexagon_pack/Assets/gltf');
const OUT = path.resolve('public/buildings');

const MODELS = [
  ...['archeryrange', 'barracks', 'blacksmith', 'castle', 'church', 'home_A', 'home_B', 'lumbermill', 'market', 'mine', 'tavern', 'tower_A', 'tower_B', 'tower_base', 'watermill', 'well', 'windmill'].map((n) => [n, `buildings/blue/building_${n}_blue.gltf`]),
  ...['grain', 'scaffolding', 'stage_A', 'stage_B', 'stage_C', 'destroyed', 'dirt', 'fence_wood_straight', 'fence_stone_straight'].map((n) => [n, `buildings/neutral/${n.startsWith('fence') ? '' : 'building_'}${n}.gltf`]),
  ...['barrel', 'crate_A_big', 'crate_B_small', 'crate_long_A', 'crate_open', 'sack', 'resource_lumber', 'resource_stone', 'wheelbarrow', 'pallet', 'weaponrack', 'target', 'tent', 'ladder', 'bucket_water', 'flag_blue'].map((n) => [n, `decoration/props/${n}.gltf`]),
];
// nodes that move on their own
const MOVING = /(_fan|_wheel)/;

// palette cell (column,row of the 8x4 gradient texture) -> surface pattern of the structure shader
const PATTERN = { plain: 0, stone: 1, planks: 2, thatch: 3, shingles: 4, plaster: 5, cloth: 6, foliage: 7, metal: 8, rock: 9 };
const CELL_PATTERN = {
  '2,0': 'stone', '3,0': 'stone', '2,2': 'stone', '6,1': 'stone', '7,1': 'rock',
  '5,0': 'planks', '6,0': 'planks', '2,1': 'planks', '5,3': 'planks', '6,3': 'planks', '7,3': 'planks',
  '1,1': 'shingles', '0,3': 'shingles', '0,1': 'shingles', '7,0': 'shingles', '6,2': 'shingles', '1,3': 'shingles',
  '3,1': 'thatch', '4,1': 'foliage', '1,2': 'foliage', '0,2': 'foliage',
  '5,1': 'plaster', '3,2': 'plaster', '4,2': 'plaster', '5,2': 'plaster',
};

let tex = null;
function sample(u, v) {
  const x = Math.min(tex.width - 1, Math.max(0, Math.floor(u * tex.width)));
  const y = Math.min(tex.height - 1, Math.max(0, Math.floor(v * tex.height)));
  const o = (y * tex.width + x) * 4;
  return [tex.rgba[o], tex.rgba[o + 1], tex.rgba[o + 2]];
}

const chunks = [];
let offset = 0;
function push(typed) {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  const at = offset;
  chunks.push(buf); offset += buf.length;
  return at;
}

/** Triangles of a set of (mesh, matrix) pairs as one part. */
function bake(g, list) {
  const pos = [], nor = [], col = [], idx = [];
  const v = new THREE.Vector3();
  for (const { mesh, m } of list) {
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    for (const p of g.meshes[mesh].primitives) {
      const base = pos.length / 3;
      const P = g.read(p.attributes.POSITION).data, N = g.read(p.attributes.NORMAL).data, UV = g.read(p.attributes.TEXCOORD_0).data;
      const n = P.length / 3;
      for (let i = 0; i < n; i++) {
        v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(m); pos.push(v.x, v.y, v.z);
        v.set(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]).applyMatrix3(nm).normalize(); nor.push(Math.round(v.x * 127), Math.round(v.y * 127), Math.round(v.z * 127), 0);
        const u = UV[i * 2], vv = UV[i * 2 + 1];
        const c = sample(u, vv);
        const cell = `${Math.min(7, Math.floor(u * 8))},${Math.min(3, Math.floor(vv * 4))}`;
        // alpha: the surface pattern, +16 on window panes (the darkest cell), which glow at night
        col.push(c[0], c[1], c[2], PATTERN[CELL_PATTERN[cell] || 'plain'] + (cell === '0,0' ? 16 : 0));
      }
      const I = p.indices != null ? g.read(p.indices).data : Uint32Array.from({ length: n }, (_, i) => i);
      for (let i = 0; i < I.length; i++) idx.push(base + I[i]);
    }
  }
  if (pos.length / 3 > 65535) throw new Error('part too large for 16-bit indices');
  const box = new THREE.Box3();
  for (let i = 0; i < pos.length; i += 3) box.expandByPoint(v.set(pos[i], pos[i + 1], pos[i + 2]));
  return {
    vertices: pos.length / 3, indices: idx.length,
    pos: push(new Float32Array(pos)), nor: push(new Int8Array(nor)), col: push(new Uint8Array(col)), idx: push(new Uint16Array(idx)),
    min: box.min.toArray().map((x) => +x.toFixed(4)), max: box.max.toArray().map((x) => +x.toFixed(4)),
  };
}

const meta = { source: 'KayKit Medieval Hexagon Pack 1.0 by Kay Lousberg (CC0)', models: {} };
let tris = 0;
for (const [name, file] of MODELS) {
  const full = path.join(DIR, file);
  if (!fs.existsSync(full)) { console.warn(`missing ${file}`); continue; }
  const g = readGltf(full);
  tex ||= readPng(path.join(path.dirname(full), g.images[0].uri));
  // walk the scene: static meshes into the body, moving nodes into parts of their own
  const body = [], moving = [];
  const walk = (ni, parent) => {
    const nd = g.nodes[ni];
    const local = new THREE.Matrix4();
    if (nd.matrix) local.fromArray(nd.matrix);
    else local.compose(new THREE.Vector3(...(nd.translation || [0, 0, 0])), new THREE.Quaternion(...(nd.rotation || [0, 0, 0, 1])), new THREE.Vector3(...(nd.scale || [1, 1, 1])));
    const m = parent.clone().multiply(local);
    if (nd.mesh != null) {
      if (MOVING.test(nd.name || '')) moving.push({ name: nd.name, mesh: nd.mesh, m });
      else body.push({ mesh: nd.mesh, m });
    }
    for (const c of nd.children || []) walk(c, m);
  };
  for (const ni of g.scenes[g.scene || 0].nodes) walk(ni, new THREE.Matrix4());
  const entry = { body: bake(g, body), parts: [] };
  tris += entry.body.indices / 3;
  for (const mv of moving) {
    // a moving part keeps its own frame; its pivot is where it sits in the model
    const pivot = new THREE.Vector3().setFromMatrixPosition(mv.m);
    const q = new THREE.Quaternion().setFromRotationMatrix(mv.m);
    const part = bake(g, [{ mesh: mv.mesh, m: new THREE.Matrix4().makeRotationFromQuaternion(q) }]);
    part.pivot = pivot.toArray().map((x) => +x.toFixed(4));
    part.name = mv.name.replace(/_blue$/, '');
    entry.parts.push(part);
    tris += part.indices / 3;
  }
  meta.models[name] = entry;
}
fs.mkdirSync(OUT, { recursive: true });
const bin = Buffer.concat(chunks);
fs.writeFileSync(path.join(OUT, 'kaykit.bin'), bin);
fs.writeFileSync(path.join(OUT, 'kaykit.json'), JSON.stringify(meta));
console.log(`baked ${Object.keys(meta.models).length} models, ${tris} triangles, ${(bin.length / 1024).toFixed(0)} KB`);
