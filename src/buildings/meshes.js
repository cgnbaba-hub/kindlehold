// Procedural building models (original designs, see ART_DIRECTION.md). Local space:
// metres, +Y up, the door faces +Z. Each model returns { body, glow, height }.
//   body: merged vertex-coloured geometry (structure material, pattern ids)
//   glow: merged geometry for windows/lanterns (emissive at night)
import * as THREE from 'three';
import { PATTERN as P } from '../render/structure-material.js';
import { paint, paintGradient, place, merge, jitterVertices, viewRng, box, cyl, cone, ico, gable, pyramid } from '../render/geometry-kit.js';
import { kaykitModel, clearKaykitCache, BUILDING_STYLE } from './kaykit.js';

const C = {
  lime: '#d6c9ad', limeDark: '#bfb193', timber: '#5f4330', timberDark: '#3f2c20', plank: '#8f6a47', plankLight: '#a88259',
  thatch: '#a8915a', thatchDark: '#8a7447', slate: '#5b646e', slateDark: '#4a525b', stone: '#8c8a82', stoneDark: '#6f6d67',
  teal: '#2f6f8f', gold: '#d1a54a', rust: '#8c3b2a', soot: '#3a302a', hide: '#7a5a3e', bone: '#d8ccb0', iron: '#4a4a4c', dark: '#1b1714',
  glow: '#ffbf6a',
};

const sphere8 = (r) => new THREE.SphereGeometry(r, 8, 6);
function b(w, h, d, color, pattern, at = {}, jitter = 0, rnd = null) { return paint(place(box(w, h, d), at), color, jitter, rnd, pattern); }
function beam(x1, y1, z1, x2, y2, z2, t, color = C.timber) {
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const len = Math.hypot(dx, dy, dz);
  const g = box(t, len, t);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyQuaternion(q);
  g.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
  return paint(g, color, 0, null, P.planks);
}
/** Gable roof with ridge beam and barge boards (trim reads well from the RTS camera). */
function roof(w, d, h, color, pattern, at) {
  const trim = pattern === P.thatch ? '#6e5a36' : C.timberDark;
  const parts = [paintGradient(gable(w, d, h), color, pattern === P.thatch ? C.thatch : color, pattern)];
  parts.push(b(0.24, 0.24, d + 0.12, trim, P.planks, { y: h + 0.02 }));
  const hw = w / 2, hd = d / 2;
  for (const z of [hd + 0.04, -hd - 0.04]) {
    parts.push(beam(-hw - 0.05, -0.05, z, 0, h + 0.05, z, 0.16, trim));
    parts.push(beam(hw + 0.05, -0.05, z, 0, h + 0.05, z, 0.16, trim));
  }
  return place(merge(parts), at);
}
function win(w, h, at) { return place(new THREE.PlaneGeometry(w, h), at); }

/** Half-timbered wall frame for a box of w×h×d sitting at y0 (beams on the long faces). */
function timberFrame(w, h, d, y0 = 0) {
  const parts = [];
  const t = 0.16;
  for (const z of [d / 2 + 0.03, -d / 2 - 0.03]) {
    parts.push(beam(-w / 2, y0 + 0.05, z, w / 2, y0 + 0.05, z, t, C.timberDark));
    parts.push(beam(-w / 2, y0 + h, z, w / 2, y0 + h, z, t, C.timberDark));
    parts.push(beam(-w / 2, y0 + h * 0.52, z, w / 2, y0 + h * 0.52, z, t * 0.8, C.timber));
    for (const x of [-w / 2, -w / 6, w / 6, w / 2]) parts.push(beam(x, y0, z, x, y0 + h, z, t, C.timberDark));
    parts.push(beam(-w / 2, y0, z, -w / 6, y0 + h * 0.52, z, t * 0.7, C.timber));
    parts.push(beam(w / 2, y0, z, w / 6, y0 + h * 0.52, z, t * 0.7, C.timber));
  }
  for (const x of [w / 2 + 0.03, -w / 2 - 0.03]) {
    parts.push(beam(x, y0, -d / 2, x, y0, d / 2, t, C.timberDark));
    parts.push(beam(x, y0 + h, -d / 2, x, y0 + h, d / 2, t, C.timberDark));
    parts.push(beam(x, y0, 0, x, y0 + h, 0, t, C.timberDark));
  }
  return parts;
}

function door(w, h, z, x = 0) {
  return [
    b(w + 0.3, h + 0.2, 0.18, C.timberDark, P.planks, { x, y: (h + 0.2) / 2, z: z + 0.02 }),
    b(w, h, 0.12, C.plank, P.planks, { x, y: h / 2, z: z + 0.1 }),
  ];
}

function chimney(x, z, y0, h) {
  return [b(0.7, h, 0.7, C.stone, P.stone, { x, y: y0 + h / 2, z }), b(0.85, 0.15, 0.85, C.stoneDark, P.stone, { x, y: y0 + h, z })];
}

function banner(x, y, z, color, rnd, h = 2.2) {
  return [
    paint(place(cyl(0.05, 0.06, h + 1.2, 5), { x, y: y + (h + 1.2) / 2, z }), C.timberDark, 0, null, P.planks),
    paint(place(cone(0.1, 0.22, 5), { x, y: y + h + 1.3, z }), C.gold, 0, null, P.metal),
    b(0.9, h * 0.62, 0.04, color, P.cloth, { x: x + 0.5, y: y + h * 0.62, z }),
    b(0.9, 0.12, 0.05, C.gold, P.cloth, { x: x + 0.5, y: y + h * 0.3, z }),
  ];
}

function logPile(x, z, n, rnd, len = 2.2) {
  const parts = [];
  let i = 0;
  for (let row = 0; row < 3 && i < n; row++) {
    for (let k = 0; k < 4 - row && i < n; k++, i++) {
      const g = cyl(0.2, 0.2, len, 7);
      place(g, { x: x + (k - (3 - row) / 2) * 0.42, y: 0.2 + row * 0.36, z, rx: Math.PI / 2 });
      paint(g, '#6e5037', 0.15, rnd, P.planks);
      parts.push(g);
      parts.push(paint(place(cyl(0.18, 0.18, 0.02, 7), { x: x + (k - (3 - row) / 2) * 0.42, y: 0.2 + row * 0.36, z: z + len / 2, rx: Math.PI / 2 }), '#c8a877', 0, null, P.plain));
    }
  }
  return parts;
}

function stoneBlocks(x, z, n, rnd) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 3), col = i % 3;
    parts.push(b(0.7, 0.45, 0.5, C.stone, P.rock, { x: x + col * 0.75 - 0.75, y: 0.23 + row * 0.46, z: z + (row % 2) * 0.1, ry: (rnd() - 0.5) * 0.2 }, 0.2, rnd));
  }
  return parts;
}

function barrel(x, z, y = 0) {
  return [
    paint(place(cyl(0.34, 0.3, 0.85, 10), { x, y: y + 0.43, z }), '#7a5638', 0, null, P.planks),
    paint(place(cyl(0.355, 0.355, 0.06, 10), { x, y: y + 0.2, z }), C.iron, 0, null, P.metal),
    paint(place(cyl(0.355, 0.355, 0.06, 10), { x, y: y + 0.66, z }), C.iron, 0, null, P.metal),
  ];
}

