// Segmented, instanced character figures with procedural pose animation.
// Settlers, soldiers, the hero and enemies share part meshes; one InstancedMesh per
// part kind keeps draw calls low. Authoritative state is read from the world only.
import * as THREE from 'three';
import { createStructureMaterial, PATTERN as P } from '../render/structure-material.js';
import { paint, paintGradient, place, merge, box, cyl, cone, sphere, ico } from '../render/geometry-kit.js';

function g(parts) { return merge(parts); }
const B = (w, h, d, c, pat, at) => paint(place(box(w, h, d), at), c, 0, null, pat);

/** Part geometries (local to their pivot). Colours here are multiplied by instance colour. */
function buildParts() {
  return {
    leg: g([paint(place(cyl(0.085, 0.075, 0.5, 7), { y: -0.25 }), '#ffffff', 0, null, P.cloth), paint(place(cyl(0.08, 0.07, 0.36, 7), { y: -0.66 }), '#b8b0a6', 0, null, P.cloth), B(0.16, 0.1, 0.27, '#4a3526', P.plain, { y: -0.87, z: 0.04 })]),
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
    head: g([paint(place(sphere(0.155, 12, 9), { y: 0.16 }), '#e2b894', 0, null, P.plain), paint(place(sphere(0.158, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), { y: 0.17, z: -0.01 }), '#6a4b33', 0, null, P.plain), B(0.05, 0.05, 0.05, '#d4a884', P.plain, { y: 0.14, z: 0.15 })]),
    hood: g([paintGradient(place(cone(0.2, 0.42, 9), { y: 0.3, rx: -0.12 }), '#cfcfcf', '#ffffff', P.cloth), paint(place(sphere(0.155, 10, 6), { y: 0.16, z: -0.03 }), '#ffffff', 0, null, P.cloth)]),
    cap: g([paint(place(sphere(0.15, 10, 5), { y: 0.2, sy: 0.6 }), '#ffffff', 0, null, P.cloth)]),
    helm: g([paint(place(sphere(0.16, 10, 6), { y: 0.19, sy: 0.9 }), '#b9bcc0', 0, null, P.metal), B(0.035, 0.18, 0.05, '#9a9da2', P.metal, { y: 0.14, z: 0.15 }), paint(place(cyl(0.18, 0.18, 0.04, 10), { y: 0.12 }), '#8f9296', 0, null, P.metal)]),
    hornhelm: g([paint(place(sphere(0.18, 10, 6), { y: 0.19 }), '#6a625a', 0, null, P.metal), paint(place(cone(0.05, 0.36, 6), { x: 0.2, y: 0.36, rz: -0.7 }), '#d8ccb0', 0, null, P.plain), paint(place(cone(0.05, 0.36, 6), { x: -0.2, y: 0.36, rz: 0.7 }), '#d8ccb0', 0, null, P.plain)]),
    arm: g([paint(place(cyl(0.065, 0.06, 0.34, 7), { y: -0.17 }), '#ffffff', 0, null, P.cloth), paint(place(cyl(0.055, 0.05, 0.28, 7), { y: -0.46 }), '#e2b894', 0, null, P.plain), paint(place(sphere(0.06, 6, 5), { y: -0.62 }), '#d4a884', 0, null, P.plain)]),
    // right-hand items: pivot at the hand, pointing along -Y when the arm hangs
    axe: g([paint(place(cyl(0.025, 0.03, 0.8, 5), { y: -0.2 }), '#6b4a2f', 0, null, P.planks), B(0.05, 0.16, 0.2, '#9fa3a8', P.metal, { y: -0.52, z: 0.09 })]),
    pick: g([paint(place(cyl(0.025, 0.03, 0.8, 5), { y: -0.2 }), '#6b4a2f', 0, null, P.planks), B(0.05, 0.06, 0.5, '#8c8f93', P.metal, { y: -0.58 })]),
    hammer: g([paint(place(cyl(0.022, 0.025, 0.5, 5), { y: -0.1 }), '#6b4a2f', 0, null, P.planks), B(0.1, 0.1, 0.18, '#7d7f82', P.metal, { y: -0.36 })]),
    sickle: g([paint(place(cyl(0.022, 0.025, 0.3, 5), { y: 0 }), '#6b4a2f', 0, null, P.planks), paint(place(new THREE.TorusGeometry(0.14, 0.015, 4, 10, Math.PI), { y: -0.18, z: 0.1, ry: Math.PI / 2 }), '#a6a9ad', 0, null, P.metal)]),
    sword: g([B(0.05, 0.75, 0.018, '#c9ccd0', P.metal, { y: -0.48 }), B(0.2, 0.035, 0.05, '#6b5a3a', P.metal, { y: -0.1 }), paint(place(cyl(0.02, 0.02, 0.12, 5), { y: -0.02 }), '#4a3526', 0, null, P.plain)]),
    spear: g([paint(place(cyl(0.022, 0.025, 2.0, 5), { y: -0.3 }), '#6b4a2f', 0, null, P.planks), paint(place(cone(0.05, 0.24, 4), { y: -1.42, rx: Math.PI }), '#c2c5c9', 0, null, P.metal)]),
    bow: g([paint(place(new THREE.TorusGeometry(0.62, 0.018, 4, 12, Math.PI * 0.8), { y: -0.1, rz: Math.PI / 2 + 0.3 }), '#6b4a2f', 0, null, P.planks), paint(place(cyl(0.004, 0.004, 1.1, 3), { y: -0.1, x: -0.25 }), '#e8e0cc', 0, null, P.plain)]),
    pole: g([paint(place(cyl(0.03, 0.035, 2.3, 6), { y: -0.55 }), '#3e2c1f', 0, null, P.planks), paint(place(cyl(0.016, 0.016, 0.3, 4), { y: 0.72, z: 0.12, rx: 0.9 }), '#2f2f31', 0, null, P.metal)]),
    greataxe: g([paint(place(cyl(0.035, 0.04, 1.3, 6), { y: -0.4 }), '#3e2c1f', 0, null, P.planks), B(0.06, 0.4, 0.46, '#7a716a', P.metal, { y: -0.98, z: 0.2 })]),
    sling: g([paint(place(cyl(0.008, 0.008, 0.6, 3), { y: -0.3 }), '#8a7050', 0, null, P.plain), paint(place(sphere(0.05, 6, 4), { y: -0.6 }), '#6a625a', 0, null, P.plain)]),
    // left-hand items
    shieldRound: g([paint(place(cyl(0.34, 0.34, 0.05, 12), { rx: Math.PI / 2, y: -0.2, z: 0.06 }), '#ffffff', 0, null, P.planks), paint(place(sphere(0.07, 6, 4), { y: -0.2, z: 0.1 }), '#b0a070', 0, null, P.metal)]),
    shieldKite: g([paint(place(box(0.5, 0.8, 0.05), { y: -0.25, z: 0.07 }), '#ffffff', 0, null, P.planks), B(0.52, 0.06, 0.06, '#d1a54a', P.metal, { y: 0.14, z: 0.08 }), B(0.06, 0.7, 0.06, '#d1a54a', P.metal, { y: -0.25, z: 0.1 })]),
    shieldHide: g([paint(place(cyl(0.4, 0.4, 0.06, 7), { rx: Math.PI / 2, y: -0.2, z: 0.06 }), '#ffffff', 0, null, P.cloth)]),
    lantern: g([paint(place(cyl(0.12, 0.14, 0.26, 6), { y: 0.0 }), '#2f2f31', 0, null, P.metal), paint(place(cone(0.13, 0.12, 6), { y: 0.19 }), '#2f2f31', 0, null, P.metal)]),
    // carried goods (on the shoulder)
    log: g([paint(place(cyl(0.12, 0.12, 1.1, 7), { rz: Math.PI / 2 }), '#6e5037', 0, null, P.planks)]),
    stone: g([paint(place(ico(0.2, 0), {}), '#8c8a82', 0, null, P.rock)]),
    sack: g([paint(place(sphere(0.22, 8, 6), { sy: 1.2 }), '#c2a878', 0, null, P.cloth)]),
    ingot: g([B(0.34, 0.12, 0.2, '#6f7176', P.metal, {}), B(0.34, 0.12, 0.2, '#6f7176', P.metal, { y: 0.12, x: 0.05 })]),
  };
}

