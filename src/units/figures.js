// Segmented, instanced character figures with procedural pose animation.
// Settlers, soldiers, the hero and enemies share part meshes; one InstancedMesh per
// part kind keeps draw calls low. Authoritative state is read from the world only.
import * as THREE from 'three';
import { createStructureMaterial, PATTERN as P } from '../render/structure-material.js';
import { paint, paintGradient, place, merge, box, cyl, cone, sphere, ico } from '../render/geometry-kit.js';
import { flushInstances } from '../render/instancing.js';
import { computePose, lerpPose, neutralPose, weaponClass } from './poses.js';

function g(parts) { return merge(parts); }
/** A thin cloth shell visible from both sides: the shell plus a slightly smaller, flipped copy. */
function twoSided(geo) {
  const outer = geo.index ? geo.toNonIndexed() : geo;
  const inner = outer.clone();
  inner.scale(0.97, 1, 0.97);
  const pos = inner.attributes.position, nor = inner.attributes.normal, col = inner.attributes.color, pat = inner.attributes.pattern;
  for (let i = 0; i < pos.count; i += 3) for (const a of [pos, nor, col, pat]) {
    const n = a.itemSize;
    for (let c = 0; c < n; c++) { const t = a.array[(i + 1) * n + c]; a.array[(i + 1) * n + c] = a.array[(i + 2) * n + c]; a.array[(i + 2) * n + c] = t; }
  }
  for (let i = 0; i < nor.array.length; i++) nor.array[i] = -nor.array[i];
  for (let i = 0; i < col.array.length; i++) col.array[i] *= 0.8; // the lining is a shade darker
  return merge([outer, inner]);
}
const B = (w, h, d, c, pat, at) => paint(place(box(w, h, d), at), c, 0, null, pat);
/** Turn an item end for end (pole-type items are modelled pointing down; they are held pointing up). */
const flip = (geo) => place(geo, { rz: Math.PI });
/** A lathed body: profile [radius, y] pairs, flattened front to back like a real chest. */
function body(profile, seg, depth, bottom, top, pattern) {
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  return paintGradient(place(geo, { sz: depth }), bottom, top, pattern);
}