const MODELS = {
  keep(rnd) {
    const body = [], glow = [];
    // stone plinth
    body.push(paint(place(cyl(7.2, 7.6, 0.6, 20), { y: 0.1 }), C.stoneDark, 0, null, P.stone));
    // round tower (back)
    body.push(paint(place(cyl(3.3, 3.6, 11, 16), { z: -2.2, y: 5.5 }), C.stone, 0.06, rnd, P.stone));
    body.push(paint(place(cyl(3.7, 3.7, 0.5, 16), { z: -2.2, y: 11.1 }), C.stoneDark, 0, null, P.stone));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      body.push(b(0.8, 0.7, 0.5, C.stone, P.stone, { x: Math.sin(a) * 3.45, y: 11.7, z: -2.2 + Math.cos(a) * 3.45, ry: a }));
    }
    // brazier bowl on the tower
    body.push(paint(place(cyl(0.9, 0.5, 0.6, 10), { z: -2.2, y: 11.9 }), '#7a6e62', 0, null, P.metal));
    // hall (front)
    body.push(b(9, 4.6, 6.4, C.lime, P.plaster, { y: 2.6, z: 2.4 }));
    body.push(b(9.2, 1.0, 6.6, C.stone, P.stone, { y: 0.5, z: 2.4 }));
    body.push(...timberFrame(9, 3.6, 6.4, 1.0).map((g) => place(g, { z: 2.4 })));
    body.push(roof(7.4, 10.2, 4.2, C.slate, P.shingles, { y: 4.85, z: 2.4, ry: Math.PI / 2 }));
    body.push(...door(1.8, 2.6, 5.6));
    body.push(...chimney(2.6, 0.8, 5.2, 2.4));
    for (const x of [-3, 3]) {
      body.push(b(1.1, 1.3, 0.12, C.timberDark, P.planks, { x, y: 3.1, z: 5.62 }));
      glow.push(win(0.8, 1.0, { x, y: 3.1, z: 5.7 }));
    }
    for (const y of [4, 7.5]) { glow.push(win(0.6, 1.1, { y, z: 1.42, x: 0.0 })); }
    body.push(...banner(-4.6, 0.9, 5.4, C.teal, rnd, 2.6));
    body.push(...barrel(4.2, 5.7), ...barrel(4.9, 5.2));
    return { body, glow, height: 12.5 };
  },
  keepCharter(rnd) {
    const body = [];
    // banner tower added by the March Charter
    body.push(paint(place(cyl(1.4, 1.6, 9, 12), { x: 5.2, z: -1.6, y: 4.5 }), C.stone, 0.06, rnd, P.stone));
    body.push(paint(place(cone(2.0, 3.4, 12), { x: 5.2, z: -1.6, y: 10.7 }), C.slate, 0, null, P.shingles));
    body.push(...banner(5.2, 12.2, -1.6, C.teal, rnd, 2.2));
    body.push(b(0.08, 3, 2.4, C.teal, P.cloth, { x: 6.55, y: 6.2, z: -1.6 }));
    body.push(b(0.1, 0.25, 2.4, C.gold, P.cloth, { x: 6.56, y: 4.8, z: -1.6 }));
    return { body, glow: [], height: 13 };
  },
  cottage(rnd) {
    const body = [], glow = [];
    body.push(b(5.2, 0.5, 4.2, C.stoneDark, P.stone, { y: 0.25 }));
    body.push(b(5, 2.8, 4, C.lime, P.plaster, { y: 1.9 }));
    body.push(...timberFrame(5, 2.6, 4, 0.5));
    body.push(roof(6.2, 5.2, 3.3, C.thatchDark, P.thatch, { y: 3.3 }));
    body.push(...door(1.0, 1.9, 2.05));
    body.push(...chimney(-1.5, -0.8, 3.2, 3.0));
    for (const x of [1.4]) {
      body.push(b(0.8, 0.8, 0.12, C.timberDark, P.planks, { x, y: 1.9, z: 2.04 }));
      glow.push(win(0.55, 0.55, { x, y: 1.9, z: 2.11 }));
    }
    glow.push(place(win(0.5, 0.5, { y: 1.9, z: 0 }), { x: 2.52, ry: Math.PI / 2 }));
    for (const sx of [0.88, 1.92]) body.push(b(0.24, 0.72, 0.06, '#3f6b7a', P.planks, { x: sx, y: 1.9, z: 2.12 }));
    body.push(b(0.9, 0.18, 0.22, '#6e5037', P.planks, { x: 1.4, y: 1.42, z: 2.2 }));
    for (let i = 0; i < 4; i++) body.push(paint(place(ico(0.07, 0), { x: 1.1 + i * 0.2, y: 1.56, z: 2.22 }), i % 2 ? '#d86a8a' : '#e8d05a', 0, null, P.plain));
    body.push(...logPile(-3.15, 0.2, 4, rnd, 1.4));
    body.push(b(0.8, 0.5, 0.5, '#6e5037', P.planks, { x: -2.1, y: 0.25, z: 2.4 }));
    body.push(...barrel(2.2, 2.4));
    return { body, glow, height: 6.6 };
  },
  lodge(rnd) {
    const body = [];
    body.push(b(6.2, 0.3, 4.6, C.stoneDark, P.stone, { y: 0.15 }));
    // closed back room
    body.push(b(6, 2.6, 1.8, C.plank, P.planks, { y: 1.6, z: -1.3 }));
    for (const [x, z] of [[-2.9, 2.1], [2.9, 2.1], [-2.9, -2.1], [2.9, -2.1], [0, 2.1]]) body.push(beam(x, 0.3, z, x, 3.1, z, 0.22));
    body.push(beam(-3.1, 3.1, 2.1, 3.1, 3.1, 2.1, 0.22));
    body.push(roof(5.4, 7.2, 2.1, '#56603c', P.shingles, { y: 3.1, ry: Math.PI / 2 })); // mossy lodge roof
    body.push(...logPile(-1.2, 0.9, 9, rnd, 2.4));
    // chopping stump with axe
    body.push(paint(place(cyl(0.35, 0.4, 0.6, 9), { x: 2.2, y: 0.3, z: 3.4 }), '#6e5037', 0, null, P.planks));
    body.push(beam(2.2, 0.6, 3.4, 2.5, 1.3, 3.3, 0.06, C.timber));
    body.push(b(0.05, 0.22, 0.3, C.iron, P.metal, { x: 2.25, y: 0.68, z: 3.35 }));
    body.push(...logPile(2.4, -3.0, 5, rnd, 1.6));
    return { body, glow: [], height: 5.2 };
  },
  quarry(rnd) {
    const body = [];
    body.push(b(6.6, 0.25, 6, C.stoneDark, P.stone, { y: 0.12 }));
    // hut
    body.push(b(3, 2.3, 2.6, C.plank, P.planks, { x: -1.6, y: 1.4, z: -1.4 }));
    body.push(roof(3.6, 3.2, 1.5, '#7a746c', P.shingles, { x: -1.6, y: 2.55, z: -1.4 }));
    body.push(...door(0.9, 1.7, -0.08, -1.6));
    // A-frame crane
    body.push(beam(1.2, 0, -0.5, 2.4, 5.2, 0.4, 0.25), beam(3.6, 0, -0.5, 2.4, 5.2, 0.4, 0.25));
    body.push(beam(2.4, 5.2, 0.4, 2.4, 4.4, 3.6, 0.2));
    body.push(paint(place(cyl(0.02, 0.02, 2.8, 4), { x: 2.4, y: 3.0, z: 3.5 }), '#c9b58a', 0, null, P.plain));
    body.push(b(0.6, 0.5, 0.6, C.stone, P.rock, { x: 2.4, y: 1.55, z: 3.5 }));
    body.push(paint(place(cyl(0.45, 0.45, 0.25, 12), { x: 2.4, y: 1.0, z: -0.4, rx: Math.PI / 2 }), C.timber, 0, null, P.planks));
    body.push(...stoneBlocks(-1.2, 2.2, 7, rnd));
    return { body, glow: [], height: 5.5 };
  },
  farm(rnd) {
    const body = [], glow = [];
    body.push(b(8.8, 0.4, 4.6, C.stoneDark, P.stone, { y: 0.2 }));
    body.push(b(8.6, 2.8, 4.4, C.plankLight, P.planks, { y: 1.8 }));
    body.push(roof(5.8, 9.8, 2.8, '#8e4a32', P.shingles, { y: 3.2, ry: Math.PI / 2 })); // red clay barn roof
    body.push(b(2.4, 2.3, 0.12, C.timberDark, P.planks, { y: 1.5, z: 2.25 }));
    body.push(b(1.1, 2.1, 0.1, C.plank, P.planks, { x: -1.45, y: 1.45, z: 2.62, ry: -0.9 }));
    body.push(b(1.1, 2.1, 0.1, C.plank, P.planks, { x: 1.45, y: 1.45, z: 2.62, ry: 0.9 }));
    glow.push(win(0.5, 0.5, { x: 3.2, y: 2.2, z: 2.22 }));
    // hay bales & cart
    for (const [x, z] of [[4.8, 1.6], [5.2, 0.4], [4.9, -0.8]]) body.push(paint(place(cyl(0.6, 0.6, 1.0, 10), { x, y: 0.6, z, rx: Math.PI / 2, ry: 0.3 }), '#c8ac62', 0.12, rnd, P.thatch));
    body.push(b(1.6, 0.4, 1.0, C.plank, P.planks, { x: -5.2, y: 0.7, z: 1.4 }));
    for (const z of [0.95, 1.85]) body.push(paint(place(cyl(0.38, 0.38, 0.08, 10), { x: -5.2, y: 0.4, z, rx: Math.PI / 2 }), C.timberDark, 0, null, P.planks));
    return { body, glow, height: 6.2 };
  },
  mine(rnd) {
    const body = [];
    // rock mound
    for (const [x, y, z, r] of [[0, 1.2, -1.2, 3.0], [-2, 0.8, -0.2, 2.0], [2.1, 0.8, -0.3, 2.1], [0, 2.4, -2.2, 2.2]]) {
      const g = jitterVertices(ico(r, 1), r * 0.35, rnd);
      body.push(paintGradient(place(g, { x, y, z, sy: 0.85 }), '#5a534b', '#8a8379', P.rock));
    }
    // timber adit frame
    body.push(b(2.2, 2.4, 1.2, C.dark, P.plain, { y: 1.2, z: 1.2 }));
    body.push(beam(-1.25, 0, 1.9, -1.25, 2.7, 1.9, 0.3), beam(1.25, 0, 1.9, 1.25, 2.7, 1.9, 0.3), beam(-1.6, 2.75, 1.9, 1.6, 2.75, 1.9, 0.34));
    body.push(b(3.6, 0.3, 1.8, '#6d5a3c', P.planks, { y: 3.0, z: 1.6, rx: 0.25 }));
    // rails & ore cart
    for (const x of [-0.45, 0.45]) body.push(b(0.08, 0.08, 3.6, C.iron, P.metal, { x, y: 0.1, z: 3.2 }));
    for (let i = 0; i < 6; i++) body.push(b(1.3, 0.08, 0.2, C.timber, P.planks, { y: 0.05, z: 1.6 + i * 0.62 }));
    body.push(b(1.1, 0.6, 1.3, '#5d4633', P.planks, { y: 0.6, z: 3.9 }));
    for (let i = 0; i < 4; i++) body.push(paint(place(ico(0.22, 0), { x: -0.3 + (i % 2) * 0.5, y: 1.0, z: 3.6 + Math.floor(i / 2) * 0.5 }), '#7b4a2a', 0.2, rnd, P.rock));
    body.push(paint(place(cyl(0.05, 0.05, 1.6, 5), { x: 1.7, y: 1.1, z: 2.3 }), C.timberDark, 0, null, P.planks));
    return { body, glow: [], lantern: [1.7, 2.0, 2.3], height: 5 };
  },
  hunter(rnd) {
    const body = [], glow = [];
    body.push(b(4.2, 0.4, 3.4, C.stoneDark, P.stone, { y: 0.2 }));
    body.push(b(4, 2.3, 3.2, C.plank, P.planks, { y: 1.55 }));
    body.push(...timberFrame(4, 2.1, 3.2, 0.4));
    body.push(roof(5, 4.2, 2.4, C.thatchDark, P.thatch, { y: 2.7 }));
    body.push(...door(0.9, 1.8, 1.65));
    // antlers over the door, a drying rack with hides and a chopping block
    for (const sx of [-1, 1]) {
      body.push(beam(0, 2.55, 1.72, sx * 0.45, 3.0, 1.75, 0.05, C.bone));
      body.push(beam(sx * 0.3, 2.85, 1.74, sx * 0.4, 3.15, 1.8, 0.04, C.bone));
    }
    body.push(b(0.35, 0.3, 0.3, C.hide, P.cloth, { y: 2.5, z: 1.72 }));
    body.push(beam(2.6, 0, 0.6, 2.6, 1.9, 0.6, 0.1), beam(2.6, 0, -1.2, 2.6, 1.9, -1.2, 0.1), beam(2.6, 1.8, 0.7, 2.6, 1.8, -1.3, 0.08));
    body.push(b(0.06, 1.1, 0.8, C.hide, P.cloth, { x: 2.62, y: 1.25, z: 0.1 }), b(0.06, 0.9, 0.6, '#9a7a56', P.cloth, { x: 2.62, y: 1.35, z: -0.8 }));
    body.push(paint(place(cyl(0.35, 0.4, 0.5, 8), { x: -2.6, y: 0.25, z: 1.2 }), '#6e5037', 0, null, P.planks));
    body.push(...logPile(-2.7, -0.6, 3, rnd, 1.2));
    body.push(b(0.6, 0.6, 0.12, C.timberDark, P.planks, { x: 1.2, y: 1.6, z: 1.64 }));
    glow.push(win(0.4, 0.4, { x: 1.2, y: 1.6, z: 1.71 }));
    return { body, glow, height: 5.2 };
  },
  fisher(rnd) {
    const body = [], glow = [];
    // a low reed-thatched hut on stilts, a jetty plank, drying racks with fish and a little boat
    for (const [x, z] of [[-1.7, -1.3], [1.7, -1.3], [-1.7, 1.3], [1.7, 1.3]]) body.push(paint(place(cyl(0.12, 0.14, 0.6, 6), { x, y: 0.3, z }), C.timberDark, 0, null, P.planks));
    body.push(b(3.8, 0.2, 3.0, C.plank, P.planks, { y: 0.6 }));
    body.push(b(3.4, 1.9, 2.6, C.plank, P.planks, { y: 1.65 }));
    body.push(...timberFrame(3.4, 1.8, 2.6, 0.7));
    body.push(roof(4.2, 3.4, 2.0, '#a08850', P.thatch, { y: 2.6 }));
    body.push(...door(0.85, 1.6, 1.32));
    body.push(b(0.5, 0.5, 0.1, C.timberDark, P.planks, { x: 1.0, y: 1.8, z: 1.33 }));
    glow.push(win(0.36, 0.36, { x: 1.0, y: 1.8, z: 1.39 }));
    // drying rack with fish
    body.push(beam(-2.6, 0, 0.9, -2.6, 1.7, 0.9, 0.06), beam(-2.6, 0, -1.1, -2.6, 1.7, -1.1, 0.06), beam(-2.6, 1.6, 1.0, -2.6, 1.6, -1.2, 0.05));
    for (let i = 0; i < 5; i++) body.push(paint(place(new THREE.ConeGeometry(0.08, 0.42, 5), { x: -2.6, y: 1.35, z: 0.75 - i * 0.4, rx: Math.PI }), i % 2 ? '#9aa6ae' : '#b8c2c8', 0.1, rnd, P.metal));
    // an upturned boat and a coil of net
    body.push(paint(place(new THREE.CylinderGeometry(0.45, 0.45, 2.4, 8, 1, false, 0, Math.PI), { x: 2.5, y: 0.2, z: -0.4, rz: Math.PI / 2, ry: 0.2 }), '#6e5037', 0, null, P.planks));
    body.push(paint(place(new THREE.TorusGeometry(0.3, 0.1, 5, 10), { x: 2.3, y: 0.1, z: 1.4, rx: Math.PI / 2 }), '#8a7a5a', 0, null, P.cloth));
    body.push(paint(place(cyl(0.035, 0.035, 2.2, 4), { x: 1.9, y: 1.4, z: 1.5, rz: 0.5 }), C.timberDark, 0, null, P.planks));
    return { body, glow, height: 4.6 };
  },
  saltworks(rnd) {
    const body = [], glow = [];
    // boiling house: stone footing, timber walls, a steep shingle roof and a tall smoke stack
    body.push(b(4.4, 0.4, 3.4, C.stoneDark, P.stone, { y: 0.2 }));
    body.push(b(4, 2.2, 3, C.plank, P.planks, { y: 1.5 }));
    body.push(...timberFrame(4, 2.0, 3, 0.4));
    body.push(roof(4.8, 4.2, 2.2, C.slateDark, P.shingles, { y: 2.6 }));
    body.push(...door(0.9, 1.7, 1.55));
    body.push(...chimney(1.3, -0.6, 2.6, 2.6));
    // open-air boiling pan on a stone hearth with the fire glowing beneath
    body.push(paint(place(cyl(1.4, 1.5, 0.6, 12), { x: -3.3, y: 0.3, z: 0.6 }), C.stoneDark, 0, null, P.stone));
    body.push(paint(place(cyl(1.3, 1.1, 0.25, 14), { x: -3.3, y: 0.72, z: 0.6 }), C.iron, 0, null, P.metal));
    body.push(paint(place(cyl(1.15, 1.15, 0.04, 14), { x: -3.3, y: 0.83, z: 0.6 }), '#e8ece8', 0, null, P.plain));
    glow.push(place(new THREE.BoxGeometry(1.0, 0.18, 0.1), { x: -3.3, y: 0.25, z: 2.02 }));
    // sacks and a heap of white salt
    for (let i = 0; i < 5; i++) body.push(paint(place(sphere8(0.32), { x: 2.6 + (i % 3) * 0.55, y: 0.3 + Math.floor(i / 3) * 0.45, z: 1.2 - (i % 2) * 0.3, sy: 1.1 }), '#e6e0cc', 0.05, rnd, P.cloth));
    body.push(paintGradient(place(cone(0.9, 0.8, 8), { x: 2.8, y: 0.4, z: -1.0 }), '#d8d8d0', '#fbfbf6', P.rock));
    glow.push(win(0.45, 0.45, { x: 1.0, y: 1.8, z: 1.52 }));
    return { body, glow, height: 5.4 };
  },
  canteen(rnd) {
    const body = [], glow = [];
    body.push(b(7.4, 0.5, 5.4, C.stoneDark, P.stone, { y: 0.25 }));
    body.push(b(7.2, 1.4, 5.2, C.stone, P.stone, { y: 1.2 }));
    body.push(b(7.2, 2.0, 5.2, C.lime, P.plaster, { y: 2.9 }));
    body.push(...timberFrame(7.2, 2.0, 5.2, 1.9));
    body.push(roof(8.4, 6.4, 3.4, C.slate, P.shingles, { y: 3.9 }));
    body.push(...door(1.3, 2.1, 2.65));
    body.push(...chimney(-2.4, -1.2, 3.9, 3.6), ...chimney(2.6, 0.9, 3.9, 2.4));
    for (const x of [-2.2, 2.2]) {
      body.push(b(1.0, 0.9, 0.12, C.timberDark, P.planks, { x, y: 1.5, z: 2.64 }));
      glow.push(win(0.75, 0.65, { x, y: 1.5, z: 2.71 }));
      body.push(b(0.9, 0.8, 0.12, C.timberDark, P.planks, { x, y: 3.0, z: 2.64 }));
      glow.push(win(0.65, 0.55, { x, y: 3.0, z: 2.71 }));
    }
    // hanging tankard sign, benches and barrels outside
    body.push(beam(0.9, 3.3, 2.7, 0.9, 3.3, 3.6, 0.1, C.timberDark));
    body.push(b(0.08, 0.7, 0.7, '#7a3a2a', P.planks, { x: 0.9, y: 2.8, z: 3.4 }), b(0.1, 0.35, 0.25, C.gold, P.metal, { x: 0.93, y: 2.8, z: 3.4 }));
    for (const x of [-2.4, 2.6]) { body.push(b(1.8, 0.1, 0.5, C.plank, P.planks, { x, y: 0.5, z: 3.5 }), b(0.12, 0.45, 0.4, C.timberDark, P.planks, { x: x - 0.7, y: 0.23, z: 3.5 }), b(0.12, 0.45, 0.4, C.timberDark, P.planks, { x: x + 0.7, y: 0.23, z: 3.5 })); }
    body.push(...barrel(3.9, 1.6), ...barrel(4.0, 0.7), ...barrel(3.95, 1.15, 0.85));
    return { body, glow, height: 7.4 };
  },
  mill(rnd) {
    const body = [], glow = [];
    // a tapering stone tower mill with a timber cap; the sails turn separately (see `sails`)
    body.push(paint(place(cyl(2.9, 3.1, 0.5, 14), { y: 0.25 }), C.stoneDark, 0, null, P.stone));
    body.push(paintGradient(place(cyl(1.85, 2.6, 6.6, 14), { y: 3.8 }), C.limeDark, C.lime, P.plaster));
    for (const y of [1.2, 3.8, 6.4]) body.push(paint(place(cyl(2.62 - (y / 6.6) * 0.75, 2.66 - (y / 6.6) * 0.75, 0.14, 14), { y }), C.timberDark, 0, null, P.planks));
    body.push(paint(place(cone(2.3, 2.4, 14), { y: 8.3 }), C.thatchDark, 0, null, P.thatch));
    body.push(paint(place(cyl(0.2, 0.2, 1.4, 6), { y: 7.4, z: 2.0, rx: Math.PI / 2 }), C.timberDark, 0, null, P.planks));
    body.push(...door(0.95, 1.8, 2.55));
    body.push(b(0.6, 0.7, 0.12, C.timberDark, P.planks, { y: 4.6, z: 2.18, rx: -0.12 }));
    glow.push(win(0.4, 0.5, { y: 4.6, z: 2.26 }));
    // sacks of flour by the door and a small cart
    for (let i = 0; i < 4; i++) body.push(paint(place(sphere8(0.3), { x: 1.8 + (i % 2) * 0.5, y: 0.35 + Math.floor(i / 2) * 0.42, z: 2.1 - (i % 2) * 0.2, sy: 1.15 }), '#ece4d0', 0.05, rnd, P.cloth));
    body.push(b(1.2, 0.35, 0.8, C.plank, P.planks, { x: -2.3, y: 0.55, z: 1.6 }));
    for (const z of [1.15, 2.05]) body.push(paint(place(cyl(0.3, 0.3, 0.07, 10), { x: -2.3, y: 0.3, z, rx: Math.PI / 2 }), C.timberDark, 0, null, P.planks));
    // four lattice sails around a hub, drawn about the hub (0,0,0) and facing +Z
    const sails = [paint(place(cyl(0.32, 0.32, 0.4, 8), { rx: Math.PI / 2 }), C.timberDark, 0, null, P.planks)];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const arm = [b(0.16, 4.2, 0.12, C.timber, P.planks, { y: 2.2 }), b(0.95, 3.2, 0.04, '#e8dcc0', P.cloth, { x: 0.52, y: 2.6, z: -0.05 })];
      for (let j = 0; j < 5; j++) arm.push(b(1.0, 0.06, 0.08, C.timberDark, P.planks, { x: 0.5, y: 1.1 + j * 0.75 }));
      sails.push(place(merge(arm), { rz: a }));
    }
    return { body, glow, height: 9.6, sails: { parts: sails, at: [0, 7.4, 2.75] } };
  },
  bakery(rnd) {
    const body = [], glow = [];
    body.push(b(5.4, 0.45, 4.2, C.stoneDark, P.stone, { y: 0.22 }));
    body.push(b(5, 2.5, 3.8, C.lime, P.plaster, { y: 1.7 }));
    body.push(...timberFrame(5, 2.3, 3.8, 0.45));
    body.push(roof(5.8, 4.8, 2.6, '#8e4a32', P.shingles, { y: 2.95 }));
    body.push(...door(1.0, 1.9, 1.95, -1.2));
    body.push(b(1.2, 0.9, 0.12, C.timberDark, P.planks, { x: 1.1, y: 1.7, z: 1.94 }));
    glow.push(win(0.95, 0.65, { x: 1.1, y: 1.7, z: 2.01 }));
    // the domed bread oven built against the side wall, its mouth glowing, a tall chimney
    body.push(paint(place(sphere8(1.35), { x: 3.3, y: 0.45, z: -0.2, sy: 0.85 }), '#b8a488', 0.06, rnd, P.stone));
    body.push(b(2.4, 0.5, 2.4, C.stoneDark, P.stone, { x: 3.3, y: 0.25, z: -0.2 }));
    glow.push(place(new THREE.CircleGeometry(0.38, 10, 0, Math.PI), { x: 3.3, y: 0.55, z: 1.03 }));
    body.push(...chimney(3.6, -1.0, 0.8, 4.8));
    body.push(...chimney(-1.4, -0.9, 2.95, 2.4));
    // a sign with a loaf, a trestle with loaves, firewood for the oven
    body.push(beam(-2.8, 2.6, 2.0, -2.8, 2.6, 2.9, 0.1, C.timberDark));
    body.push(b(0.08, 0.6, 0.7, '#7a5a2a', P.planks, { x: -2.8, y: 2.15, z: 2.75 }));
    body.push(paint(place(sphere8(0.22), { x: -2.76, y: 2.15, z: 2.75, sx: 0.4, sz: 1.3 }), '#c98a42', 0, null, P.plain));
    body.push(b(1.6, 0.08, 0.6, C.plank, P.planks, { x: 0.9, y: 0.85, z: 2.7 }), b(0.1, 0.8, 0.5, C.timberDark, P.planks, { x: 0.3, y: 0.42, z: 2.7 }), b(0.1, 0.8, 0.5, C.timberDark, P.planks, { x: 1.5, y: 0.42, z: 2.7 }));
    for (let i = 0; i < 4; i++) body.push(paint(place(sphere8(0.17), { x: 0.4 + i * 0.33, y: 0.98, z: 2.7, sz: 1.5, sy: 0.7 }), i % 2 ? '#b8762e' : '#d09a52', 0, null, P.plain));
    body.push(...logPile(3.2, -2.6, 5, rnd, 1.4));
    return { body, glow, height: 6.4 };
  },
  smithy(rnd) {
    const body = [], glow = [];
    // a stone workshop with an open forge hall under a lean-to roof
    body.push(b(6.2, 0.4, 4.6, C.stoneDark, P.stone, { y: 0.2 }));
    body.push(b(3.2, 2.8, 4.0, C.stone, P.stone, { x: -1.4, y: 1.8 }, 0.05, rnd));
    body.push(roof(4.0, 4.8, 2.0, C.slateDark, P.shingles, { x: -1.4, y: 3.2, ry: Math.PI / 2 }));
    body.push(...door(0.95, 1.9, 2.05, -1.4));
    for (const [x, z] of [[1.0, 2.0], [2.9, 2.0], [2.9, -2.0]]) body.push(beam(x, 0.4, z, x, 3.0, z, 0.24));
    body.push(b(2.3, 0.14, 4.6, C.slate, P.shingles, { x: 1.95, y: 3.05, rx: 0, rz: -0.18 }));
    // the forge hearth with its hood and chimney, the anvil on a block, a quench tub
    body.push(b(1.4, 0.9, 1.2, C.stoneDark, P.stone, { x: 1.9, y: 0.85, z: -1.2 }));
    glow.push(place(new THREE.BoxGeometry(0.9, 0.12, 0.7), { x: 1.9, y: 1.32, z: -1.2 }));
    body.push(paint(place(pyramid(1.3, 1.0, 1.2), { x: 1.9, y: 2.0, z: -1.2 }), C.stoneDark, 0, null, P.stone));
    body.push(...chimney(1.9, -1.4, 2.4, 2.6));
    body.push(paint(place(cyl(0.3, 0.35, 0.6, 8), { x: 2.0, y: 0.7, z: 0.9 }), '#6e5037', 0, null, P.planks));
    body.push(b(0.8, 0.26, 0.34, C.iron, P.metal, { x: 2.0, y: 1.12, z: 0.9 }), b(0.3, 0.2, 0.2, C.iron, P.metal, { x: 2.45, y: 1.15, z: 0.9 }));
    body.push(paint(place(cyl(0.45, 0.4, 0.55, 10), { x: 3.4, y: 0.68, z: 1.2 }), '#7a5638', 0, null, P.planks));
    body.push(paint(place(cyl(0.4, 0.4, 0.02, 10), { x: 3.4, y: 0.94, z: 1.2 }), '#3a4a52', 0, null, P.plain));
    // a rack of finished tools and a pile of iron bars
    body.push(b(0.1, 1.4, 1.6, C.timberDark, P.planks, { x: -3.1, y: 1.1, z: 0.6 }));
    for (let i = 0; i < 4; i++) body.push(b(0.06, 0.9, 0.06, C.timber, P.planks, { x: -3.22, y: 1.1, z: 0.05 + i * 0.36 }), b(0.12, 0.18, 0.22, C.iron, P.metal, { x: -3.24, y: 1.62, z: 0.05 + i * 0.36 }));
    for (let i = 0; i < 5; i++) body.push(b(0.6, 0.1, 0.16, '#6f7176', P.metal, { x: 0.4 + (i % 3) * 0.05, y: 0.5 + Math.floor(i / 3) * 0.1, z: 2.5 + (i % 3) * 0.18 }));
    return { body, glow, lantern: [2.2, 2.4, 0.4], height: 5.8 };
  },
  barracks(rnd) {
    const body = [], glow = [];
    body.push(b(10.6, 1.4, 5.6, C.stone, P.stone, { y: 0.7 }));
    body.push(b(10.2, 2.6, 5.2, C.plank, P.planks, { y: 2.7 }));
    body.push(roof(6.6, 11.4, 3.2, C.slate, P.shingles, { y: 4.0, ry: Math.PI / 2 }));
    body.push(...door(1.6, 2.4, 2.8));
    for (const x of [-3.4, 3.4]) {
      body.push(b(1, 0.8, 0.12, C.timberDark, P.planks, { x, y: 2.9, z: 2.62 }));
      glow.push(win(0.7, 0.55, { x, y: 2.9, z: 2.7 }));
    }
    // weapon rack
    body.push(beam(-4.6, 0, 3.8, -4.6, 1.5, 3.8, 0.12), beam(-2.6, 0, 3.8, -2.6, 1.5, 3.8, 0.12), beam(-4.7, 1.3, 3.8, -2.5, 1.3, 3.8, 0.1));
    for (let i = 0; i < 5; i++) {
      body.push(beam(-4.4 + i * 0.4, 0.1, 3.9, -4.3 + i * 0.4, 1.9, 3.7, 0.05, C.timber));
      body.push(paint(place(cone(0.06, 0.3, 4), { x: -4.3 + i * 0.4, y: 2.05, z: 3.7 }), C.iron, 0, null, P.metal));
    }
    // training dummy
    body.push(beam(3.8, 0, 4.2, 3.8, 1.8, 4.2, 0.14), beam(3.2, 1.4, 4.2, 4.4, 1.4, 4.2, 0.1));
    body.push(paint(place(cyl(0.3, 0.3, 0.8, 8), { x: 3.8, y: 1.3, z: 4.2 }), '#b89e6a', 0, null, P.cloth));
    body.push(paint(place(ico(0.22, 1), { x: 3.8, y: 1.95, z: 4.2 }), '#b89e6a', 0, null, P.cloth));
    body.push(...banner(5.4, 0, 2.6, C.teal, rnd, 2.4));
    return { body, glow, height: 7.5 };
  },
  tower(rnd) {
    const body = [], glow = [];
    body.push(paint(place(cyl(2.3, 2.6, 2.2, 10), { y: 1.1 }), C.stone, 0.08, rnd, P.stone));
    for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) body.push(beam(x, 2.2, z, x * 0.85, 8.2, z * 0.85, 0.3));
    body.push(beam(-1.4, 5, -1.4, 1.4, 5, 1.4, 0.14), beam(1.4, 5, -1.4, -1.4, 5, 1.4, 0.14));
    body.push(b(3.6, 0.25, 3.6, C.plank, P.planks, { y: 8.2 }));
    for (const s of [-1, 1]) {
      body.push(b(3.6, 0.9, 0.12, C.plank, P.planks, { y: 8.75, z: s * 1.75 }));
      body.push(b(0.12, 0.9, 3.6, C.plank, P.planks, { y: 8.75, x: s * 1.75 }));
    }
    for (const [x, z] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) body.push(beam(x, 8.2, z, x, 10.2, z, 0.14));
    body.push(paintGradient(place(pyramid(4.4, 4.4, 2.6), { y: 10.2 }), C.slateDark, C.slate, P.shingles));
    body.push(paint(place(cyl(0.2, 0.25, 0.4, 8), { y: 9.9, z: 1.2 }), C.iron, 0, null, P.metal));
    glow.push(place(new THREE.BoxGeometry(0.28, 0.3, 0.28), { y: 9.55, z: 1.2 }));
    body.push(...door(0.9, 1.6, 2.3));
    return { body, glow, height: 12.8 };
  },
  warhall(rnd) {
    const body = [], glow = [];
    body.push(b(12.4, 0.5, 7.4, C.soot, P.stone, { y: 0.25 }));
    body.push(b(12, 3.4, 7, '#5b4331', P.planks, { y: 2.2 }));
    // hide roof: steep, dark rust cloth
    body.push(paintGradient(place(gable(8.6, 13.4, 4.6), { y: 3.8, ry: Math.PI / 2 }), '#5b2a20', C.rust, P.cloth));
    for (let i = -2; i <= 2; i++) body.push(beam(i * 2.6, 3.9, 4.3, i * 2.6 + 0.2, 9.1, 0.0, 0.2, C.timberDark));
    body.push(...door(2.2, 2.8, 3.55));
    for (const x of [-4, 4]) glow.push(win(0.9, 0.5, { x, y: 3.1, z: 3.56 }));
    // horn totems
    for (const x of [-3.2, 3.2]) {
      body.push(beam(x, 0, 5.0, x, 3.6, 5.0, 0.3, C.timberDark));
      for (const s of [-1, 1]) body.push(paint(place(cone(0.16, 1.2, 6), { x: x + s * 0.5, y: 3.9, z: 5.0, rz: -s * 0.9 }), C.bone, 0, null, P.plain));
      body.push(b(0.8, 1.1, 0.06, C.rust, P.cloth, { x, y: 2.4, z: 5.18 }));
    }
    for (let i = 0; i < 4; i++) body.push(...barrel(-5.5 + i * 0.8, -4.2));
    return { body, glow, height: 9 };
  },
  brigandhall(rnd) {
    const body = [], glow = [];
    body.push(b(11.4, 0.5, 6.4, C.stoneDark, P.stone, { y: 0.25 }));
    body.push(b(11, 3.0, 6, '#6e5037', P.planks, { y: 2 }));
    body.push(paintGradient(place(gable(7.4, 12.4, 4.2), { y: 3.5, ry: Math.PI / 2 }), '#4f5a3a', '#6f7a4a', P.thatch));
    body.push(...door(2.0, 2.6, 3.05));
    for (const x of [-3.6, 3.6]) glow.push(win(0.8, 0.5, { x, y: 2.8, z: 3.06 }));
    // antler gable, green banners, drying racks and a fire pit
    for (const s of [-1, 1]) { body.push(beam(0, 7.4, 6.3, s * 0.9, 8.4, 6.5, 0.08, C.bone)); body.push(beam(0, 7.4, -6.3, s * 0.9, 8.4, -6.5, 0.08, C.bone)); }
    body.push(...banner(-4.8, 0.5, 3.6, '#4f6a3a', rnd, 2.4), ...banner(4.8, 0.5, 3.6, '#4f6a3a', rnd, 2.4));
    body.push(beam(-6.6, 0, -1.5, -6.6, 2.0, -1.5, 0.1), beam(-6.6, 0, 1.5, -6.6, 2.0, 1.5, 0.1), beam(-6.6, 1.9, -1.6, -6.6, 1.9, 1.6, 0.08));
    body.push(b(0.06, 1.0, 1.2, C.hide, P.cloth, { x: -6.62, y: 1.3 }));
    body.push(paint(place(cyl(0.9, 1.0, 0.3, 10), { x: 6.8, y: 0.15, z: 1.5 }), C.stoneDark, 0, null, P.stone));
    glow.push(place(ico(0.35, 0), { x: 6.8, y: 0.5, z: 1.5 }));
    return { body, glow, height: 8.5 };
  },
  varrkeep(rnd) {
    const body = [], glow = [];
    const RED = '#8a1c2c', TILE = '#7a3a32';
    body.push(b(13.4, 0.7, 8.4, C.stoneDark, P.stone, { y: 0.35 }));
    // two-storey stone hall with a red-tiled roof
    body.push(b(12, 5.6, 7, C.stone, P.stone, { y: 3.4 }, 0.05, rnd));
    body.push(b(12.2, 0.4, 7.2, C.stoneDark, P.stone, { y: 6.2 }));
    body.push(paintGradient(place(gable(8.2, 12.8, 3.8), { y: 6.4, ry: Math.PI / 2 }), '#5e2a24', TILE, P.shingles));
    // square keep tower on the left with crenels and a banner
    body.push(b(4.6, 12, 4.6, C.stone, P.stone, { x: -6.4, y: 6, z: -1 }, 0.05, rnd));
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      body.push(b(0.8, 0.8, 0.5, C.stone, P.stone, { x: -6.4 + (i - 1.5) * 1.15, y: 12.4, z: -1 + s * 2.25 }));
      body.push(b(0.5, 0.8, 0.8, C.stone, P.stone, { x: -6.4 + s * 2.25, y: 12.4, z: -1 + (i - 1.5) * 1.15 }));
    }
    body.push(...banner(-6.4, 12.4, -1, RED, rnd, 2.4));
    // gatehouse porch with a pointed arch and two crimson hangings
    body.push(b(4, 4.4, 1.6, C.stone, P.stone, { y: 2.2, z: 4.2 }));
    body.push(paintGradient(place(gable(2.2, 4.2, 1.4), { y: 4.4, z: 4.2 }), '#5e2a24', TILE, P.shingles));
    body.push(...door(2.0, 3.0, 5.02));
    for (const x of [-3.6, 3.6]) body.push(b(1.2, 3.2, 0.06, RED, P.cloth, { x, y: 3.6, z: 3.54 }), b(1.2, 0.18, 0.07, C.gold, P.cloth, { x, y: 2.1, z: 3.55 }));
    for (const x of [-3.6, 0, 3.6]) glow.push(win(0.7, 1.1, { x, y: 5.3, z: 3.52 }));
    glow.push(win(0.6, 1.0, { x: -6.4, y: 9, z: 1.32 }));
    body.push(...barrel(5.6, 4.6), ...barrel(6.3, 4.1));
    return { body, glow, height: 14 };
  },
  varrtower(rnd) {
    const body = [], glow = [];
    body.push(b(3.8, 0.5, 3.8, C.stoneDark, P.stone, { y: 0.25 }));
    body.push(b(3.4, 9, 3.4, C.stone, P.stone, { y: 4.7 }, 0.06, rnd));
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      body.push(b(0.8, 0.8, 0.5, C.stone, P.stone, { x: (i - 1) * 1.2, y: 9.6, z: s * 1.6 }));
      body.push(b(0.5, 0.8, 0.8, C.stone, P.stone, { x: s * 1.6, y: 9.6, z: (i - 1) * 1.2 }));
    }
    body.push(...banner(1.3, 9.2, 1.3, '#8a1c2c', rnd, 1.6));
    glow.push(win(0.4, 0.8, { y: 6.5, z: 1.72 }));
    body.push(...door(1.0, 1.8, 1.72));
    return { body, glow, height: 11 };
  },
  staghall(rnd) {
    // the Chapterhouse: a pale curtain wall with four corner turrets, a gatehouse to the south
    // and a steep-roofed chapter hall with a spire inside
    const body = [], glow = [];
    const WHITE = '#d8d4c8', WHITE2 = '#c4c0b4', GREEN = '#2e5a3a', ROOF = '#3e4e46';
    body.push(b(16.4, 0.5, 16.4, C.stoneDark, P.stone, { y: 0.25 }));
    for (const s of [-1, 1]) {
      body.push(b(15, 3.4, 1.0, WHITE, P.stone, { y: 1.9, z: s * 7.2 }, 0.04, rnd));
      body.push(b(1.0, 3.4, 15, WHITE, P.stone, { x: s * 7.2, y: 1.9 }, 0.04, rnd));
      for (let i = 0; i < 6; i++) {
        body.push(b(0.8, 0.6, 1.0, WHITE2, P.stone, { x: -5.5 + i * 2.2, y: 3.9, z: s * 7.2 }));
        body.push(b(1.0, 0.6, 0.8, WHITE2, P.stone, { x: s * 7.2, y: 3.9, z: -5.5 + i * 2.2 }));
      }
    }
    for (const [x, z] of [[-7.2, -7.2], [7.2, -7.2], [-7.2, 7.2], [7.2, 7.2]]) {
      body.push(paint(place(cyl(1.5, 1.7, 5.6, 10), { x, y: 2.8, z }), WHITE, 0.04, rnd, P.stone));
      body.push(paintGradient(place(cone(1.9, 2.4, 10), { x, y: 6.8, z }), '#2e3a34', ROOF, P.shingles));
    }
    // gatehouse on the south wall
    body.push(b(4.6, 5.4, 2.2, WHITE, P.stone, { y: 2.7, z: 7.3 }, 0.04, rnd));
    for (let i = 0; i < 4; i++) body.push(b(0.7, 0.7, 2.2, WHITE2, P.stone, { x: -1.7 + i * 1.14, y: 5.75, z: 7.3 }));
    body.push(...door(2.2, 3.2, 8.42));
    for (const x of [-1.8, 1.8]) body.push(b(1.0, 2.6, 0.06, GREEN, P.cloth, { x, y: 3.6, z: 8.44 }), b(0.5, 0.5, 0.07, WHITE, P.cloth, { x, y: 4.0, z: 8.46, rz: Math.PI / 4 }));
    // chapter hall: long nave with a steep roof and a spire over the crossing
    body.push(b(6, 6, 9, WHITE, P.stone, { y: 3.5, z: -1.4 }, 0.05, rnd));
    body.push(paintGradient(place(gable(6.6, 9.4, 3.6), { y: 6.5, z: -1.4 }), '#2e3a34', ROOF, P.shingles));
    body.push(b(2.6, 4, 2.6, WHITE, P.stone, { y: 8.4, z: -3.4 }));
    body.push(paintGradient(place(cone(1.9, 4.6, 4), { y: 12.7, z: -3.4, ry: Math.PI / 4 }), '#2e3a34', ROOF, P.shingles));
    body.push(...banner(0, 14.9, -3.4, GREEN, rnd, 2.2));
    for (const x of [-3.02, 3.02]) for (const z of [-4.2, -1.4, 1.4]) glow.push(win(0.6, 1.4, { x, y: 4.2, z, ry: x < 0 ? -Math.PI / 2 : Math.PI / 2 }));
    glow.push(win(1.2, 1.6, { y: 4.6, z: 3.12 }));
    body.push(...banner(-7.2, 5.4, 7.2, GREEN, rnd, 1.8), ...banner(7.2, 5.4, 7.2, GREEN, rnd, 1.8));
    body.push(...barrel(4.8, 4.4), ...barrel(5.5, 3.8), ...barrel(-5, -5));
    return { body, glow, height: 16 };
  },
  stagtower(rnd) {
    const body = [];
    body.push(b(3.8, 0.5, 3.8, C.stoneDark, P.stone, { y: 0.25 }));
    body.push(paint(place(cyl(2.0, 2.3, 7, 10), { y: 3.7 }), '#d8d4c8', 0.05, rnd, P.stone));
    // a crenellated parapet with a small roofed lookout for the longbowman
    body.push(paint(place(cyl(2.5, 2.3, 0.6, 12), { y: 7.4 }), '#c4c0b4', 0, null, P.stone));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; body.push(b(0.6, 0.6, 0.45, '#d8d4c8', P.stone, { x: Math.sin(a) * 2.3, y: 8.0, z: Math.cos(a) * 2.3, ry: a })); }
    body.push(paint(place(cyl(1.2, 1.2, 1.4, 8), { y: 8.4 }), '#d8d4c8', 0, null, P.stone));
    body.push(paintGradient(place(cone(1.7, 1.9, 8), { y: 10.0 }), '#2e3a34', '#3e4e46', P.shingles));
    body.push(...banner(1.8, 8.3, 1.8, '#2e5a3a', rnd, 1.6));
    body.push(...door(1.0, 1.8, 2.2));
    return { body, glow: [win(0.4, 0.8, { y: 5.4, z: 2.15 })], height: 11 };
  },
  morrowhold(rnd) {
    // Morrow Hold: a squat black-stone keep on a plinth, a gatehouse with a gold portcullis,
    // flanking bastions and a smithy chimney (the house lives on its mines)
    const body = [], glow = [];
    const DARK = '#5e5e66', DARK2 = '#4e4e56', GOLD = '#d0a030', ROOF = '#34343c';
    body.push(b(17, 1.2, 15, C.stoneDark, P.stone, { y: 0.6 }));
    body.push(b(14, 5, 1.2, DARK, P.stone, { y: 3.6, z: 6.6 }, 0.04, rnd));
    body.push(b(14, 5, 1.2, DARK, P.stone, { y: 3.6, z: -6.6 }, 0.04, rnd));
    for (const s of [-1, 1]) body.push(b(1.2, 5, 14, DARK, P.stone, { x: s * 6.6, y: 3.6 }, 0.04, rnd));
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
      body.push(b(0.8, 0.7, 1.2, DARK2, P.stone, { x: -5.5 + i * 2.2, y: 6.4, z: s * 6.6 }));
      body.push(b(1.2, 0.7, 0.8, DARK2, P.stone, { x: s * 6.6, y: 6.4, z: -5.5 + i * 2.2 }));
    }
    // the great keep: a tall block with a steep slate roof and a gold banner
    body.push(b(8, 10, 7, DARK, P.stone, { y: 6.2, z: -1.5 }, 0.05, rnd));
    body.push(paintGradient(place(pyramid(8.6, 7.6, 4), { y: 11.2, z: -1.5 }), '#1e1e22', ROOF, P.shingles));
    body.push(...banner(0, 15.2, -1.5, GOLD, rnd, 2.4));
    for (const x of [-2.2, 0, 2.2]) glow.push(win(0.6, 1.4, { x, y: 8.6, z: 2.02 }));
    // corner bastions
    for (const [x, z] of [[-6.8, -6.8], [6.8, -6.8], [-6.8, 6.8], [6.8, 6.8]]) {
      body.push(b(3.2, 7.4, 3.2, DARK2, P.stone, { x, y: 4.5, z }, 0.05, rnd));
      for (let i = 0; i < 4; i++) body.push(b(0.7, 0.7, 0.7, DARK, P.stone, { x: x + (i % 2 ? 1.2 : -1.2), y: 8.6, z: z + (i < 2 ? 1.2 : -1.2) }));
    }
    // gatehouse
    body.push(b(5, 7, 2.4, DARK2, P.stone, { y: 4.1, z: 7.2 }, 0.04, rnd));
    body.push(...door(2.4, 3.6, 8.42));
    for (let i = 0; i < 5; i++) body.push(b(0.08, 3.4, 0.08, GOLD, P.metal, { x: -1.0 + i * 0.5, y: 2.9, z: 8.48 }));
    for (const x of [-1.9, 1.9]) body.push(b(1.0, 2.8, 0.06, GOLD, P.cloth, { x, y: 5.6, z: 8.44 }));
    // smithy chimney with a glow
    body.push(b(1.4, 6, 1.4, DARK2, P.stone, { x: 4.4, y: 7, z: -4 }));
    glow.push(place(ico(0.4, 0), { x: 4.4, y: 10.2, z: -4 }));
    body.push(...barrel(-4.6, 4.2), ...barrel(-5.2, 3.5));
    return { body, glow, height: 16 };
  },
  morrowtower(rnd) {
    const body = [];
    const DARK = '#5e5e66', DARK2 = '#4e4e56';
    body.push(b(4.4, 0.6, 4.4, C.stoneDark, P.stone, { y: 0.3 }));
    body.push(b(4, 6.4, 4, DARK, P.stone, { y: 3.8 }, 0.06, rnd));
    body.push(b(4.4, 0.5, 4.4, DARK2, P.stone, { y: 7.2 }));
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      body.push(b(0.8, 0.8, 0.5, DARK, P.stone, { x: (i - 1) * 1.4, y: 7.8, z: s * 2 }));
      body.push(b(0.5, 0.8, 0.8, DARK, P.stone, { x: s * 2, y: 7.8, z: (i - 1) * 1.4 }));
    }
    body.push(...banner(1.6, 7.6, 1.6, '#d0a030', rnd, 1.6));
    body.push(...door(1.1, 1.9, 2.02));
    return { body, glow: [win(0.4, 0.8, { y: 5, z: 2.02 })], height: 9.5 };
  },
  brigandtower(rnd) {
    const m = MODELS.reavertower(rnd);
    m.body[m.body.length - 2] = paintGradient(place(cone(2.3, 2.2, 7), { y: 8.4 }), '#4f5a3a', '#6f7a4a', P.thatch);
    return m;
  },
  reavertower(rnd) {
    const body = [];
    for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) body.push(beam(x * 1.2, 0, z * 1.2, x, 6.2, z, 0.26, C.timberDark));
    body.push(beam(-1.3, 3, -1.3, 1.3, 3, 1.3, 0.14, C.timberDark));
    body.push(b(3, 0.25, 3, '#5b4331', P.planks, { y: 6.2 }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      body.push(beam(Math.sin(a) * 1.4, 6.2, Math.cos(a) * 1.4, Math.sin(a) * 1.45, 7.4, Math.cos(a) * 1.45, 0.16, '#5b4331'));
    }
    body.push(paintGradient(place(cone(2.3, 2.2, 7), { y: 8.4 }), '#5b2a20', C.hide, P.cloth));
    body.push(paint(place(cone(0.14, 1.0, 6), { y: 9.9, rz: 0.4 }), C.bone, 0, null, P.plain));
    return { body, glow: [], height: 10 };
  },
};

