// Siege engines (Ballista, Mangonel): procedural timber-and-iron machines, instanced like the
// other low-poly props. Each engine is a carriage (static) plus a moving part: the Ballista's
// bow slides back when it looses, the Mangonel's arm swings up and is winched down again.
// View-only: reads what the units view hands it.
import * as THREE from 'three';
import { createStructureMaterial, PATTERN as P } from '../render/structure-material.js';
import { paint, place, merge, box, cyl } from '../render/geometry-kit.js';
import { flushInstances } from '../render/instancing.js';

const TIMBER = '#7a5634', DARK = '#4a3220', IRON = '#5b5f63', ROPE = '#c9b48a';

function wheels(xs, zs, r) {
  const out = [];
  for (const x of xs) for (const z of zs) {
    out.push(paint(place(cyl(r, r, 0.16, 10), { x, y: r, z, rz: Math.PI / 2 }), DARK, 0, null, P.planks));
    out.push(paint(place(cyl(r * 0.25, r * 0.25, 0.22, 6), { x, y: r, z, rz: Math.PI / 2 }), IRON, 0, null, P.metal));
  }
  return out;
}

function geometries() {
  // Ballista: a low carriage with a post, the bow on top (its own part, pivot at the post)
  const ballistaBase = merge([
    ...wheels([-0.85, 0.85], [-0.7, 0.75], 0.42),
    paint(place(box(1.5, 0.22, 2.3), { y: 0.62 }), TIMBER, 0, null, P.planks),
    paint(place(box(0.12, 0.12, 1.6), { x: -0.6, y: 0.8, z: -1.6, rx: 0.5 }), TIMBER, 0, null, P.planks), // trail
    paint(place(box(0.12, 0.12, 1.6), { x: 0.6, y: 0.8, z: -1.6, rx: 0.5 }), TIMBER, 0, null, P.planks),
    paint(place(cyl(0.12, 0.16, 0.6, 6), { y: 0.98 }), DARK, 0, null, P.planks),
    paint(place(cyl(0.04, 0.04, 1.9, 5), { x: -0.62, y: 1.6, z: -0.95 }), DARK, 0, null, P.planks), // banner pole
  ]);
  const ballistaTop = merge([
    paint(place(box(0.26, 0.2, 2.4), { y: 0.1, z: 0.1 }), TIMBER, 0, null, P.planks), // stock
    paint(place(box(1.0, 0.16, 0.16), { x: -0.55, y: 0.12, z: 1.05, ry: -0.35 }), DARK, 0, null, P.planks), // bow arms
    paint(place(box(1.0, 0.16, 0.16), { x: 0.55, y: 0.12, z: 1.05, ry: 0.35 }), DARK, 0, null, P.planks),
    paint(place(box(0.34, 0.34, 0.34), { y: 0.12, z: 1.2 }), IRON, 0, null, P.metal), // torsion springs
    paint(place(box(2.0, 0.03, 0.03), { y: 0.14, z: 0.55 }), ROPE, 0, null, P.cloth), // string
    paint(place(cyl(0.035, 0.035, 1.5, 5), { y: 0.25, z: 0.6, rx: Math.PI / 2 }), '#c8b28a', 0, null, P.planks), // bolt
    paint(place(box(0.08, 0.08, 0.2), { y: 0.25, z: 1.38 }), IRON, 0, null, P.metal),
    paint(place(cyl(0.1, 0.1, 0.5, 6), { y: 0.12, z: -1.0, rz: Math.PI / 2 }), DARK, 0, null, P.planks), // winch
  ]);
  // Mangonel: a heavy frame with a cross-beam; the arm (own part) pivots low at the back
  const mangonelBase = merge([
    ...wheels([-1.0, 1.0], [-1.1, 1.1], 0.5),
    paint(place(box(1.9, 0.3, 3.2), { y: 0.72 }), TIMBER, 0, null, P.planks),
    paint(place(box(0.2, 2.0, 0.2), { x: -0.75, y: 1.8, z: 0.6, rx: -0.15 }), TIMBER, 0, null, P.planks), // uprights
    paint(place(box(0.2, 2.0, 0.2), { x: 0.75, y: 1.8, z: 0.6, rx: -0.15 }), TIMBER, 0, null, P.planks),
    paint(place(box(1.8, 0.24, 0.3), { y: 2.75, z: 0.45 }), DARK, 0, null, P.planks), // the beam the arm strikes
    paint(place(box(1.7, 0.2, 0.2), { y: 2.75, z: 0.62 }), '#8a6a3c', 0, null, P.cloth), // padding
    paint(place(cyl(0.3, 0.3, 1.6, 8), { y: 1.05, z: -0.7, rz: Math.PI / 2 }), ROPE, 0, null, P.cloth), // torsion skein
    paint(place(box(0.3, 0.55, 0.3), { x: -0.85, y: 1.05, z: -0.7 }), IRON, 0, null, P.metal),
    paint(place(box(0.3, 0.55, 0.3), { x: 0.85, y: 1.05, z: -0.7 }), IRON, 0, null, P.metal),
    paint(place(cyl(0.04, 0.04, 2.2, 5), { x: -0.9, y: 1.95, z: -1.45 }), DARK, 0, null, P.planks), // banner pole
  ]);
  // the arm rests pointing back (-z) along the frame; rotating it about x swings it up and forward
  const mangonelArm = merge([
    paint(place(box(0.2, 0.2, 2.9), { z: -1.45 }), DARK, 0, null, P.planks),
    paint(place(cyl(0.34, 0.24, 0.26, 8), { y: 0.14, z: -2.9 }), TIMBER, 0, null, P.planks), // cup
    paint(place(cyl(0.22, 0.22, 0.24, 6), { y: 0.3, z: -2.9 }), '#8b8a84', 0, null, P.stone), // the boulder
  ]);
  // the pennant on the pole, tinted per instance with its side's colour
  const pennant = (x, y, z) => place(box(0.03, 0.42, 0.62), { x, y, z: z - 0.31 });
  return {
    ballista: { base: ballistaBase, part: ballistaTop, pivot: [0, 1.28, 0], flag: pennant(-0.62, 2.3, -0.95) },
    mangonel: { base: mangonelBase, part: mangonelArm, pivot: [0, 1.05, -0.7], flag: pennant(-0.9, 2.8, -1.45) },
  };
}