/** Part geometries (local to their pivot). Colours here are multiplied by instance colour. */
export function buildParts() {
  return {
    // jointed limbs: thigh (hip pivot) + shin with boot (knee pivot), upper arm + forearm with hand
    thigh: g([paint(place(cyl(0.09, 0.078, 0.47, 7), { y: -0.235 }), '#ffffff', 0, null, P.cloth), paint(place(sphere(0.078, 5, 3), { y: -0.46 }), '#f2f2f2', 0, null, P.cloth)]),
    shin: g([paint(place(cyl(0.076, 0.066, 0.3, 7), { y: -0.15 }), '#b8b0a6', 0, null, P.cloth), paint(place(cyl(0.084, 0.078, 0.16, 7), { y: -0.33 }), '#5a4030', 0, null, P.plain), paint(place(sphere(0.085, 6, 4), { y: -0.42, z: 0.05, sy: 0.62, sz: 1.65 }), '#4a3526', 0, null, P.plain)]),
    torso: g([
      // hem flaring over the hips, a narrower waist, a broad chest, rounded shoulders
      body([[0.27, -0.13], [0.255, 0.0], [0.222, 0.14], [0.218, 0.26], [0.246, 0.42], [0.25, 0.52], [0.2, 0.61], [0.1, 0.665], [0.06, 0.68]], 10, 0.8, '#dedede', '#ffffff', P.cloth),
      paint(place(cyl(0.232, 0.232, 0.07, 10), { y: 0.13, sz: 0.82 }), '#5a4030', 0, null, P.plain),
      B(0.07, 0.07, 0.03, '#b09050', P.metal, { y: 0.13, z: 0.19 }),
      paint(place(sphere(0.105, 7, 4), { x: 0.24, y: 0.555 }), '#f4f4f4', 0, null, P.cloth),
      paint(place(sphere(0.105, 7, 4), { x: -0.24, y: 0.555 }), '#f4f4f4', 0, null, P.cloth),
      paint(place(cyl(0.068, 0.078, 0.12, 7), { y: 0.68 }), '#e2b894', 0, null, P.plain),
    ]),
    coat: g([
      paintGradient(place(cyl(0.2, 0.36, 1.05, 10), { y: 0.0, sz: 0.86 }), '#dedede', '#ffffff', P.cloth),
      B(0.46, 0.07, 0.36, '#5a4030', P.plain, { y: 0.1 }),
    ]),
    // a slightly large, friendly head with a readable face (eyes, brows, nose, mouth, ears)
    head: g([
      paint(place(sphere(0.17, 10, 7), { y: 0.17 }), '#e2b894', 0, null, P.plain),
      // dark eyes (whites read as goggles at this size)
      paint(place(sphere(0.022, 5, 4), { x: 0.058, y: 0.19, z: 0.158, sy: 1.3, sz: 0.6 }), '#1e1712', 0, null, P.plain),
      paint(place(sphere(0.022, 5, 4), { x: -0.058, y: 0.19, z: 0.158, sy: 1.3, sz: 0.6 }), '#1e1712', 0, null, P.plain),
      B(0.06, 0.016, 0.02, '#5a3f2a', P.plain, { x: 0.06, y: 0.235, z: 0.158, rz: 0.12 }),
      B(0.06, 0.016, 0.02, '#5a3f2a', P.plain, { x: -0.06, y: 0.235, z: 0.158, rz: -0.12 }),
      paint(place(cone(0.028, 0.07, 4), { y: 0.15, z: 0.18, rx: Math.PI / 2 }), '#d4a884', 0, null, P.plain),
      B(0.06, 0.014, 0.02, '#9a5a48', P.plain, { y: 0.095, z: 0.158 }),
      B(0.04, 0.07, 0.05, '#d4a884', P.plain, { x: 0.168, y: 0.17 }),
      B(0.04, 0.07, 0.05, '#d4a884', P.plain, { x: -0.168, y: 0.17 }),
    ]),
    // hair and beard take their colour from the instance (varied per settler)
    hair: g([paint(place(sphere(0.176, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.46), { y: 0.18, z: -0.012 }), '#ffffff', 0, null, P.cloth), paint(place(sphere(0.12, 6, 4), { y: 0.14, z: -0.09, sy: 1.1 }), '#ffffff', 0, null, P.cloth)]),
    hairLong: g([paint(place(sphere(0.176, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), { y: 0.18, z: -0.012 }), '#ffffff', 0, null, P.cloth), paint(place(cyl(0.16, 0.19, 0.34, 8, 1, true, Math.PI * 0.55, Math.PI * 0.9), { y: 0.05, z: -0.01 }), '#f2f2f2', 0, null, P.cloth)]),
    hairBun: g([paint(place(sphere(0.176, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.46), { y: 0.18, z: -0.012 }), '#ffffff', 0, null, P.cloth), paint(place(sphere(0.078, 6, 4), { y: 0.31, z: -0.12 }), '#f2f2f2', 0, null, P.cloth)]),
    hairBraids: g([paint(place(sphere(0.176, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.46), { y: 0.18, z: -0.012 }), '#ffffff', 0, null, P.cloth), paint(place(cyl(0.035, 0.028, 0.34, 5), { x: 0.13, y: 0.0, z: -0.06, rz: 0.12 }), '#f2f2f2', 0, null, P.cloth), paint(place(cyl(0.035, 0.028, 0.34, 5), { x: -0.13, y: 0.0, z: -0.06, rz: -0.12 }), '#f2f2f2', 0, null, P.cloth)]),
    beard: g([paint(place(sphere(0.1, 6, 4), { y: 0.07, z: 0.1, sy: 1.15, sx: 1.25 }), '#ffffff', 0, null, P.cloth)]),
    skirt: g([paintGradient(place(cyl(0.24, 0.34, 0.5, 10), { y: -0.2 }), '#e6e6e6', '#ffffff', P.cloth)]),
    // open at the front so the face shows (the face itself sits inside)
    hood: g([paintGradient(place(cone(0.2, 0.36, 9), { y: 0.36, z: -0.06, rx: -0.3 }), '#cfcfcf', '#ffffff', P.cloth), paint(place(sphere(0.205, 12, 6, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6), { y: 0.17, z: -0.03 }), '#ffffff', 0, null, P.cloth), paint(place(cyl(0.2, 0.23, 0.1, 10, 1, true), { y: -0.0, z: -0.02 }), '#e8e8e8', 0, null, P.cloth)]),
    cap: g([paint(place(sphere(0.15, 10, 5), { y: 0.2, sy: 0.6 }), '#ffffff', 0, null, P.cloth)]),
    // helmets sit over the head sphere (radius 0.17) so no skin shows through
    helm: g([paint(place(sphere(0.192, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.42), { y: 0.2 }), '#b9bcc0', 0, null, P.metal), B(0.035, 0.12, 0.035, '#9a9da2', P.metal, { y: 0.2, z: 0.178 }), paint(place(cyl(0.197, 0.197, 0.035, 12), { y: 0.25 }), '#8f9296', 0, null, P.metal)]),
    hornhelm: g([paint(place(sphere(0.195, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.45), { y: 0.2 }), '#6a625a', 0, null, P.metal), paint(place(cone(0.05, 0.36, 6), { x: 0.2, y: 0.36, rz: -0.7 }), '#d8ccb0', 0, null, P.plain), paint(place(cone(0.05, 0.36, 6), { x: -0.2, y: 0.36, rz: 0.7 }), '#d8ccb0', 0, null, P.plain)]),
    arm: g([paint(place(cyl(0.068, 0.062, 0.31, 7), { y: -0.155 }), '#ffffff', 0, null, P.cloth), paint(place(sphere(0.062, 5, 3), { y: -0.3 }), '#f2f2f2', 0, null, P.cloth)]),
    forearm: g([paint(place(cyl(0.06, 0.05, 0.25, 7), { y: -0.125 }), '#ffffff', 0, null, P.cloth), paint(place(cyl(0.058, 0.062, 0.04, 7), { y: -0.235 }), '#d8d8d8', 0, null, P.cloth)]),
    hand: g([paint(place(sphere(0.056, 6, 4), { y: -0.3, sx: 0.85, sy: 1.15, sz: 0.72 }), '#ffffff', 0, null, P.plain), paint(place(sphere(0.022, 4, 3), { y: -0.275, z: 0.04, sy: 1.6 }), '#f0f0f0', 0, null, P.plain)]),
    // right-hand items: pivot at the hand, pointing along -Y when the arm hangs
    axe: g([paint(place(cyl(0.025, 0.03, 0.8, 5), { y: -0.2 }), '#6b4a2f', 0, null, P.planks), B(0.05, 0.16, 0.2, '#9fa3a8', P.metal, { y: -0.52, z: 0.09 })]),
    pick: g([paint(place(cyl(0.025, 0.03, 0.8, 5), { y: -0.2 }), '#6b4a2f', 0, null, P.planks), B(0.05, 0.06, 0.5, '#8c8f93', P.metal, { y: -0.58 })]),
    hammer: g([paint(place(cyl(0.022, 0.025, 0.5, 5), { y: -0.1 }), '#6b4a2f', 0, null, P.planks), B(0.1, 0.1, 0.18, '#7d7f82', P.metal, { y: -0.36 })]),
    sickle: g([paint(place(cyl(0.022, 0.025, 0.3, 5), { y: 0 }), '#6b4a2f', 0, null, P.planks), paint(place(new THREE.TorusGeometry(0.14, 0.015, 4, 10, Math.PI), { y: -0.18, z: 0.1, ry: Math.PI / 2 }), '#a6a9ad', 0, null, P.metal)]),
    sword: g([B(0.05, 0.75, 0.018, '#c9ccd0', P.metal, { y: -0.48 }), B(0.2, 0.035, 0.05, '#6b5a3a', P.metal, { y: -0.1 }), paint(place(cyl(0.02, 0.02, 0.12, 5), { y: -0.02 }), '#4a3526', 0, null, P.plain)]),
    spear: flip(g([paint(place(cyl(0.022, 0.025, 2.0, 5), { y: -0.3 }), '#6b4a2f', 0, null, P.planks), paint(place(cone(0.05, 0.24, 4), { y: -1.42, rx: Math.PI }), '#c2c5c9', 0, null, P.metal)])),
    // a longbow gripped at the middle of its stave: the stave runs along Z, the string sits +Y of the grip
    bow: g([place(paint(place(new THREE.TorusGeometry(0.9, 0.02, 4, 14, Math.PI * 0.45), { y: 0.9, rz: -Math.PI * 0.725 }), '#6b4a2f', 0, null, P.planks), { ry: -Math.PI / 2 }), paint(place(cyl(0.004, 0.004, 1.17, 3), { y: 0.216, rx: Math.PI / 2 }), '#e8e0cc', 0, null, P.plain), paint(place(cyl(0.03, 0.03, 0.12, 6), { rx: Math.PI / 2 }), '#3a2a1e', 0, null, P.plain)]),
    rake: g([paint(place(cyl(0.022, 0.025, 1.6, 5), { y: -0.5 }), '#8a6a44', 0, null, P.planks), B(0.5, 0.05, 0.06, '#6b4a2f', P.planks, { y: -1.3 })]),
    rod: flip(g([paint(place(cyl(0.012, 0.022, 2.2, 4), { y: -0.6 }), '#8a6a44', 0, null, P.planks), paint(place(cyl(0.003, 0.003, 1.3, 3), { y: -1.6, z: 0.35, rx: -0.5 }), '#e8e0cc', 0, null, P.plain)])),
    pole: g([paint(place(cyl(0.03, 0.035, 2.3, 6), { y: -0.55 }), '#3e2c1f', 0, null, P.planks), paint(place(cyl(0.016, 0.016, 0.3, 4), { y: 0.72, z: 0.12, rx: 0.9 }), '#2f2f31', 0, null, P.metal)]),
    crossbow: flip(g([B(0.07, 0.7, 0.09, '#6b4a2f', P.planks, { y: -0.3 }), B(0.62, 0.05, 0.05, '#4a4a4c', P.metal, { y: -0.6 }), paint(place(cyl(0.004, 0.004, 0.6, 3), { y: -0.55, rz: Math.PI / 2 }), '#e8e0cc', 0, null, P.plain)])),
    halberd: flip(g([paint(place(cyl(0.024, 0.027, 2.3, 5), { y: -0.45 }), '#5a4030', 0, null, P.planks), B(0.05, 0.3, 0.26, '#b9bcc0', P.metal, { y: -1.45, z: 0.1 }), paint(place(cone(0.045, 0.3, 4), { y: -1.72, rx: Math.PI }), '#c2c5c9', 0, null, P.metal)])),
    greataxe: g([paint(place(cyl(0.035, 0.04, 1.3, 6), { y: -0.4 }), '#3e2c1f', 0, null, P.planks), B(0.06, 0.4, 0.46, '#7a716a', P.metal, { y: -0.98, z: 0.2 })]),
    maul: g([paint(place(cyl(0.03, 0.035, 1.0, 6), { y: -0.3 }), '#5a4030', 0, null, P.planks), B(0.22, 0.2, 0.34, '#6a6c70', P.metal, { y: -0.82 }), B(0.24, 0.05, 0.36, '#4a4c50', P.metal, { y: -0.82 })]),
    sling: g([paint(place(cyl(0.008, 0.008, 0.6, 3), { y: -0.3 }), '#8a7050', 0, null, P.plain), paint(place(sphere(0.05, 6, 4), { y: -0.6 }), '#6a625a', 0, null, P.plain)]),
    // left-hand items
    shieldRound: g([paint(place(cyl(0.34, 0.34, 0.05, 12), { rx: Math.PI / 2, y: -0.2, z: 0.06 }), '#ffffff', 0, null, P.planks), paint(place(sphere(0.07, 6, 4), { y: -0.2, z: 0.1 }), '#b0a070', 0, null, P.metal)]),
    shieldKite: g([paint(place(box(0.5, 0.8, 0.05), { y: -0.25, z: 0.07 }), '#ffffff', 0, null, P.planks), B(0.52, 0.06, 0.06, '#d1a54a', P.metal, { y: 0.14, z: 0.08 }), B(0.06, 0.7, 0.06, '#d1a54a', P.metal, { y: -0.25, z: 0.1 })]),
    shieldHide: g([paint(place(cyl(0.4, 0.4, 0.06, 7), { rx: Math.PI / 2, y: -0.2, z: 0.06 }), '#ffffff', 0, null, P.cloth)]),
    lantern: g([paint(place(cyl(0.12, 0.14, 0.26, 6), { y: 0.0 }), '#2f2f31', 0, null, P.metal), paint(place(cone(0.13, 0.12, 6), { y: 0.19 }), '#2f2f31', 0, null, P.metal)]),
    // cloaks: a two-sided shell hanging from the shoulders (heroes and commanders)
    cape: twoSided(paintGradient(place(new THREE.CylinderGeometry(0.27, 0.44, 1.02, 9, 3, true, Math.PI * 0.62, Math.PI * 0.76), { y: -0.51 }), '#c8c8c8', '#ffffff', P.cloth)),
    // metal shoulder guards (in the upper-arm frame) and a cloth tabard over the belt
    pauldron: g([paint(place(sphere(0.125, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.5), { y: 0.02, sx: 1.15, sz: 1.1 }), '#c4c7cb', 0, null, P.metal), paint(place(cyl(0.13, 0.14, 0.03, 8), { y: -0.01 }), '#8f9296', 0, null, P.metal)]),
    // tabard: front and back panels curving round the body, a device on the chest
    tabard: g([paint(place(cyl(0.208, 0.262, 0.52, 5, 1, true, -0.6, 1.2), { y: 0.02, sz: 0.84 }), '#ffffff', 0, null, P.cloth), paint(place(cyl(0.208, 0.262, 0.52, 5, 1, true, Math.PI - 0.6, 1.2), { y: 0.02, sz: 0.84 }), '#f2f2f2', 0, null, P.cloth), B(0.1, 0.1, 0.02, '#d8d8d8', P.cloth, { y: 0.15, z: 0.186, rz: Math.PI / 4, rx: -0.1 })]),
    strawhat: g([paint(place(cyl(0.3, 0.32, 0.025, 12), { y: 0.25 }), '#d9c07a', 0, null, P.cloth), paint(place(cyl(0.13, 0.16, 0.13, 10), { y: 0.32 }), '#cdb46c', 0, null, P.cloth), paint(place(cyl(0.162, 0.162, 0.03, 10), { y: 0.275 }), '#8a4a3a', 0, null, P.cloth)]),
    apron: g([paint(place(cyl(0.2, 0.25, 0.6, 5, 1, true, -0.55, 1.1), { y: -0.14, sz: 0.84 }), '#ece6d6', 0, null, P.cloth), paint(place(cyl(0.2, 0.2, 0.2, 5, 1, true, -0.4, 0.8), { y: 0.3, sz: 0.84 }), '#ece6d6', 0, null, P.cloth)]),
    // a thin gold circlet for nobility
    circlet: g([paint(place(new THREE.TorusGeometry(0.17, 0.022, 5, 16), { y: 0.26, rx: Math.PI / 2 - 0.12 }), '#e3c26b', 0, null, P.metal), paint(place(new THREE.OctahedronGeometry(0.04, 0), { y: 0.29, z: 0.17 }), '#c03040', 0, null, P.metal)]),
    // rank insignia floating over veterans (one) and elite soldiers (two)
    star: g([paint(new THREE.OctahedronGeometry(0.11, 0), '#f0c858', 0, null, P.metal)]),
    // carried goods (on the shoulder)
    log: g([paint(place(cyl(0.12, 0.12, 1.1, 7), { rz: Math.PI / 2 }), '#6e5037', 0, null, P.planks)]),
    stone: g([paint(place(ico(0.2, 0), {}), '#8c8a82', 0, null, P.rock)]),
    sack: g([paint(place(sphere(0.22, 8, 6), { sy: 1.2 }), '#c2a878', 0, null, P.cloth)]),
    ingot: g([B(0.34, 0.12, 0.2, '#6f7176', P.metal, {}), B(0.34, 0.12, 0.2, '#6f7176', P.metal, { y: 0.12, x: 0.05 })]),
  };
}

