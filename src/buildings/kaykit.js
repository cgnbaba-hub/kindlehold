// Modelled buildings from the KayKit Medieval Hexagon Pack (Kay Lousberg, CC0), baked by
// scripts/assets/bake-buildings.mjs into vertex-coloured triangles with a surface pattern per
// palette cell, so they use the same structure material as the procedural buildings (snow,
// wetness, construction clipping, night glow). Each of our building types names a pack model,
// its size and turn (the door faces +Z), and props from the pack around it.
import * as THREE from 'three';

/** Fetch the baked buildings (null when they cannot be loaded: the procedural models stay). */
export async function loadBuildingAssets(base) {
  try {
    const root = base ?? (import.meta.env && import.meta.env.BASE_URL) ?? '/';
    const [meta, bin] = await Promise.all([
      fetch(`${root}buildings/kaykit.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(`${root}buildings/kaykit.bin`).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }),
    ]);
    return { meta, bin };
  } catch {
    return null;
  }
}

// Our buildings dressed with pack models. size: metres per pack unit (a hex tile is ~1.15 wide);
// rot: turn so the door faces +Z; props: [model, x, z, turn, size] in metres around the building.
// level: extra props per upgrade level. lantern: where the night light hangs.
const P = (model, x, z, rot = 0, size = 6) => [model, x, z, rot, size];
export const BUILDING_STYLE = {
  cottage: { model: 'home_A', size: 7.4, rot: 0, smoke: [0, 7.0, -2.6], props: [P('barrel', 2.3, 2.6), P('crate_B_small', 2.8, 2.2, 0.4)],
    level: { 2: { model: 'home_B', size: 6.4, smoke: [0.9, 8.4, -2.7] }, 3: { model: 'home_B', size: 6.4, props: [P('well', -3.4, 1.8, 0, 5)] } } },
  lodge: { model: 'lumbermill', size: 5.6, rot: 0, props: [P('resource_lumber', -3.6, 2.8, 0.3, 4), P('resource_lumber', 3.6, 3.0, -0.2, 4)] },
  quarry: null,
  farm: null,
  mine: { model: 'mine', size: 4.8, rot: 0, props: [P('resource_stone', 3.2, 3.6, 0.5, 4.5), P('wheelbarrow', -3.0, 3.6, 0.8, 5)] },
  canteen: { model: 'tavern', size: 6.6, rot: 0, props: [P('barrel', 3.6, 3.4), P('barrel', 4.1, 2.8), P('crate_A_big', -3.9, 3.2, 0.3)] },
  mill: { model: 'windmill', size: 6.2, rot: 0, props: [P('sack', 2.2, 2.6, 0.2, 7), P('sack', 2.6, 2.1, 1.1, 7), P('wheelbarrow', -2.6, 2.6, 0.5, 5)] },
  smithy: { model: 'blacksmith', size: 5.8, rot: 0, props: [P('barrel', 3.6, 2.8), P('crate_open', -3.8, 2.6, 0.4, 6)] },
  barracks: { model: 'barracks', size: 7.2, rot: 0, props: [P('weaponrack', 4.8, 4.2, 0, 8), P('weaponrack', 5.6, 3.6, 0.6, 8), P('target', -5.0, 4.6, 0.3, 8)] },
  storehouse: { model: 'market', size: 6.2, rot: 0, props: [P('crate_long_A', -3.4, 3.0, 0.2), P('crate_A_big', -2.4, 3.6, 0.5), P('resource_lumber', 4.0, -1.6, 1.4, 4), P('resource_stone', -4.2, -1.8, 0.3, 4.5), P('sack', 2.6, 3.2, 0.3, 7), P('sack', 3.0, 2.8, 1.2, 7), P('barrel', 3.8, 3.2)] },
  tower: { model: 'tower_A', size: 5.2, rot: 0, props: [P('flag_blue', 1.8, 1.9, 0, 8)],
    level: { 2: { model: 'tower_B', size: 5.2 }, 3: { props: [P('weaponrack', -2.2, 2.2, 0.5, 8), P('flag_blue', -1.9, -1.9, 0, 9)] } } },
};

const GENERIC_LEVEL = {
  2: { props: [P('crate_long_A', -3.4, -2.6, 0.3, 6), P('crate_A_big', -2.2, -3.2, 0.2, 6), P('pallet', -3.6, -1.4, 0.1, 6)] },
  3: { props: [P('flag_blue', 2.6, -2.8, 0, 9), P('tent', -3.6, 2.8, 0.4, 5)] },
};

const _c = new THREE.Color();
const cache = new Map();

/** Geometry (structure-material attributes) of one baked part, transformed. */
function partGeometry(assets, part, m) {
  const key = `${part.pos}|${m.elements.join(',')}`;
  const bin = assets.bin;
  const pos = new Float32Array(bin, part.pos, part.vertices * 3);
  const nor = new Int8Array(bin, part.nor, part.vertices * 4);
  const col = new Uint8Array(bin, part.col, part.vertices * 4);
  const idx = new Uint16Array(bin, part.idx, part.indices);
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(part.vertices * 3), n = new Float32Array(part.vertices * 3), c = new Float32Array(part.vertices * 3), t = new Float32Array(part.vertices);
  for (let i = 0; i < part.vertices; i++) {
    p[i * 3] = pos[i * 3]; p[i * 3 + 1] = pos[i * 3 + 1]; p[i * 3 + 2] = pos[i * 3 + 2];
    n[i * 3] = nor[i * 4] / 127; n[i * 3 + 1] = nor[i * 4 + 1] / 127; n[i * 3 + 2] = nor[i * 4 + 2] / 127;
    // the palette is sRGB; the renderer works in linear light
    _c.setRGB(col[i * 4] / 255, col[i * 4 + 1] / 255, col[i * 4 + 2] / 255, THREE.SRGBColorSpace);
    c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b;
    t[i] = col[i * 4 + 3] & 15;
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('pattern', new THREE.BufferAttribute(t, 1));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(idx), 1));
  g.applyMatrix4(m);
  // window panes (flagged by the baker) facing sideways become the night glow, lifted off the wall
  const win = [];
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k], b = idx[k + 1], d = idx[k + 2];
    if (!(col[a * 4 + 3] & 16 && col[b * 4 + 3] & 16 && col[d * 4 + 3] & 16)) continue;
    if (Math.abs(n[a * 3 + 1]) > 0.5) continue;
    for (const i of [a, b, d]) win.push(p[i * 3] + n[i * 3] * 0.012, p[i * 3 + 1] + n[i * 3 + 1] * 0.012, p[i * 3 + 2] + n[i * 3 + 2] * 0.012);
  }
  if (win.length) {
    const w = new THREE.BufferGeometry();
    w.setAttribute('position', new THREE.BufferAttribute(new Float32Array(win), 3));
    w.computeVertexNormals();
    w.applyMatrix4(m);
    g.userData.windows = w;
  }
  void key;
  return g;
}

const M = (x, y, z, rot, s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(s, s, s));

/**
 * The modelled version of a building at a level, or null when the type has no model (then the
 * procedural one is used). Returns { body: BufferGeometry[], height, moving: [{ geometry, pivot }] }.
 */
export function kaykitModel(assets, type, level = 1) {
  const style = assets && BUILDING_STYLE[type];
  if (!style) return null;
  const key = `${type}:${level}`;
  if (cache.has(key)) return cache.get(key);
  let model = style.model, size = style.size;
  const props = [...(style.props || [])];
  for (let l = 2; l <= level; l++) {
    // workshops without their own upgrade look gain a store of goods, then a guild flag
    const up = (style.level && style.level[l]) || GENERIC_LEVEL[l];
    if (!up) continue;
    if (up.model) { model = up.model; size = up.size || size; }
    props.push(...(up.props || []));
  }
  const entry = assets.meta.models[model];
  if (!entry) return null;
  const body = [partGeometry(assets, entry.body, M(0, 0, 0, style.rot || 0, size))];
  for (const [pm, x, z, r, s] of props) {
    const pe = assets.meta.models[pm];
    if (pe) body.push(partGeometry(assets, pe.body, M(x, 0, z, r, s)));
  }
  const moving = entry.parts.map((part) => {
    const pv = new THREE.Vector3(...part.pivot).multiplyScalar(size).applyAxisAngle(new THREE.Vector3(0, 1, 0), style.rot || 0);
    return { geometry: partGeometry(assets, part, M(0, 0, 0, style.rot || 0, size)), pivot: pv.toArray(), name: part.name };
  });
  const glow = body.map((g) => g.userData.windows).filter(Boolean);
  const out = { body, glow, moving, height: entry.body.max[1] * size };
  cache.set(key, out);
  return out;
}

export function clearKaykitCache() { cache.clear(); }