export function createEngineRenderer({ scene, max = 24 }) {
  const geos = geometries();
  const mat = createStructureMaterial({ roughness: 0.85 }, 'kh-structure');
  const cloth = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide });
  const kinds = {};
  for (const [name, g] of Object.entries(geos)) {
    const mk = (geo, m0 = mat) => { const m = new THREE.InstancedMesh(geo, m0, max); m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m; };
    kinds[name] = { base: mk(g.base), part: mk(g.part), flag: mk(g.flag, cloth), pivot: new THREE.Vector3(...g.pivot), n: 0 };
    kinds[name].flag.setColorAt(0, new THREE.Color('#ffffff')); // allocate the colour buffer up front
  }
  const tint = new THREE.Color();
  const m4 = new THREE.Matrix4(), local = new THREE.Matrix4(), q = new THREE.Quaternion(), qp = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), xAxis = new THREE.Vector3(1, 0, 0);
  return {
    begin() { for (const k in kinds) kinds[k].n = 0; },
    /**
     * Draw one engine. f: { engine, x, y, z, heading, scale, since (s since the last shot), reload (s), banner (its side's colour) }.
     */
    draw(f) {
      const k = kinds[f.engine];
      if (!k || k.n >= max) return;
      const i = k.n++;
      q.setFromAxisAngle(up, f.heading || 0);
      m4.compose(p.set(f.x, f.y, f.z), q, s.setScalar(f.scale || 1));
      k.base.setMatrixAt(i, m4);
      k.flag.setMatrixAt(i, m4);
      k.flag.setColorAt(i, tint.set(f.banner || '#d8d0b8'));
      // the moving part, posed in the engine's own frame and placed at its pivot
      const t = f.since ?? 99;
      if (f.engine === 'mangonel') {
        // the arm flies up in a quarter second, then is winched down over the reload
        const fly = Math.min(1, t / 0.25), down = Math.min(1, Math.max(0, (t - 0.6) / Math.max(0.5, (f.reload || 5) - 1.2)));
        const ang = 1.75 * (fly < 1 ? fly * fly : 1 - down * down * (3 - 2 * down)); // + about x: up and over the beam
        qp.setFromAxisAngle(xAxis, ang);
        local.compose(k.pivot, qp, s.set(1, 1, 1));
      } else {
        // the bow slams back a hand's breadth and is cranked forward again
        const kick = t < 0.08 ? t / 0.08 : Math.max(0, 1 - (t - 0.08) / 0.9);
        local.makeTranslation(k.pivot.x, k.pivot.y, k.pivot.z - 0.18 * kick);
      }
      k.part.setMatrixAt(i, m4.multiply(local));
    },
    end() {
      for (const k in kinds) {
        const e = kinds[k];
        e.base.count = e.n; e.part.count = e.n; e.flag.count = e.n;
        if (e.n) { flushInstances(e.base); flushInstances(e.part); flushInstances(e.flag); }
      }
    },
    dispose() {
      for (const k in kinds) { scene.remove(kinds[k].base, kinds[k].part, kinds[k].flag); for (const m of ['base', 'part', 'flag']) kinds[k][m].geometry.dispose(); }
      mat.dispose(); cloth.dispose();
    },
  };
}