/** Staked outline + material piles shown at the start of construction. */
function siteStage(radius, rnd) {
  const body = [];
  const n = Math.max(6, Math.round(radius * 2.2));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    body.push(beam(Math.sin(a) * radius, 0, Math.cos(a) * radius, Math.sin(a) * radius, 0.7, Math.cos(a) * radius, 0.08, '#b8995f'));
  }
  body.push(paint(place(new THREE.TorusGeometry(radius, 0.02, 3, 40), { y: 0.55, rx: Math.PI / 2 }), '#e6dcc0', 0, null, P.plain));
  // trodden, cleared footprint and bigger material stacks
  body.push(...logPile(-radius * 0.45, radius * 0.25, 9, rnd, 2.4));
  body.push(...stoneBlocks(radius * 0.4, -radius * 0.3, 8, rnd));
  body.push(...stoneBlocks(-radius * 0.35, -radius * 0.45, 5, rnd));
  return merge(body);
}

/** Scaffolding around a building footprint. */
function scaffold(radius, height) {
  const parts = [];
  const r = radius * 0.92;
  const h = height * 0.75;
  for (const [x, z] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, r], [0, -r], [r, 0], [-r, 0]]) parts.push(beam(x, 0, z, x, h, z, 0.12, '#9a7a4f'));
  for (let y = 1.6; y < h; y += 1.8) {
    parts.push(beam(-r, y, r, r, y, r, 0.1, '#9a7a4f'), beam(-r, y, -r, r, y, -r, 0.1, '#9a7a4f'));
    parts.push(beam(r, y, -r, r, y, r, 0.1, '#9a7a4f'), beam(-r, y, -r, -r, y, r, 0.1, '#9a7a4f'));
    parts.push(b(r * 2, 0.06, 0.5, '#b08d5c', P.planks, { y: y + 0.05, z: r + 0.3 }));
  }
  return merge(parts);
}