const TOOL = { forester: 'axe', quarrier: 'pick', miner: 'pick', farmer: 'sickle', hunter: 'spear', fisher: 'rod', salter: 'rake', cook: null };
const CARRY = { timber: 'log', stone: 'stone', provisions: 'sack', iron: 'ingot' };
const SETTLER_TUNICS = ['#8a6f4e', '#6f7b5a', '#9b7c52', '#5f6f7a', '#7a5f4e', '#8e8a6a', '#8a4e4a', '#4e6a7a'];
const HAIR = ['#4a3222', '#2a1e16', '#b8914e', '#8a4a24', '#6a5a4a', '#c8c0b0', '#3a2a1e'];
const HAIR_LONG = ['hairLong', 'hairBun', 'hairBraids'];
// skin tones (the head is modelled in the first one and tinted to the others)
const SKIN = ['#e2b894', '#f0c8a4', '#d19a72', '#b57c55', '#8d5a3b', '#e8bf9a', '#c48a60'];
const LEGS = ['#5b4b3c', '#4a4a3e', '#6a5a44', '#3e4652'];
const MAIL = '#8d9096', GLOVE = '#5a4030';
const NO_OUTLINE = new Set(['hand', 'star']);
const POLE_ITEMS = new Set(['spear', 'pole', 'halberd']);
const BLADES = new Set(['axe', 'pick', 'hammer', 'sword', 'greataxe', 'maul', 'sickle']);