const TOOL = { forester: 'axe', quarrier: 'pick', miner: 'pick', farmer: 'sickle' };
const CARRY = { timber: 'log', stone: 'stone', provisions: 'sack', iron: 'ingot' };
const SETTLER_TUNICS = ['#8a6f4e', '#6f7b5a', '#9b7c52', '#5f6f7a', '#7a5f4e', '#8e8a6a'];

export const STYLE = {
  settler: { torso: null, head: 'cap', skin: '#e2b894', legs: '#5b4b3c' },
  shield: { torso: '#2f6f8f', head: 'helm', right: 'spear', left: 'shieldKite', leftColor: '#2f6f8f', legs: '#4d4338' },
  blade: { torso: '#5d93ab', coat: true, head: 'helm', right: 'sword', left: null, legs: '#4d4338' },
  fletcher: { torso: '#4f6f4a', head: 'hood', headColor: '#3f5a3c', right: null, left: 'bow', legs: '#4d4338' },
  maren: { torso: '#384a5c', coat: true, head: 'hood', headColor: '#2c3a48', right: 'pole', left: null, legs: '#3a3028', lantern: true },
  reaver: { torso: '#8c3b2a', head: 'cap', headColor: '#3a302a', right: 'axe', left: null, legs: '#3a302a' },
  slinger: { torso: '#7a5a3e', head: 'hood', headColor: '#5b2a20', right: 'sling', left: null, legs: '#3a302a' },
  brute: { torso: '#5b2a20', head: 'hornhelm', right: 'spear', left: 'shieldHide', leftColor: '#7a5a3e', legs: '#3a302a' },
  vharek: { torso: '#3a302a', coat: true, head: 'hornhelm', right: 'greataxe', left: null, legs: '#2a2420', scale: 1.28 },
};