function rubble(radius, rnd) {
  const parts = [];
  const n = Math.round(radius * 4);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * radius * 0.9;
    if (rnd() > 0.5) parts.push(b(0.4 + rnd() * 0.6, 0.3 + rnd() * 0.4, 0.4 + rnd() * 0.5, rnd() > 0.5 ? '#3b3632' : '#58534d', P.rock, { x: Math.sin(a) * r, y: 0.2, z: Math.cos(a) * r, ry: rnd() * 3 }));
    else parts.push(beam(Math.sin(a) * r, 0.15, Math.cos(a) * r, Math.sin(a + 0.3) * (r + 1.5), 0.4 + rnd(), Math.cos(a + 0.3) * (r + 1.5), 0.18, '#1f1a16'));
  }
  return merge(parts);
}

// Upgrade dressings: extra parts merged onto the base model for levels 2 and 3.
function crenelRing(r, y, z0, from, to, n, rnd) {
  const parts = [];
  for (let i = 0; i <= n; i++) {
    const a = from + (to - from) * (i / n);
    parts.push(b(0.7, 0.6, 0.6, C.stone, P.stone, { x: Math.sin(a) * r, y, z: z0 + Math.cos(a) * r, ry: a }, 0.08, rnd));
  }
  return parts;
}
function roundTower(x, z, r, h, rnd, roofColor = C.slate) {
  return [
    paint(place(cyl(r, r * 1.08, h, 12), { x, z, y: h / 2 }), C.stone, 0.06, rnd, P.stone),
    paint(place(cone(r * 1.35, r * 2.2, 12), { x, z, y: h + r * 1.1 }), roofColor, 0, null, P.shingles),
  ];
}
function leanTo(x, z, rnd) {
  const parts = [];
  for (const [dx, dz] of [[-1.1, -0.9], [1.1, -0.9], [-1.1, 0.9], [1.1, 0.9]]) parts.push(b(0.18, 2.1, 0.18, C.timberDark, P.planks, { x: x + dx, y: 1.05, z: z + dz }));
  parts.push(b(2.7, 0.14, 2.3, C.plank, P.planks, { x, y: 2.2, z, rx: 0.18 }));
  return parts;
}
function hangingSign(x, z, color) {
  return [
    b(0.12, 2.6, 0.12, C.timberDark, P.planks, { x, y: 1.3, z }),
    b(0.9, 0.1, 0.1, C.timberDark, P.planks, { x: x + 0.4, y: 2.5, z }),
    b(0.75, 0.55, 0.06, color, P.planks, { x: x + 0.5, y: 2.05, z }),
    b(0.35, 0.25, 0.07, C.gold, P.metal, { x: x + 0.5, y: 2.05, z: z + 0.02 }),
  ];
}
const LEVEL_EXTRAS = {
  keep: {
    2: (rnd) => { // Castle: curtain wall around the back, a second tower
      const body = [];
      const r = 6.9, from = Math.PI * 0.42, to = Math.PI * 1.58, n = 10;
      for (let i = 0; i < n; i++) {
        const a0 = from + (to - from) * (i / n), a1 = from + (to - from) * ((i + 1) / n);
        const am = (a0 + a1) / 2, len = 2 * r * Math.sin((a1 - a0) / 2) + 0.2;
        body.push(b(len, 2.4, 0.8, C.stone, P.stone, { x: Math.sin(am) * r, y: 1.2, z: 0.6 + Math.cos(am) * r, ry: am }, 0.06, rnd));
      }
      body.push(...crenelRing(r, 2.7, 0.6, from, to, 18, rnd));
      body.push(...roundTower(-5.4, -3.4, 1.5, 8.5, rnd));
      body.push(...banner(-5.4, 11.6, -3.4, C.teal, rnd, 1.8));
      return { body, glow: [win(0.5, 0.9, { x: -5.4, y: 6, z: -1.85 })] };
    },
    3: (rnd) => { // Fortress: gate turrets in front, taller corner tower
      const body = [];
      for (const x of [-3.4, 3.4]) {
        body.push(...roundTower(x, 6.7, 0.95, 5.2, rnd));
        body.push(...banner(x, 7.8, 6.7, C.teal, rnd, 1.4));
      }
      body.push(b(5.6, 0.5, 0.6, C.stoneDark, P.stone, { y: 4.3, z: 6.7 }));
      body.push(...roundTower(5.6, -4.4, 1.3, 11, rnd));
      return { body, glow: [win(0.45, 0.8, { x: -3.4, y: 3.6, z: 7.66 }), win(0.45, 0.8, { x: 3.4, y: 3.6, z: 7.66 })] };
    },
  },
  cottage: {
    2: () => ({ // Stone House: stone ground storey and a slate roof
      body: [b(5.14, 1.2, 4.14, C.stone, P.stone, { y: 1.1 }), roof(6.4, 5.4, 3.4, C.slate, P.shingles, { y: 3.32 })],
      glow: [],
    }),
    3: (rnd) => { // Townhouse: side wing, dormer, second chimney
      const body = [b(2.8, 0.5, 3.6, C.stoneDark, P.stone, { x: -3.9, y: 0.25 }), b(2.6, 2.3, 3.4, C.lime, P.plaster, { x: -3.9, y: 1.65 })];
      body.push(...timberFrame(2.6, 2.1, 3.4, 0.5).map((g) => place(g, { x: -3.9 })));
      body.push(roof(3.6, 3.0, 2.2, C.slate, P.shingles, { x: -3.9, y: 2.8, ry: Math.PI / 2 }));
      body.push(b(1.3, 1.1, 1.4, C.lime, P.plaster, { x: 0.9, y: 4.25, z: 1.2 }), roof(1.6, 1.6, 0.8, C.slate, P.shingles, { x: 0.9, y: 4.8, z: 1.2, ry: Math.PI / 2 }));
      body.push(...chimney(1.8, -1.2, 3.4, 2.8));
      return { body, glow: [win(0.5, 0.5, { x: 0.9, y: 4.25, z: 1.92 }), win(0.55, 0.55, { x: -3.9, y: 1.7, z: 1.74 })] };
    },
  },
};
for (const t of ['lodge', 'quarry', 'farm', 'mine', 'hunter', 'fisher', 'saltworks', 'canteen', 'mill', 'bakery', 'smithy']) {
  LEVEL_EXTRAS[t] = {
    2: (rnd) => ({ body: [...leanTo(-3.4, -1.6, rnd), ...hangingSign(1.9, 3.9, t === 'mine' ? C.rust : C.teal), ...barrel(-3.8, -1.2), ...barrel(-3.0, -2.1)], glow: [] }),
    // level 3 (tools from the Smithy): a stone store with a slate roof and a guild banner
    3: (rnd) => ({
      body: [b(2.2, 1.8, 1.8, C.stone, P.stone, { x: 3.6, y: 0.9, z: -2.4 }, 0.05, rnd), roof(2.6, 2.2, 1.1, C.slate, P.shingles, { x: 3.6, y: 1.8, z: -2.4 }), ...banner(-2.6, 0, 3.4, C.gold, rnd, 1.8)],
      glow: [],
    }),
  };
}