export const STYLE = {
  settler: { torso: null, head: 'cap', skin: '#e2b894', legs: '#5b4b3c' },
  shield: { torso: '#2f6f8f', head: 'helm', right: 'spear', left: 'shieldKite', leftColor: '#2f6f8f', legs: '#4d4338', pauldrons: true, tabard: '#e3d6b0' },
  blade: { torso: '#5d93ab', coat: true, head: 'helm', right: 'sword', left: null, legs: '#4d4338', pauldrons: true },
  fletcher: { torso: '#4f6f4a', head: 'hood', headColor: '#3f5a3c', right: null, left: 'bow', legs: '#4d4338' },
  crossbow: { torso: '#3f5a6a', coat: true, head: 'helm', right: 'crossbow', left: null, legs: '#4d4338', tabard: '#e3d6b0' },
  halberd: { torso: '#2a5a7a', coat: true, head: 'helm', right: 'halberd', left: null, legs: '#3a3a3c', pauldrons: true, tabard: '#d1a54a' },
  wren: { torso: '#5a6a3e', coat: true, head: 'hood', headColor: '#4a5a32', right: null, left: 'bow', legs: '#3a3028', cape: '#6a5a3a', hairColor: '#a8622e', scale: 1.1 },
  maren: { torso: '#384a5c', coat: true, head: 'hood', headColor: '#2c3a48', right: 'pole', left: null, legs: '#3a3028', lantern: true, cape: '#24505e' },
  reaver: { torso: '#8c3b2a', head: 'cap', headColor: '#3a302a', right: 'axe', left: null, legs: '#3a302a', beard: true, beardColor: '#6a2e18' },
  slinger: { torso: '#7a5a3e', head: 'hood', headColor: '#5b2a20', right: 'sling', left: null, legs: '#3a302a' },
  brute: { torso: '#5b2a20', head: 'hornhelm', right: 'spear', left: 'shieldHide', leftColor: '#7a5a3e', legs: '#3a302a', pauldrons: '#7a5a3e' },
  varrspear: { torso: '#8a1c2c', head: 'helm', right: 'spear', left: 'shieldKite', leftColor: '#8a1c2c', legs: '#3a3a3c', pauldrons: true, tabard: '#d8d0c0' },
  varrbow: { torso: '#6a2430', coat: true, head: 'helm', right: 'crossbow', left: null, legs: '#3a3a3c', tabard: '#d8d0c0' },
  varrknight: { torso: '#5a5e66', coat: true, head: 'helm', right: 'sword', left: 'shieldKite', leftColor: '#8a1c2c', legs: '#2e3036', pauldrons: true, tabard: '#8a1c2c', scale: 1.06 },
  ysolde: { torso: '#3a3e46', coat: true, head: 'circlet', hairColor: '#c8a060', right: 'sword', left: 'shieldKite', leftColor: '#8a1c2c', legs: '#2a2a30', pauldrons: true, cape: '#8a1c2c', scale: 1.2 },
  brigand: { torso: '#5a6a44', head: 'hood', headColor: '#3e4a30', right: 'axe', left: 'shieldRound', leftColor: '#6e5037', legs: '#3a3428', beard: true, beardColor: '#5a4030' },
  poacher: { torso: '#4a5638', head: 'hood', headColor: '#6a5a3a', right: null, left: 'bow', legs: '#3a3428' },
  morwen: { torso: '#3e4a30', coat: true, head: 'hood', headColor: '#2e3a24', right: null, left: 'bow', legs: '#2a2a20', scale: 1.15, cape: '#44582e' },
  sapper: { torso: '#6e5a40', coat: true, head: 'cap', headColor: '#4a3a2a', right: 'maul', left: null, legs: '#4d4338', tabard: '#2f6f8f', beard: true, beardColor: '#5a4030' },
  staghalberd: { torso: '#2e5a3a', head: 'helm', right: 'halberd', left: null, legs: '#3a3a30', pauldrons: true, tabard: '#e8e4d8' },
  stagarcher: { torso: '#3a5a3a', head: 'hood', headColor: '#2a4a30', right: null, left: 'bow', legs: '#3a3a30', tabard: '#e8e4d8' },
  stagwarden: { torso: '#4a6a52', coat: true, head: 'helm', right: 'sword', left: 'shieldKite', leftColor: '#e8e4d8', legs: '#2e3a30', pauldrons: '#6a8a70', tabard: '#e8e4d8', scale: 1.06 },
  vane: { torso: '#2e3a30', coat: true, head: 'helm', right: 'sword', left: 'shieldKite', leftColor: '#e8e4d8', legs: '#24282a', pauldrons: '#c8ccd0', tabard: '#2e5a3a', cape: '#e8e4d8', scale: 1.22, beard: true, beardColor: '#9a9088' },
  ironguard: { torso: '#34343a', head: 'helm', right: 'spear', left: 'shieldKite', leftColor: '#2a2a30', legs: '#26262a', pauldrons: '#4a4a52', tabard: '#d0a030', scale: 1.05 },
  arbalest: { torso: '#4a4038', coat: true, head: 'helm', right: 'crossbow', left: null, legs: '#2a2a2e', tabard: '#2e2e34' },
  delver: { torso: '#5a4a36', head: 'cap', headColor: '#2e2e34', right: 'pick', left: null, legs: '#3a3028', beard: true, beardColor: '#3a2a1e', tabard: '#d0a030' },
  ismay: { torso: '#2e2e34', coat: true, head: 'circlet', hairColor: '#1e1a18', right: 'sword', left: 'shieldKite', leftColor: '#2a2a30', legs: '#1e1e22', pauldrons: '#d0a030', cape: '#2e2e34', tabard: '#d0a030', scale: 1.2 },
  vharek: { torso: '#3a302a', coat: true, head: 'hornhelm', right: 'greataxe', left: null, legs: '#2a2420', scale: 1.28, beard: true, beardColor: '#8c3b1f', cape: '#6e2a1c', pauldrons: '#6a625a' },
};

