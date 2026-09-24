// Procedural building models (original designs, see ART_DIRECTION.md). Local space:
// metres, +Y up, the door faces +Z. Each model returns { body, glow, height }.
//   body: merged vertex-coloured geometry (structure material, pattern ids)
//   glow: merged geometry for windows/lanterns (emissive at night)
import * as THREE from 'three';
import { PATTERN as P } from '../render/structure-material.js';
import { paint, paintGradient, place, merge, jitterVertices, viewRng, box, cyl, cone, ico, gable, pyramid } from '../render/geometry-kit.js';

const C = {
  lime: '#d6c9ad', limeDark: '#bfb193', timber: '#5f4330', timberDark: '#3f2c20', plank: '#8f6a47', plankLight: '#a88259',
  thatch: '#a8915a', thatchDark: '#8a7447', slate: '#77726b', slateDark: '#5f5b55', stone: '#8c8a82', stoneDark: '#6f6d67',
  teal: '#2f6f8f', gold: '#d1a54a', rust: '#8c3b2a', soot: '#3a302a', hide: '#7a5a3e', bone: '#d8ccb0', iron: '#4a4a4c', dark: '#1b1714',
  glow: '#ffbf6a',
};

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
  body.push(paint(place(cyl(radius * 0.95, radius, 0.5, 24), { y: 0.0 }), '#7a5f44', 0, null, P.plain));
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

const cache = new Map();

/** Build (and cache) the geometries for a building type. */
export function buildingGeometries(type, radius) {
  if (cache.has(type)) return cache.get(type);
  const rnd = viewRng(type.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const model = MODELS[type](rnd);
  const out = {
    body: merge(model.body),
    glow: model.glow.length ? mergeGlow(model.glow) : null,
    height: model.height,
    lantern: model.lantern || null,
    site: siteStage(radius, rnd),
    scaffold: scaffold(radius, model.height),
    rubble: rubble(radius, rnd),
  };
  if (type === 'keep') out.charter = merge(MODELS.keepCharter(rnd).body);
  cache.set(type, out);
  return out;
}

function mergeGlow(parts) {
  const geos = parts.map((g) => { const x = g.index ? g.toNonIndexed() : g; if (x.attributes.uv) x.deleteAttribute('uv'); return x; });
  return merge(geos.map((g) => { if (!g.attributes.normal) g.computeVertexNormals(); return paint(g, '#ffffff', 0, null, P.plain); }));
}

export function disposeBuildingGeometries() {
  for (const g of cache.values()) for (const k of ['body', 'glow', 'site', 'scaffold', 'rubble', 'charter']) if (g[k]) g[k].dispose();
  cache.clear();
}

export { C as BUILDING_COLORS };