export function createFigureRenderer({ scene, maxFigures = 420 }) {
  const parts = buildParts();
  const mat = createStructureMaterial({ roughness: 0.85 }, 'kh-structure');
  const glowMat = new THREE.MeshStandardMaterial({ color: '#40301a', emissive: '#ffbe62', emissiveIntensity: 2.2 });
  const meshes = {};
  const caps = { leg: 2, arm: 2 };
  for (const k in parts) {
    const n = maxFigures * (caps[k] || 1);
    const m = new THREE.InstancedMesh(parts[k], k === 'lantern' ? mat : mat, n);
    m.count = 0; m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m);
    meshes[k] = m;
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
    const walkF = f.anim === 'run' ? 11 : 8.5;
    switch (f.anim) {
      case 'walk': case 'run': case 'carry':
        legA = Math.sin(t * walkF) * 0.55; bob = Math.abs(Math.cos(t * walkF)) * 0.05;
        armL = -legA * 0.8; armR = legA * 0.8;
        if (f.anim === 'carry') { armL = -2.6; armR = -2.5; armLz = -0.3; armRz = 0.3; }
        break;
      case 'carryIdle': armL = -2.6; armR = -2.5; armLz = -0.3; armRz = 0.3; break;
      case 'chop': case 'pick': case 'hammer': {
        const c = (t * (f.anim === 'hammer' ? 2.2 : 1.45)) % 1;
        const swing = c < 0.55 ? -2.7 * (c / 0.55) : -2.7 + 3.2 * Math.min(1, (c - 0.55) / 0.15);
        armR = swing; armL = f.anim === 'hammer' ? -0.6 : swing * 0.9; lean = 0.18 + (c > 0.55 && c < 0.75 ? 0.15 : 0);
        break;
      }
      case 'sow': case 'harvest': case 'farm': {
        const c = Math.sin(t * 3.2);
        lean = 0.55; armR = -0.9 + c * 0.5; armL = -0.5 - c * 0.3;
        break;
      }
      case 'mine': { const c = Math.sin(t * 4); armR = -1.3 + c * 0.35; armL = -1.3 + c * 0.35; legA = c * 0.3; lean = 0.25; break; }
      case 'attack': {
        const c = f.attackPhase;
        if (f.ranged) { armL = -1.55; armR = -1.5 + c * 0.2; armRz = 0.4 - c * 0.4; torsoTwist = 0.5; }
        else { armR = c < 0.4 ? -2.4 * (c / 0.4) : -2.4 + 3.4 * Math.min(1, (c - 0.4) / 0.2); armL = -0.7; lean = 0.15; torsoTwist = -0.3 * Math.sin(c * Math.PI); }
        break;
      }
      case 'cast': armR = -3.0; armL = -0.4; lean = -0.1; break;
      case 'cower': lean = 0.4; armL = -1.8; armR = -1.8; armLz = -0.4; armRz = 0.4; bob = -0.12; break;
      default: {
        const breathe = Math.sin(t * 1.6 + (f.phase || 0)) * 0.03;
        armL = breathe; armR = -breathe;
        if (st.right === 'spear' || st.right === 'pole') armR = -0.35;
      }
    }
    // root
    q.setFromEuler(e.set(f.fallen ? -Math.PI / 2 * f.fallen : 0, f.heading, 0, 'YXZ'));
    root.compose(v.set(f.x, f.y + bob * sc - (f.kneel ? 0.45 * sc : 0) - (f.fallen ? 0.15 : 0), f.z), q, scl.set(sc, sc, sc));
    const tunic = f.tunic || st.torso || '#8a6f4e';
    // legs
    out.multiplyMatrices(root, local(0.1, 0.9, 0, f.kneel ? -1.2 : legA)); put('leg', out, st.legs);
    out.multiplyMatrices(root, local(-0.1, 0.9, 0, f.kneel ? 0.2 : -legA)); put('leg', out, st.legs);
    // torso frame (lean + twist)
    torsoFrame.multiplyMatrices(root, local(0, 0.88, 0, lean, torsoTwist));
    if (st.coat) { out.multiplyMatrices(torsoFrame, local(0, 0.08, 0, 0)); put('coat', out, tunic); }
    out.copy(torsoFrame); put('torso', out, tunic);
    // head
    out.multiplyMatrices(torsoFrame, local(0, 0.68, 0, 0)); put('head', out, null);
    if (st.head) { out.multiplyMatrices(torsoFrame, local(0, 0.68, 0, 0)); put(st.head, out, st.headColor || (st.head === 'cap' ? (f.capColor || tunic) : null)); }
    // arms
    armLM.multiplyMatrices(torsoFrame, local(-0.29, 0.58, 0, armL, 0, armLz));
    put('arm', armLM, tunic);
    armRM.multiplyMatrices(torsoFrame, local(0.29, 0.58, 0, armR, 0, armRz));
    put('arm', armRM, tunic);
    // right hand item
    const right = f.tool || st.right;
    if (right && !(f.carry && f.anim !== 'hammer')) {
      out.multiplyMatrices(armRM, local(0, -0.62, 0.02, right === 'bow' ? 0 : (right === 'spear' || right === 'pole' ? 1.6 : 0), 0, 0));
      if (right === 'axe' || right === 'pick' || right === 'hammer' || right === 'sword' || right === 'greataxe' || right === 'sickle') out.multiplyMatrices(armRM, local(0, -0.6, 0.05, Math.PI * 0.5 + handItemA));
      put(right, out, f.bladeTint && (right === 'sword' || right === 'axe' || right === 'spear') ? f.bladeTint : null);
    }
    // left hand item
    const left = st.left;
    if (left && !f.carry) {
      out.multiplyMatrices(armLM, local(0, -0.55, 0.05, left === 'bow' ? 1.4 : 0));
      put(left, out, st.leftColor || null);
    }
    // hero lantern hangs from the pole tip
    if (st.lantern) {
      out.multiplyMatrices(armRM, local(0, -0.62, 0.02, 1.6));
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
    // carried goods on the shoulder
    if (f.carry && CARRY[f.carry]) {
      out.multiplyMatrices(torsoFrame, local(0, 0.86, -0.05, 0));
      put(CARRY[f.carry], out, null);
    }
  }

  function end() {
    for (const k in meshes) {
      const m = meshes[k];
      m.count = Math.min(counts[k], m.instanceMatrix.count);
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    glow.instanceMatrix.needsUpdate = true;
  }

  return {
    begin, draw, end, meshes,
    toolFor: (job) => TOOL[job] || null,
    tunicFor: (id) => SETTLER_TUNICS[id % SETTLER_TUNICS.length],
    dispose() {
      for (const k in meshes) { scene.remove(meshes[k]); meshes[k].geometry.dispose(); }
      scene.remove(glow); glowGeo.dispose(); mat.dispose(); glowMat.dispose();
    },
  };
}
