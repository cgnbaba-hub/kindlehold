// Segmented, instanced character figures with procedural pose animation.
// Settlers, soldiers, the hero and enemies share part meshes; one InstancedMesh per
// part kind keeps draw calls low. Authoritative state is read from the world only.
import * as THREE from 'three';
import { createStructureMaterial, PATTERN as P } from '../render/structure-material.js';
import { paint, paintGradient, place, merge, box, cyl, cone, sphere, ico } from '../render/geometry-kit.js';
import { flushInstances } from '../render/instancing.js';

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

/** Part geometries (local to their pivot). Colours here are multiplied by instance colour. */
function buildParts() {
  return {
    // jointed limbs: thigh (hip pivot) + shin with boot (knee pivot), upper arm + forearm with hand
    thigh: g([paint(place(cyl(0.09, 0.078, 0.47, 7), { y: -0.235 }), '#ffffff', 0, null, P.cloth), paint(place(sphere(0.078, 5, 3), { y: -0.46 }), '#f2f2f2', 0, null, P.cloth)]),
    shin: g([paint(place(cyl(0.076, 0.066, 0.34, 7), { y: -0.17 }), '#b8b0a6', 0, null, P.cloth), B(0.16, 0.1, 0.28, '#4a3526', P.plain, { y: -0.4, z: 0.045 }), paint(place(cyl(0.085, 0.08, 0.1, 7), { y: -0.3 }), '#5a4030', 0, null, P.plain)]),
    torso: g([
      paintGradient(place(cyl(0.21, 0.24, 0.62, 10), { y: 0.31 }), '#e8e8e8', '#ffffff', P.cloth),
      paint(place(cyl(0.255, 0.22, 0.2, 10), { y: -0.02 }), '#f0f0f0', 0, null, P.cloth),
      B(0.5, 0.07, 0.4, '#5a4030', P.plain, { y: 0.1 }),
      paint(place(sphere(0.1, 8, 6), { x: 0.25, y: 0.58 }), '#f4f4f4', 0, null, P.cloth),
      paint(place(sphere(0.1, 8, 6), { x: -0.25, y: 0.58 }), '#f4f4f4', 0, null, P.cloth),
      paint(place(cyl(0.07, 0.08, 0.1, 8), { y: 0.66 }), '#e2b894', 0, null, P.plain),
    ]),
    coat: g([
      paintGradient(place(cyl(0.2, 0.36, 1.05, 10), { y: 0.0 }), '#dedede', '#ffffff', P.cloth),
      B(0.46, 0.07, 0.36, '#5a4030', P.plain, { y: 0.1 }),
    ]),
    // a slightly large, friendly head with a readable face (eyes, brows, nose, mouth, ears)
    head: g([
      paint(place(sphere(0.17, 10, 7), { y: 0.17 }), '#e2b894', 0, null, P.plain),
      B(0.05, 0.034, 0.02, '#f4efe4', P.plain, { x: 0.058, y: 0.19, z: 0.16 }),
      B(0.05, 0.034, 0.02, '#f4efe4', P.plain, { x: -0.058, y: 0.19, z: 0.16 }),
      B(0.026, 0.03, 0.02, '#1e1712', P.plain, { x: 0.058, y: 0.19, z: 0.168 }),
      B(0.026, 0.03, 0.02, '#1e1712', P.plain, { x: -0.058, y: 0.19, z: 0.168 }),
      B(0.06, 0.016, 0.02, '#5a3f2a', P.plain, { x: 0.06, y: 0.235, z: 0.158, rz: 0.12 }),
      B(0.06, 0.016, 0.02, '#5a3f2a', P.plain, { x: -0.06, y: 0.235, z: 0.158, rz: -0.12 }),
      paint(place(cone(0.028, 0.07, 4), { y: 0.15, z: 0.18, rx: Math.PI / 2 }), '#d4a884', 0, null, P.plain),
      B(0.06, 0.014, 0.02, '#9a5a48', P.plain, { y: 0.095, z: 0.158 }),
      B(0.04, 0.07, 0.05, '#d4a884', P.plain, { x: 0.168, y: 0.17 }),
      B(0.04, 0.07, 0.05, '#d4a884', P.plain, { x: -0.168, y: 0.17 }),
    ]),
    // hair and beard take their colour from the instance (varied per settler)
    hair: g([paint(place(sphere(0.176, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.46), { y: 0.18, z: -0.012 }), '#ffffff', 0, null, P.cloth), paint(place(sphere(0.12, 6, 4), { y: 0.14, z: -0.09, sy: 1.1 }), '#ffffff', 0, null, P.cloth)]),
    beard: g([paint(place(sphere(0.1, 6, 4), { y: 0.07, z: 0.1, sy: 1.15, sx: 1.25 }), '#ffffff', 0, null, P.cloth)]),
    skirt: g([paintGradient(place(cyl(0.24, 0.34, 0.5, 10), { y: -0.2 }), '#e6e6e6', '#ffffff', P.cloth)]),
    hood: g([paintGradient(place(cone(0.21, 0.4, 9), { y: 0.33, z: -0.02, rx: -0.14 }), '#cfcfcf', '#ffffff', P.cloth), paint(place(sphere(0.186, 10, 6), { y: 0.17, z: -0.04 }), '#ffffff', 0, null, P.cloth)]),
    cap: g([paint(place(sphere(0.15, 10, 5), { y: 0.2, sy: 0.6 }), '#ffffff', 0, null, P.cloth)]),
    // helmets sit over the head sphere (radius 0.17) so no skin shows through
    helm: g([paint(place(sphere(0.192, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.42), { y: 0.2 }), '#b9bcc0', 0, null, P.metal), B(0.035, 0.12, 0.035, '#9a9da2', P.metal, { y: 0.2, z: 0.178 }), paint(place(cyl(0.197, 0.197, 0.035, 12), { y: 0.25 }), '#8f9296', 0, null, P.metal)]),
    hornhelm: g([paint(place(sphere(0.195, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.45), { y: 0.2 }), '#6a625a', 0, null, P.metal), paint(place(cone(0.05, 0.36, 6), { x: 0.2, y: 0.36, rz: -0.7 }), '#d8ccb0', 0, null, P.plain), paint(place(cone(0.05, 0.36, 6), { x: -0.2, y: 0.36, rz: 0.7 }), '#d8ccb0', 0, null, P.plain)]),
    arm: g([paint(place(cyl(0.068, 0.062, 0.31, 7), { y: -0.155 }), '#ffffff', 0, null, P.cloth), paint(place(sphere(0.062, 5, 3), { y: -0.3 }), '#f2f2f2', 0, null, P.cloth)]),
    forearm: g([paint(place(cyl(0.058, 0.05, 0.26, 7), { y: -0.13 }), '#e2b894', 0, null, P.plain), paint(place(sphere(0.064, 5, 4), { y: -0.3, sz: 0.8 }), '#d4a884', 0, null, P.plain)]),
    // right-hand items: pivot at the hand, pointing along -Y when the arm hangs
    axe: g([paint(place(cyl(0.025, 0.03, 0.8, 5), { y: -0.2 }), '#6b4a2f', 0, null, P.planks), B(0.05, 0.16, 0.2, '#9fa3a8', P.metal, { y: -0.52, z: 0.09 })]),
    pick: g([paint(place(cyl(0.025, 0.03, 0.8, 5), { y: -0.2 }), '#6b4a2f', 0, null, P.planks), B(0.05, 0.06, 0.5, '#8c8f93', P.metal, { y: -0.58 })]),
    hammer: g([paint(place(cyl(0.022, 0.025, 0.5, 5), { y: -0.1 }), '#6b4a2f', 0, null, P.planks), B(0.1, 0.1, 0.18, '#7d7f82', P.metal, { y: -0.36 })]),
    sickle: g([paint(place(cyl(0.022, 0.025, 0.3, 5), { y: 0 }), '#6b4a2f', 0, null, P.planks), paint(place(new THREE.TorusGeometry(0.14, 0.015, 4, 10, Math.PI), { y: -0.18, z: 0.1, ry: Math.PI / 2 }), '#a6a9ad', 0, null, P.metal)]),
    sword: g([B(0.05, 0.75, 0.018, '#c9ccd0', P.metal, { y: -0.48 }), B(0.2, 0.035, 0.05, '#6b5a3a', P.metal, { y: -0.1 }), paint(place(cyl(0.02, 0.02, 0.12, 5), { y: -0.02 }), '#4a3526', 0, null, P.plain)]),
    spear: g([paint(place(cyl(0.022, 0.025, 2.0, 5), { y: -0.3 }), '#6b4a2f', 0, null, P.planks), paint(place(cone(0.05, 0.24, 4), { y: -1.42, rx: Math.PI }), '#c2c5c9', 0, null, P.metal)]),
    bow: g([paint(place(new THREE.TorusGeometry(0.62, 0.018, 4, 12, Math.PI * 0.8), { y: -0.1, rz: Math.PI / 2 + 0.3 }), '#6b4a2f', 0, null, P.planks), paint(place(cyl(0.004, 0.004, 1.1, 3), { y: -0.1, x: -0.25 }), '#e8e0cc', 0, null, P.plain)]),
    rod: g([paint(place(cyl(0.012, 0.022, 2.2, 4), { y: -0.6 }), '#8a6a44', 0, null, P.planks), paint(place(cyl(0.003, 0.003, 1.3, 3), { y: -1.6, z: 0.35, rx: -0.5 }), '#e8e0cc', 0, null, P.plain)]),
    pole: g([paint(place(cyl(0.03, 0.035, 2.3, 6), { y: -0.55 }), '#3e2c1f', 0, null, P.planks), paint(place(cyl(0.016, 0.016, 0.3, 4), { y: 0.72, z: 0.12, rx: 0.9 }), '#2f2f31', 0, null, P.metal)]),
    crossbow: g([B(0.07, 0.7, 0.09, '#6b4a2f', P.planks, { y: -0.3 }), B(0.62, 0.05, 0.05, '#4a4a4c', P.metal, { y: -0.6 }), paint(place(cyl(0.004, 0.004, 0.6, 3), { y: -0.55, rz: Math.PI / 2 }), '#e8e0cc', 0, null, P.plain)]),
    halberd: g([paint(place(cyl(0.024, 0.027, 2.3, 5), { y: -0.45 }), '#5a4030', 0, null, P.planks), B(0.05, 0.3, 0.26, '#b9bcc0', P.metal, { y: -1.45, z: 0.1 }), paint(place(cone(0.045, 0.3, 4), { y: -1.72, rx: Math.PI }), '#c2c5c9', 0, null, P.metal)]),
    greataxe: g([paint(place(cyl(0.035, 0.04, 1.3, 6), { y: -0.4 }), '#3e2c1f', 0, null, P.planks), B(0.06, 0.4, 0.46, '#7a716a', P.metal, { y: -0.98, z: 0.2 })]),
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
    tabard: g([B(0.3, 0.5, 0.03, '#ffffff', P.cloth, { y: 0.02, z: 0.27 }), B(0.3, 0.5, 0.03, '#f2f2f2', P.cloth, { y: 0.02, z: -0.27 }), B(0.1, 0.1, 0.035, '#d8d8d8', P.cloth, { y: 0.14, z: 0.29, rz: Math.PI / 4 })]),
    strawhat: g([paint(place(cyl(0.3, 0.32, 0.025, 12), { y: 0.25 }), '#d9c07a', 0, null, P.cloth), paint(place(cyl(0.13, 0.16, 0.13, 10), { y: 0.32 }), '#cdb46c', 0, null, P.cloth), paint(place(cyl(0.162, 0.162, 0.03, 10), { y: 0.275 }), '#8a4a3a', 0, null, P.cloth)]),
    apron: g([B(0.34, 0.62, 0.02, '#ece6d6', P.cloth, { y: -0.12, z: 0.245 }), B(0.2, 0.2, 0.02, '#ece6d6', P.cloth, { y: 0.3, z: 0.225 })]),
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

const TOOL = { forester: 'axe', quarrier: 'pick', miner: 'pick', farmer: 'sickle', hunter: 'spear', fisher: 'rod', cook: null };
const CARRY = { timber: 'log', stone: 'stone', provisions: 'sack', iron: 'ingot' };
const SETTLER_TUNICS = ['#8a6f4e', '#6f7b5a', '#9b7c52', '#5f6f7a', '#7a5f4e', '#8e8a6a', '#8a4e4a', '#4e6a7a'];
const HAIR = ['#4a3222', '#2a1e16', '#b8914e', '#8a4a24', '#6a5a4a', '#c8c0b0', '#3a2a1e'];

export const STYLE = {
  settler: { torso: null, head: 'cap', skin: '#e2b894', legs: '#5b4b3c' },
  shield: { torso: '#2f6f8f', head: 'helm', right: 'spear', left: 'shieldKite', leftColor: '#2f6f8f', legs: '#4d4338', pauldrons: true, tabard: '#e3d6b0' },
  blade: { torso: '#5d93ab', coat: true, head: 'helm', right: 'sword', left: null, legs: '#4d4338', pauldrons: true },
  fletcher: { torso: '#4f6f4a', head: 'hood', headColor: '#3f5a3c', right: null, left: 'bow', legs: '#4d4338' },
  crossbow: { torso: '#3f5a6a', coat: true, head: 'helm', right: 'crossbow', left: null, legs: '#4d4338', tabard: '#e3d6b0' },
  halberd: { torso: '#2a5a7a', coat: true, head: 'helm', right: 'halberd', left: null, legs: '#3a3a3c', pauldrons: true, tabard: '#d1a54a' },
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
  const caps = { thigh: 2, shin: 2, arm: 2, forearm: 2 };
  for (const k in parts) {
    const n = maxFigures * (caps[k] || 1);
    const m = new THREE.InstancedMesh(parts[k], k === 'lantern' ? mat : mat, n);
    m.count = 0; m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m);
    meshes[k] = m;
    // inverted-hull outline sharing the same instance matrices: crisp silhouettes at RTS zoom
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
    if (color) { col.set(color); m.setColorAt(i, col); }
    else { col.setRGB(1, 1, 1); m.setColorAt(i, col); }
  }

  /** local transform: translate(px,py,pz) * rotX(ax) * rotZ(az) * rotY(ay) */
  function local(px, py, pz, ax, ay = 0, az = 0) {
    q.setFromEuler(e.set(ax, ay, az, 'YXZ'));
    return tmp.compose(v.set(px, py, pz), q, one);
  }

  /**
   * Draw one figure.
   * @param {object} f  { x, y, z, heading, scale, style, tunic, anim, t, tool, carry, fallen, kneel, lean }
   */
  function draw(f) {
    const st = STYLE[f.style] || STYLE.settler;
    const sc = (st.scale || 1) * (f.scale || 1);
    const t = f.t;
    let legA = 0, armL = 0, armR = 0, armRz = 0, armLz = 0, bob = 0, lean = f.lean || 0, torsoTwist = 0, handItemA = 0;
    // joints: knees bend backwards (+), elbows forwards (-); a little hip sway and head nod
    let kneeL = 0.05, kneeR = 0.05, elbowL = -0.15, elbowR = -0.15, sway = 0, nod = 0, headYaw = 0, cape = 0.14;
    const pole = st.right === 'spear' || st.right === 'pole' || st.right === 'halberd' || st.right === 'crossbow';
    const walkF = f.anim === 'run' ? 11 : 8.5;
    switch (f.anim) {
      case 'walk': case 'run': case 'carry': {
        const ph = t * walkF;
        legA = Math.sin(ph) * (f.anim === 'run' ? 0.7 : 0.55); bob = Math.abs(Math.cos(ph)) * 0.05;
        // the trailing leg folds at the knee as it swings through
        kneeL = 0.1 + Math.max(0, Math.sin(ph + 1.2)) * (f.anim === 'run' ? 1.3 : 0.95);
        kneeR = 0.1 + Math.max(0, Math.sin(ph + 1.2 + Math.PI)) * (f.anim === 'run' ? 1.3 : 0.95);
        armL = -legA * 0.8; armR = legA * 0.8; elbowL = elbowR = f.anim === 'run' ? -1.3 : -0.35;
        sway = Math.sin(ph) * 0.06; nod = Math.abs(Math.sin(ph)) * 0.06;
        if (f.anim === 'carry') { armL = -2.6; armR = -2.5; armLz = -0.3; armRz = 0.3; elbowL = elbowR = -1.1; }
        // soldiers march with the spear upright instead of swinging it about
        else if (pole && !f.tool) { armR = -0.35 + legA * 0.1; elbowR = -0.9; }
        cape = (f.anim === 'run' ? 0.75 : 0.38) + Math.sin(ph * 2) * 0.06;
        break;
      }
      case 'carryIdle': armL = -2.6; armR = -2.5; armLz = -0.3; armRz = 0.3; elbowL = elbowR = -1.1; break;
      case 'chop': case 'pick': case 'hammer': {
        const c = (t * (f.anim === 'hammer' ? 2.2 : 1.45)) % 1;
        const swing = c < 0.55 ? -2.7 * (c / 0.55) : -2.7 + 3.2 * Math.min(1, (c - 0.55) / 0.15);
        armR = swing; armL = f.anim === 'hammer' ? -0.6 : swing * 0.9; lean = 0.18 + (c > 0.55 && c < 0.75 ? 0.15 : 0);
        // wind up with bent elbows, strike with straight arms
        elbowR = c < 0.55 ? -0.2 - 0.9 * (c / 0.55) : -0.15; elbowL = f.anim === 'hammer' ? -1.2 : elbowR;
        kneeL = kneeR = 0.15 + (c > 0.55 && c < 0.75 ? 0.2 : 0); nod = lean * 0.4;
        break;
      }
      case 'sow': case 'harvest': case 'farm': {
        const c = Math.sin(t * 3.2);
        lean = 0.55; armR = -0.9 + c * 0.5; armL = -0.5 - c * 0.3; elbowR = -0.5 + c * 0.3; elbowL = -0.7; kneeL = kneeR = 0.45; nod = 0.2;
        break;
      }
      case 'mine': { const c = Math.sin(t * 4); armR = -1.3 + c * 0.35; armL = -1.3 + c * 0.35; elbowL = elbowR = -0.6 - c * 0.3; legA = c * 0.3; lean = 0.25; kneeL = kneeR = 0.3; break; }
      case 'attack': {
        const c = f.attackPhase;
        if (f.ranged) { armL = -1.4; armLz = -0.15; armR = -0.95 + c * 0.25; armRz = 0.55 - c * 0.3; torsoTwist = 0.6; elbowL = -0.05; elbowR = -1.4 + c * 0.6; }
        else { armR = c < 0.4 ? -2.4 * (c / 0.4) : -2.4 + 3.4 * Math.min(1, (c - 0.4) / 0.2); armL = -0.7; lean = 0.15; torsoTwist = -0.3 * Math.sin(c * Math.PI); elbowR = c < 0.4 ? -1.0 : -0.1; elbowL = -1.0; }
        kneeL = 0.25; kneeR = 0.15; legA = 0.18;
        break;
      }
      case 'cast': armR = -3.0; armL = -0.4; lean = -0.1; elbowR = -0.1; nod = -0.1; break;
      case 'fish': { // rod held out over the water, a patient twitch now and then
        const tw = Math.max(0, Math.sin(t * 0.9 + (f.phase || 0))) ** 8;
        armR = -1.0 - tw * 0.35; elbowR = -0.4; armL = -0.8; elbowL = -1.1; armLz = 0.25; kneeL = kneeR = 0.12; nod = 0.12;
        break;
      }
      case 'cower': lean = 0.4; armL = -1.8; armR = -1.8; armLz = -0.4; armRz = 0.4; bob = -0.12; elbowL = elbowR = -1.6; kneeL = kneeR = 0.8; nod = 0.3; break;
      default: {
        const breathe = Math.sin(t * 1.6 + (f.phase || 0)) * 0.03;
        armL = breathe; armR = -breathe; nod = Math.sin(t * 0.5 + (f.phase || 0)) * 0.05;
        // now and then look around, and shift the weight from one leg to the other
        headYaw = Math.pow(Math.sin(t * 0.31 + (f.phase || 0) * 1.7), 5) * 0.75;
        sway = Math.sin(t * 0.23 + (f.phase || 0)) * 0.035;
        cape = 0.14 + Math.sin(t * 0.9 + (f.phase || 0)) * 0.04;
        if (pole) { armR = -0.35; elbowR = -0.9; }
      }
    }
    // struck: a short flinch backwards
    if (f.hit > 0) { lean -= 0.32 * f.hit; nod -= 0.3 * f.hit; armL -= 0.35 * f.hit; armLz -= 0.25 * f.hit; kneeL += 0.2 * f.hit; kneeR += 0.2 * f.hit; }
    // root
    q.setFromEuler(e.set(f.fallen ? -Math.PI / 2 * f.fallen : 0, f.heading, 0, 'YXZ'));
    root.compose(v.set(f.x, f.y + bob * sc - (f.kneel ? 0.45 * sc : 0) - (f.fallen ? 0.15 : 0), f.z), q, scl.set(sc, sc, sc));
    const tunic = f.tunic || st.torso || '#8a6f4e';
    // legs: thigh at the hip, shin at the knee
    const hip = f.kneel ? [-1.2, 0.2] : [legA, -legA];
    const knee = f.kneel ? [1.5, 0.3] : [kneeR, kneeL];
    [0.1, -0.1].forEach((hx, i) => {
      out.multiplyMatrices(root, local(hx, 0.9, 0, hip[i], 0, i ? -sway * 0.3 : sway * 0.3)); put('thigh', out, st.legs);
      tmp2.copy(out);
      out.multiplyMatrices(tmp2, local(0, -0.46, 0, knee[i])); put('shin', out, st.legs);
    });
    // torso frame (lean + twist + a little sway)
    torsoFrame.multiplyMatrices(root, local(0, 0.88, 0, lean, torsoTwist, sway));
    const settler = f.style === 'settler';
    const skirt = settler && (f.phase || 0) % 2 === 0;
    if (skirt) { out.multiplyMatrices(torsoFrame, local(0, 0.05, 0, 0)); put('skirt', out, tunic); }
    if (st.coat) { out.multiplyMatrices(torsoFrame, local(0, 0.08, 0, 0)); put('coat', out, tunic); }
    out.copy(torsoFrame); put('torso', out, tunic);
    if (st.tabard) put('tabard', torsoFrame, st.tabard);
    if (settler && f.job === 'cook') put('apron', torsoFrame, null);
    // the cloak hangs from the shoulders and trails behind when walking (it ignores the lean)
    if (st.cape && !f.fallen) { out.multiplyMatrices(torsoFrame, local(0, 0.62, -0.06, cape - lean * 0.85)); put('cape', out, st.cape); }
    // head: face, hair (varied), beard, headgear
    headM.multiplyMatrices(torsoFrame, local(0, 0.68, 0, nod, headYaw));
    put('head', headM, null);
    const hairCol = HAIR[(f.phase || 0) % HAIR.length];
    const headgear = settler && (f.job === 'farmer' || f.tool === 'sickle') ? 'strawhat' : st.head === 'cap' && settler ? ((f.phase || 0) % 3 === 0 ? 'cap' : null) : st.head;
    // hair shows under caps, hats and helmets (a hood covers it)
    if (headgear !== 'hood') put('hair', headM, st.hairColor || hairCol);
    if ((settler && (f.phase || 0) % 4 === 1) || st.beard) put('beard', headM, st.beardColor || hairCol);
    if (headgear) put(headgear, headM, st.headColor || (headgear === 'cap' ? (f.capColor || tunic) : null));
    // arms: upper arm at the shoulder, forearm at the elbow
    armLM.multiplyMatrices(torsoFrame, local(-0.29, 0.58, 0, armL, 0, armLz));
    put('arm', armLM, tunic);
    const pauldron = st.pauldrons ? (st.pauldrons === true ? null : st.pauldrons) : undefined;
    if (pauldron !== undefined) put('pauldron', armLM, pauldron);
    foreLM.multiplyMatrices(armLM, local(0, -0.3, 0, elbowL)); put('forearm', foreLM, null);
    armRM.multiplyMatrices(torsoFrame, local(0.29, 0.58, 0, armR, 0, armRz));
    put('arm', armRM, tunic);
    if (pauldron !== undefined) put('pauldron', armRM, pauldron);
    foreRM.multiplyMatrices(armRM, local(0, -0.3, 0, elbowR)); put('forearm', foreRM, null);
    // right hand item
    const right = f.tool || st.right;
    if (right && !(f.carry && f.anim !== 'hammer')) {
      out.multiplyMatrices(foreRM, local(0, -0.31, 0.02, right === 'bow' ? 0 : (right === 'spear' || right === 'pole' || right === 'halberd' || right === 'crossbow' || right === 'rod' ? 1.6 : 0), 0, 0));
      if (right === 'axe' || right === 'pick' || right === 'hammer' || right === 'sword' || right === 'greataxe' || right === 'sickle') out.multiplyMatrices(foreRM, local(0, -0.29, 0.05, Math.PI * 0.5 + handItemA));
      put(right, out, f.bladeTint && (right === 'sword' || right === 'axe' || right === 'spear') ? f.bladeTint : null);
    }
    // left hand item
    const left = st.left;
    if (left && !f.carry) {
      // shields are held turned out to the side, so they read from the RTS camera
      out.multiplyMatrices(foreLM, local(0, -0.25, 0.05, left === 'bow' ? 1.4 : 0, left === 'bow' ? 0 : -1.0));
      put(left, out, st.leftColor || null);
    }
    // hero lantern hangs from the pole tip
    if (st.lantern) {
      out.multiplyMatrices(foreRM, local(0, -0.31, 0.02, 1.6));
      // pole top in pole-local space is +0.6 along y (pole points forward-up)
      tmp.makeTranslation(0, 0.72, 0.28);
      out.multiply(tmp);
      tmp.makeRotationFromEuler(e.set(-1.6 - (armR + 0.35), 0, 0));
      out.multiply(tmp);
      tmp.makeTranslation(0, -0.2, 0);
      out.multiply(tmp);
      put('lantern', out, null);
      if (glow.count < 8) { glow.setMatrixAt(glow.count++, out); }
      if (f.lanternOut) f.lanternOut.setFromMatrixPosition(out);
    }
    // veteran stars above the head, turning slowly
    if (f.rank > 0 && !f.fallen) {
      for (let i = 0; i < f.rank; i++) {
        out.multiplyMatrices(root, local(f.rank > 1 ? (i ? 0.13 : -0.13) : 0, 2.12 + Math.sin(t * 2 + i) * 0.03, 0, 0, t * 1.4 + i));
        put('star', out, null);
      }
    }
    // carried goods on the shoulder
    if (f.carry && CARRY[f.carry]) {
      // goods ride on the head, held up by both hands
      out.multiplyMatrices(torsoFrame, local(0, 1.12, 0.02, 0));
      put(CARRY[f.carry], out, null);
    }
  }

  function end() {
    for (const k in meshes) {
      const m = meshes[k];
      m.count = Math.min(counts[k], m.instanceMatrix.count);
      outlines[k].count = m.count;
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
      for (const k in meshes) { scene.remove(meshes[k], outlines[k]); meshes[k].geometry.dispose(); }
      outlineMat.dispose();
      scene.remove(glow); glowGeo.dispose(); mat.dispose(); glowMat.dispose();
    },
  };
}
