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
// level: extra props per upgrade level. smoke: where chimney smoke rises; hearth: where the Keep's
// fire burns (both local, in metres).
const P = (model, x, z, rot = 0, size = 6) => [model, x, z, rot, size];
export const BUILDING_STYLE = {
  cottage: { model: 'home_A', size: 7.4, rot: 0, smoke: [0, 7.0, -2.6], props: [P('barrel', 2.3, 2.6), P('crate_B_small', 2.8, 2.2, 0.4)],
    level: { 2: { model: 'home_B', size: 6.4, smoke: [0.9, 8.4, -2.7] }, 3: { model: 'home_B', size: 6.4, props: [P('well', -3.4, 1.8, 0, 5)] } } },
  lodge: { model: 'lumbermill', size: 5.6, rot: 0, props: [P('resource_lumber', -3.6, 2.8, 0.3, 4), P('resource_lumber', 3.6, 3.0, -0.2, 4)] },
  mine: { model: 'mine', size: 4.8, rot: 0, props: [P('resource_stone', 3.2, 3.6, 0.5, 4.5), P('wheelbarrow', -3.0, 3.6, 0.8, 5)] },
  canteen: { model: 'tavern', size: 6.6, rot: 0, props: [P('barrel', 3.6, 3.4), P('barrel', 4.1, 2.8), P('crate_A_big', -3.9, 3.2, 0.3)] },
  mill: { model: 'windmill', size: 6.2, rot: 0, props: [P('sack', 2.2, 2.6, 0.2, 7), P('sack', 2.6, 2.1, 1.1, 7), P('wheelbarrow', -2.6, 2.6, 0.5, 5)] },
  smithy: { model: 'blacksmith', size: 5.8, rot: 0, props: [P('barrel', 3.6, 2.8), P('crate_open', -3.8, 2.6, 0.4, 6)] },
  barracks: { model: 'barracks', size: 7.2, rot: 0, props: [P('weaponrack', 4.8, 4.2, 0, 8), P('weaponrack', 5.6, 3.6, 0.6, 8), P('target', -5.0, 4.6, 0.3, 8)] },
  storehouse: { model: 'market', size: 6.2, rot: 0, props: [P('crate_long_A', -3.4, 3.0, 0.2), P('crate_A_big', -2.4, 3.6, 0.5), P('resource_lumber', 4.0, -1.6, 1.4, 4), P('resource_stone', -4.2, -1.8, 0.3, 4.5), P('sack', 2.6, 3.2, 0.3, 7), P('sack', 3.0, 2.8, 1.2, 7), P('barrel', 3.8, 3.2)] },
  well: { model: 'well', size: 3.2, rot: 0, props: [P('bucket_water', 1.5, 0.9, 0.3, 4)] },
  // the Keep: the pack's castle; later levels fly more banners and stack goods by the gate
  keep: { model: 'castle', size: 7.0, squash: 0.55, rot: 0, hearth: [0, 9.2, -4.2], smoke: [0, 9.8, -4.2], props: [P('flag_blue', 5.4, 5.0, 0, 10), P('barrel', -5.2, 5.6, 0, 7), P('crate_A_big', -6.0, 4.8, 0.4, 7)],
    level: { 2: { props: [P('flag_blue', -5.6, -4.8, 0, 11), P('weaponrack', 6.2, 3.2, 0.5, 9)] }, 3: { props: [P('flag_blue', 5.6, -5.0, 0, 12), P('tent', -6.4, -1.4, 0.6, 6)] } } },
  // workshops the pack has no building for: a pack house in their own roof colour, and their goods
  farm: { model: 'home_A', size: 7.0, rot: 0, roof: '#c9a24a', props: [P('sack', 3.0, 2.4, 0.3, 7), P('sack', 3.4, 1.8, 1.1, 7), P('wheelbarrow', -3.2, 3.2, 0.6, 5), P('fence_wood_straight', 4.4, -1.8, 1.57, 4), P('fence_wood_straight', -4.4, -1.8, 1.57, 4)] },
  // the quarry: a broken outcrop, cut blocks stacked for the carriers and the cutters' tent
  quarry: { model: 'rock_single_C', size: 15, rot: 0.4, props: [P('rock_single_A', 2.8, -1.6, 1.2, 13), P('rock_single_B', -2.6, -1.2, 2.1, 12), P('rock_single_D', 0.6, -3.2, 0.6, 10), P('resource_stone', 3.0, 2.6, 0.4, 4.5), P('resource_stone', -2.6, 2.8, 1.0, 4.5), P('wheelbarrow', 0.4, 3.4, 0.8, 5), P('tent', -3.8, -3.6, 0.5, 4)] },
  bakery: { model: 'home_B', size: 6.2, rot: 0, roof: '#a8432c', smoke: [0.9, 8.1, -2.6], props: [P('sack', 2.6, 2.6, 0.2, 7), P('sack', 3.1, 2.1, 1.0, 7), P('barrel', -2.8, 2.6), P('crate_A_small', -3.3, 2.0, 0.3, 6)] },
  hunter: { model: 'archeryrange', size: 5.6, rot: 0, roof: '#55703c', props: [P('bucket_arrows', 2.8, 2.6, 0.3, 6), P('crate_long_B', -3.0, 2.8, 0.4, 6)] },
  fisher: { model: 'home_A', size: 6.2, rot: 0, roof: '#6d5238', props: [P('barrel', 2.6, 2.4), P('barrel', 3.1, 1.8), P('crate_long_A', -3.0, 2.6, 0.3, 6), P('bucket_water', -2.2, 3.2, 0.2, 5), P('ladder', 3.4, -1.6, 1.4, 5)] },
  saltworks: { model: 'home_B', size: 5.8, rot: 0, roof: '#8d9298', smoke: [0.85, 7.6, -2.5], props: [P('sack', 2.4, 2.4, 0.2, 7), P('sack', 2.9, 1.9, 0.9, 7), P('sack', 2.2, 1.6, 1.6, 7), P('bucket_water', -2.4, 2.6, 0, 5), P('crate_open', -3.0, 1.8, 0.5, 6)] },
  tower: { model: 'tower_A', size: 5.2, rot: 0, props: [P('flag_blue', 1.8, 1.9, 0, 8)],
    level: { 2: { model: 'tower_B', size: 5.2 }, 3: { props: [P('weaponrack', -2.2, 2.2, 0.5, 8), P('flag_blue', -1.9, -1.9, 0, 9)] } } },
};