export function createFigureRenderer({ scene, maxFigures = 420 }) {
  const parts = buildParts();
  const mat = createStructureMaterial({ roughness: 0.85 }, 'kh-structure');
  const glowMat = new THREE.MeshStandardMaterial({ color: '#40301a', emissive: '#ffbe62', emissiveIntensity: 2.2 });
  const meshes = {};
  const outlines = {};
  const outlineMat = new THREE.MeshBasicMaterial({ color: '#16120e', side: THREE.BackSide });
  outlineMat.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = uOutline;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uOutline;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uOutline;');
  };
  outlineMat.customProgramCacheKey = () => 'kh-figure-outline';
  const uOutline = { value: 0.03 };
  const caps = { thigh: 2, shin: 2, arm: 2, forearm: 2, hand: 2 };
  for (const k in parts) {
    const n = maxFigures * (caps[k] || 1);
    const m = new THREE.InstancedMesh(parts[k], k === 'lantern' ? mat : mat, n);
    m.count = 0; m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m);
    meshes[k] = m;
    // inverted-hull outline sharing the same instance matrices: crisp silhouettes at RTS zoom
    // (not for hands and insignia: an outline would only blot them)
    if (NO_OUTLINE.has(k)) continue;
    const o = new THREE.InstancedMesh(parts[k], outlineMat, n);
    o.instanceMatrix = m.instanceMatrix;
    o.count = 0; o.frustumCulled = false; o.castShadow = false;
    scene.add(o);
    outlines[k] = o;
  }
  // glowing lantern cores (hero)
  const glowGeo = new THREE.SphereGeometry(0.075, 8, 6);
  const glow = new THREE.InstancedMesh(glowGeo, glowMat, 8);
  glow.count = 0; glow.frustumCulled = false;
  scene.add(glow);

  const counts = {};
  const root = new THREE.Matrix4(), tmp = new THREE.Matrix4(), out = new THREE.Matrix4();
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  const torsoFrame = new THREE.Matrix4(), armLM = new THREE.Matrix4(), armRM = new THREE.Matrix4(), scl = new THREE.Vector3();
  const foreLM = new THREE.Matrix4(), foreRM = new THREE.Matrix4(), headM = new THREE.Matrix4(), tmp2 = new THREE.Matrix4();

  function begin() { for (const k in meshes) counts[k] = 0; glow.count = 0; }

  function put(kind, matrix, color) {
    const m = meshes[kind];
    const i = counts[kind]++;
    if (i >= m.instanceMatrix.count) return;
    m.setMatrixAt(i, matrix);
    if (color && color.isColor) m.setColorAt(i, color);
    else if (color) { col.set(color); m.setColorAt(i, col); }
    else { col.setRGB(1, 1, 1); m.setColorAt(i, col); }
  }

  /** local transform: translate(px,py,pz) * rotX(ax) * rotZ(az) * rotY(ay) */
  function local(px, py, pz, ax, ay = 0, az = 0) {
    q.setFromEuler(e.set(ax, ay, az, 'YXZ'));
    return tmp.compose(v.set(px, py, pz), q, one);
  }

  const P = neutralPose(), Pb = neutralPose();
  const colCache = new Map();
  /** A colour, darkened (k < 1) or tinted relative to the base skin (cached). */
  function shade(hex, k) {
    const key = hex + k;
    let c = colCache.get(key);
    if (!c) { c = new THREE.Color(hex).multiplyScalar(k); colCache.set(key, c); }
    return c;
  }
  const SKIN_BASE = new THREE.Color('#e2b894');
  const skinTints = SKIN.map((hex) => { const c = new THREE.Color(hex); return new THREE.Color(c.r / SKIN_BASE.r, c.g / SKIN_BASE.g, c.b / SKIN_BASE.b); });

  /**
   * Draw one figure.
   * @param {object} f  { x, y, z, heading, scale, style, tunic, anim, t, tool, carry, fallen, kneel, lean,
   *   walkPh (stride phase), blendFrom / blendW (cross-fade from the previous animation), attack }
   */
  function draw(f) {
    const st = STYLE[f.style] || STYLE.settler;
    const settler = f.style === 'settler';
    const ph = f.phase || 0;
    // everyday folk and rank-and-file differ a little in height and build
    const vary = !st.cape && !st.scale;
    const bw = vary ? 0.93 + ((ph * 7) % 5) * 0.035 : 1, bh = vary ? 0.95 + ((ph * 3) % 5) * 0.025 : 1;
    const sc = (st.scale || 1) * (f.scale || 1);
    const t = f.t;
    f.pole = POLE_ITEMS.has(f.tool || st.right) || f.tool === 'rod'; // carried upright when not in use
    f.weapon = st.weapon || weaponClass(st.right, st.left);
    computePose(f.anim, f, P);
    if (f.blendFrom && f.blendW < 1) {
      computePose(f.blendFrom, f, Pb);
      const w = f.blendW * f.blendW * (3 - 2 * f.blendW);
      lerpPose(Pb, P, w, P);
    }
    // dying: the knees give way first, then the body tips over backwards (a little to one side)
    const fall = f.fallen || 0;
    const buckle = Math.min(1, fall / 0.3), tip = fall > 0.2 ? Math.min(1, (fall - 0.2) / 0.8) ** 2 : 0;
    if (fall) {
      P.kneeL = 0.2 + 1.1 * buckle * (1 - tip) + 0.3 * tip; P.kneeR = 0.2 + 0.9 * buckle * (1 - tip) + 0.1 * tip;
      P.hipR = P.hipL = -0.5 * buckle * (1 - tip); P.legA = 0.1 * tip; P.lean = 0.35 * buckle * (1 - tip);
      P.armLz = -0.3 - 0.6 * tip; P.armRz = 0.3 + 0.6 * tip; P.armL = P.armR = -0.5 * buckle * (1 - tip) - 0.3 * tip;
      P.elbowL = P.elbowR = -0.4; P.nod = 0.3 * buckle * (1 - tip) - 0.25 * tip; P.twist = 0; P.headYaw = 0.4 * tip * (ph % 2 ? 1 : -1);
    }
    q.setFromEuler(e.set(fall ? -Math.PI / 2 * tip : 0, f.heading, fall ? (ph % 2 ? 0.25 : -0.25) * tip : 0, 'YXZ'));
    root.compose(v.set(f.x, f.y + P.bob * sc - (f.kneel ? 0.45 * sc : 0) - (fall ? (0.4 * buckle * (1 - tip) - 0.17 * tip) * sc : 0), f.z), q, scl.set(sc * bw, sc * bh, sc * bw));
    const tunic = f.tunic || st.torso || '#8a6f4e';
    const skinI = st.skinTone !== undefined ? st.skinTone : (ph * 5 + 1) % SKIN.length;
    const skin = SKIN[skinI];
    // legs: thigh at the hip, shin at the knee
    const hip = f.kneel ? [-1.2, 0.2] : [P.legA + P.hipR, -P.legA + P.hipL];
    const knee = f.kneel ? [1.5, 0.3] : [P.kneeR, P.kneeL];
    const legs = settler && ph % 3 === 2 ? LEGS[ph % LEGS.length] : st.legs;
    [0.1, -0.1].forEach((hx, i) => {
      out.multiplyMatrices(root, local(hx, 0.9, 0, hip[i], 0, i ? -P.sway * 0.3 : P.sway * 0.3)); put('thigh', out, legs);
      tmp2.copy(out);
      out.multiplyMatrices(tmp2, local(0, -0.46, 0, knee[i])); put('shin', out, legs);
    });
    // torso frame (lean + twist + a little sway)
    torsoFrame.multiplyMatrices(root, local(0, 0.88, 0, P.lean, P.twist, P.sway));
    const skirt = settler && ph % 2 === 0;
    if (skirt) { out.multiplyMatrices(torsoFrame, local(0, 0.05, 0, 0)); put('skirt', out, tunic); }
    if (st.coat) { out.multiplyMatrices(torsoFrame, local(0, 0.08, 0, 0)); put('coat', out, tunic); }
    out.copy(torsoFrame); put('torso', out, tunic);
    if (st.tabard) {
      // over a coat the tabard hangs a little further out
      if (st.coat) { tmp.makeScale(1.16, 1, 1.18); out.multiplyMatrices(torsoFrame, tmp); put('tabard', out, st.tabard); }
      else put('tabard', torsoFrame, st.tabard);
    }
    if (settler && f.job === 'cook') put('apron', torsoFrame, null);
    // the cloak hangs from the shoulders and trails behind when walking (it ignores the lean)
    if (st.cape && !fall) { out.multiplyMatrices(torsoFrame, local(0, 0.62, -0.06, P.cape - P.lean * 0.85)); put('cape', out, st.cape); }
    // head: face (skin tone), hair (style and colour vary), beard, headgear
    headM.multiplyMatrices(torsoFrame, local(0, 0.68, 0, P.nod, P.headYaw));
    headM.scale(v.set(1.08, 1.08, 1.08)); // a slightly larger head reads better from the RTS camera
    put('head', headM, skinTints[skinI]);
    const hairCol = HAIR[ph % HAIR.length];
    const headgear = settler && (f.job === 'farmer' || f.tool === 'sickle') ? 'strawhat' : st.head === 'cap' && settler ? (ph % 3 === 0 ? 'cap' : null) : st.head;
    const bearded = (settler && !skirt && ph % 4 === 1) || st.beard;
    const hairStyle = st.hair || (skirt ? HAIR_LONG[ph % HAIR_LONG.length] : 'hair');
    // hair shows under caps, hats and helmets (a hood covers it)
    if (headgear !== 'hood' && hairStyle) put(headgear && hairStyle === 'hairBun' ? 'hair' : hairStyle, headM, st.hairColor || hairCol);
    if (bearded) put('beard', headM, st.beardColor || hairCol);
    if (headgear) put(headgear, headM, st.headColor || (headgear === 'cap' ? (f.capColor || tunic) : null));
    // sleeves: rolled up (skin) for some workers, cloth or mail for everyone else; gloves on armour
    const sleeve = st.sleeve || (settler ? (ph % 3 === 0 ? skin : shade(tunic, 0.85)) : st.pauldrons ? MAIL : shade(tunic, 0.85));
    const hand = st.gloves || (st.pauldrons && !st.cape ? GLOVE : skin);
    const pauldron = st.pauldrons ? (st.pauldrons === true ? null : st.pauldrons) : undefined;
    // arms: upper arm at the shoulder, forearm at the elbow, hand at the wrist
    armLM.multiplyMatrices(torsoFrame, local(-0.29, 0.58, 0, P.armL, 0, P.armLz));
    put('arm', armLM, tunic);
    if (pauldron !== undefined) put('pauldron', armLM, pauldron);
    foreLM.multiplyMatrices(armLM, local(0, -0.3, 0, P.elbowL)); put('forearm', foreLM, sleeve); put('hand', foreLM, hand);
    armRM.multiplyMatrices(torsoFrame, local(0.29, 0.58, 0, P.armR, 0, P.armRz));
    put('arm', armRM, tunic);
    if (pauldron !== undefined) put('pauldron', armRM, pauldron);
    foreRM.multiplyMatrices(armRM, local(0, -0.3, 0, P.elbowR)); put('forearm', foreRM, sleeve); put('hand', foreRM, hand);
    // right hand item: pole-type items point up and forward, blades out of the fist; poses can
    // steer the item's pitch in the world (a levelled spear, a sword on guard)
    const right = f.tool || st.right;
    const chain = P.lean + P.armR + P.elbowR;
    let poleR = 1.6;
    if (right && !(f.carry && f.anim !== 'hammer')) {
      if (POLE_ITEMS.has(right) || right === 'crossbow' || right === 'rod') {
        poleR = fall ? 1.6 * (1 - tip) : 1.6 + (P.itemT - chain - 1.6) * P.itemW; // the fallen let go
        out.multiplyMatrices(foreRM, local(0, -0.31, 0.02, poleR, 0, 0));
      } else if (BLADES.has(right)) {
        const r = fall ? Math.PI / 2 * (1 - tip) : Math.PI / 2 + (P.itemT - chain - Math.PI / 2) * P.itemW;
        out.multiplyMatrices(foreRM, local(0, -0.29, 0.05, r, P.itemRoll));
      } else out.multiplyMatrices(foreRM, local(0, -0.31, 0.02, 0, 0, 0));
      put(right, out, f.bladeTint && (right === 'sword' || right === 'axe' || right === 'spear') ? f.bladeTint : null);
    }
    // left hand item
    const left = st.left;
    if (left && !f.carry) {
      // shields are held turned out to the side, so they read from the RTS camera
      // a bow is kept upright in the world whatever the arm does; shields turn out to the side
      if (left === 'bow') out.multiplyMatrices(foreLM, local(0, -0.29, 0.0, -Math.PI / 2 - (P.lean + P.armL + P.elbowL)));
      else out.multiplyMatrices(foreLM, local(0, -0.25, 0.05, 0, -1.0));
      put(left, out, st.leftColor || null);
    }
    // hero lantern hangs from the pole tip
    if (st.lantern) {
      out.multiplyMatrices(foreRM, local(0, -0.31, 0.02, poleR));
      // pole top in pole-local space is +0.6 along y (pole points forward-up)
      tmp.makeTranslation(0, 0.72, 0.28);
      out.multiply(tmp);
      // keep the lantern hanging straight down whatever the arm does
      tmp.makeRotationFromEuler(e.set(-1.6 - (P.armR + 0.35) - (poleR - 1.6) - (P.elbowR + 0.9) - P.lean, 0, 0));
      out.multiply(tmp);
      tmp.makeTranslation(0, -0.2, 0);
      out.multiply(tmp);
      put('lantern', out, null);
      if (glow.count < 8) { glow.setMatrixAt(glow.count++, out); }
      if (f.lanternOut) f.lanternOut.setFromMatrixPosition(out);
    }
    // veteran stars above the head, turning slowly
    if (f.rank > 0 && !fall) {
      for (let i = 0; i < f.rank; i++) {
        out.multiplyMatrices(root, local(f.rank > 1 ? (i ? 0.13 : -0.13) : 0, 2.12 + Math.sin(t * 2 + i) * 0.03, 0, 0, t * 1.4 + i));
        put('star', out, null);
      }
    }
    // carried goods ride on the head, held up by both hands
    if (f.carry && CARRY[f.carry]) {
      out.multiplyMatrices(torsoFrame, local(0, 1.12, 0.02, 0));
      put(CARRY[f.carry], out, null);
    }
  }

  function end() {
    for (const k in meshes) {
      const m = meshes[k];
      m.count = Math.min(counts[k], m.instanceMatrix.count);
      if (outlines[k]) outlines[k].count = m.count;
      flushInstances(m);
    }
    flushInstances(glow);
  }

  return {
    begin, draw, end, meshes,
    setOutline(w) { uOutline.value = w; },
    toolFor: (job) => TOOL[job] || null,
    tunicFor: (id) => SETTLER_TUNICS[id % SETTLER_TUNICS.length],
    dispose() {
      for (const k in meshes) { scene.remove(meshes[k]); if (outlines[k]) scene.remove(outlines[k]); meshes[k].geometry.dispose(); }
      outlineMat.dispose();
      scene.remove(glow); glowGeo.dispose(); mat.dispose(); glowMat.dispose();
    },
  };
}