const cache = new Map();
// modelled buildings (KayKit, see kaykit.js); null = the procedural models everywhere
let kaykitAssets = null;
/** Switch the building style: baked KayKit models where a type has one, or null for procedural. */
export function setBuildingAssets(assets) {
  if (assets === kaykitAssets) return;
  disposeBuildingGeometries();
  kaykitAssets = assets;
}

/** Where a building's chimney smoke rises in local space, when its model says (else null). */
export function chimneyOf(type, level = 1) {
  const s = kaykitAssets && BUILDING_STYLE[type];
  if (!s) return null;
  let smoke = s.smoke || null;
  for (let l = 2; l <= level; l++) if (s.level && s.level[l] && s.level[l].smoke) smoke = s.level[l].smoke;
  return smoke;
}

/** Build (and cache) the geometries for a building type. */
export function buildingGeometries(type, radius, level = 1) {
  const key = level > 1 ? `${type}:${level}` : type;
  if (cache.has(key)) return cache.get(key);
  const rnd = viewRng(type.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const km = kaykitModel(kaykitAssets, type, level);
  let model;
  if (km) {
    // a modelled building: its own props per level; windows glow, a light by the door
    const sails = km.moving[0];
    model = { body: [...km.body], glow: [...km.glow], height: km.height, lantern: [0, 2.4, radius * 0.9], sails: sails ? { parts: [sails.geometry], at: sails.pivot } : null };
  } else {
    model = MODELS[type](rnd);
    for (let l = 2; l <= level; l++) {
      const extra = LEVEL_EXTRAS[type] && LEVEL_EXTRAS[type][l];
      if (!extra) continue;
      const e = extra(rnd);
      model.body.push(...e.body);
      model.glow.push(...e.glow);
    }
  }
  const out = {
    body: merge(model.body),
    glow: model.glow.length ? mergeGlow(model.glow) : null,
    height: model.height,
    lantern: model.lantern || null,
    site: siteStage(radius, rnd),
    scaffold: scaffold(radius, model.height),
    rubble: rubble(radius, rnd),
    sails: model.sails ? merge(model.sails.parts) : null,
    sailsAt: model.sails ? model.sails.at : null,
  };
  if (type === 'keep') out.charter = merge(MODELS.keepCharter(rnd).body);
  out.levelUp = level > 1;
  cache.set(key, out);
  return out;
}

function mergeGlow(parts) {
  const geos = parts.map((g) => { const x = g.index ? g.toNonIndexed() : g; if (x.attributes.uv) x.deleteAttribute('uv'); return x; });
  return merge(geos.map((g) => { if (!g.attributes.normal) g.computeVertexNormals(); return paint(g, '#ffffff', 0, null, P.plain); }));
}

export function disposeBuildingGeometries() {
  for (const g of cache.values()) for (const k of ['body', 'glow', 'site', 'scaffold', 'rubble', 'charter', 'sails']) if (g[k]) g[k].dispose();
  cache.clear();
  clearKaykitCache();
}

export { C as BUILDING_COLORS };