const GENERIC_LEVEL = {
  2: { props: [P('crate_long_A', -3.4, -2.6, 0.3, 6), P('crate_A_big', -2.2, -3.2, 0.2, 6), P('pallet', -3.6, -1.4, 0.1, 6)] },
  3: { props: [P('flag_blue', 2.6, -2.8, 0, 9), P('tent', -3.6, 2.8, 0.4, 5)] },
};

const _c = new THREE.Color();
const cache = new Map();

// the pack's buildings all wear blue roofs, trims and banners: a type can repaint them in its own
// colour (`roof`), keeping the shading, so a Bakery and a Cottage built from the same model differ
const isPackBlue = (r, g, b) => b > r + 25 && b > g + 8;
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;

/** Geometry (structure-material attributes) of one baked part, transformed; roof: sRGB hex or null. */
function partGeometry(assets, part, m, roof = null) {
  const bin = assets.bin;
  const rc = roof ? new THREE.Color(roof) : null;
  const rl = rc ? lum(rc.r * 255, rc.g * 255, rc.b * 255) : 1;
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
    let r = col[i * 4], gg = col[i * 4 + 1], bb = col[i * 4 + 2];
    if (rc && isPackBlue(r, gg, bb)) {
      const k = Math.min(1.6, lum(r, gg, bb) / rl);
      r = Math.min(255, rc.r * 255 * k); gg = Math.min(255, rc.g * 255 * k); bb = Math.min(255, rc.b * 255 * k);
    }
    _c.setRGB(r / 255, gg / 255, bb / 255, THREE.SRGBColorSpace);
    c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b;
    t[i] = col[i * 4 + 3] & 15;
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('pattern', new THREE.BufferAttribute(t, 1));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(idx), 1));
  g.applyMatrix4(m); // in place: p and n are now in the building's space, in metres
  // window panes (flagged by the baker) facing sideways become the night glow, lifted off the wall
  const win = [];
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k], b = idx[k + 1], d = idx[k + 2];
    if (!(col[a * 4 + 3] & 16 && col[b * 4 + 3] & 16 && col[d * 4 + 3] & 16)) continue;
    if (Math.abs(n[a * 3 + 1]) > 0.5) continue;
    for (const i of [a, b, d]) win.push(p[i * 3] + n[i * 3] * 0.04, p[i * 3 + 1] + n[i * 3 + 1] * 0.04, p[i * 3 + 2] + n[i * 3 + 2] * 0.04);
  }
  if (win.length) {
    const w = new THREE.BufferGeometry();
    w.setAttribute('position', new THREE.BufferAttribute(new Float32Array(win), 3));
    w.computeVertexNormals();
    g.userData.windows = w;
  }
  return g;
}

const M = (x, y, z, rot, s, sy = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(s, s * sy, s));

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
  const roof = style.roof || null;
  // squash: a model far taller than its footprint (the pack's castle) is pressed down to fit the town
  const sy = style.squash || 1;
  const body = [partGeometry(assets, entry.body, M(0, 0, 0, style.rot || 0, size, sy), roof)];
  for (const [pm, x, z, r, s] of props) {
    const pe = assets.meta.models[pm];
    if (pe) body.push(partGeometry(assets, pe.body, M(x, 0, z, r, s), roof));
  }
  const moving = entry.parts.map((part) => {
    const pv = new THREE.Vector3(...part.pivot).multiplyScalar(size).setY(part.pivot[1] * size * sy).applyAxisAngle(new THREE.Vector3(0, 1, 0), style.rot || 0);
    return { geometry: partGeometry(assets, part, M(0, 0, 0, style.rot || 0, size, sy), roof), pivot: pv.toArray(), name: part.name };
  });
  const glow = body.map((g) => g.userData.windows).filter(Boolean);
  const out = { body, glow, moving, height: entry.body.max[1] * size * sy };
  cache.set(key, out);
  return out;
}

export function clearKaykitCache() { cache.clear(); }
