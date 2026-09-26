// Points of interest: procedural models for the trader's camp, the lookout cairn, the old
// watch ruins and the hamlet of Millbrook. View-only: reads the world, never changes it.
import * as THREE from 'three';
import { all } from '../world/world.js';
import { createStructureMaterial, PATTERN as P } from '../render/structure-material.js';
import { paint, place, merge, box, cyl, cone, ico, gable, jitterVertices, viewRng } from '../render/geometry-kit.js';

const B = (w, h, d, c, pat, at) => paint(place(box(w, h, d), at), c, 0, null, pat);

function hut(x, z, ry, roofColor) {
  return [
    B(3, 2, 2.6, '#cdbf9f', P.plaster, { x, y: 1, z, ry }),
    paint(place(gable(3.6, 3.2, 1.8), { x, y: 2, z, ry: ry + Math.PI / 2 }), roofColor, 0, null, P.thatch),
    B(0.7, 1.4, 0.1, '#5f4330', P.planks, { x: x + Math.sin(ry) * 1.32, y: 0.7, z: z + Math.cos(ry) * 1.32, ry }),
  ];
}

function models() {
  const rnd = viewRng(7117);
  const trader = merge([
    // covered cart
    B(2.6, 0.5, 1.5, '#7a5638', P.planks, { y: 0.9 }),
    paint(place(cyl(0.45, 0.45, 0.12, 10), { x: -0.8, y: 0.45, z: 0.82, rx: Math.PI / 2 }), '#4a3526', 0, null, P.planks),
    paint(place(cyl(0.45, 0.45, 0.12, 10), { x: 0.8, y: 0.45, z: 0.82, rx: Math.PI / 2 }), '#4a3526', 0, null, P.planks),
    paint(place(cyl(0.45, 0.45, 0.12, 10), { x: -0.8, y: 0.45, z: -0.82, rx: Math.PI / 2 }), '#4a3526', 0, null, P.planks),
    paint(place(cyl(0.45, 0.45, 0.12, 10), { x: 0.8, y: 0.45, z: -0.82, rx: Math.PI / 2 }), '#4a3526', 0, null, P.planks),
    paint(place(cyl(0.72, 0.72, 2.5, 10), { y: 1.55, rz: Math.PI / 2, sy: 1, sz: 0.95 }), '#d8c9a4', 0, null, P.cloth),
    // striped tent and goods
    paint(place(cone(1.8, 2.4, 8), { x: 3.2, y: 1.2, z: -1.2 }), '#a8452e', 0, null, P.cloth),
    paint(place(cyl(0.05, 0.05, 3, 4), { x: 3.2, y: 1.5, z: -1.2 }), '#4a3526', 0, null, P.planks),
    B(0.7, 0.6, 0.7, '#8f6a47', P.planks, { x: 1.9, y: 0.3, z: 1.6 }), B(0.6, 0.5, 0.6, '#a88259', P.planks, { x: 2.6, y: 0.25, z: 1.9 }),
    paint(place(cyl(0.34, 0.3, 0.85, 10), { x: 1.6, y: 0.43, z: -1.9 }), '#7a5638', 0, null, P.planks),
    B(0.9, 0.5, 0.6, '#c9ad76', P.cloth, { x: -2.2, y: 0.25, z: 1.4 }),
  ]);
  const cairn = merge([
    ...[[0, 0.35, 0, 0.9], [0.5, 0.3, 0.6, 0.6], [-0.6, 0.3, 0.3, 0.55], [0.1, 0.9, 0.1, 0.65], [0, 1.4, 0, 0.45], [0.05, 1.8, 0.05, 0.3]].map(([x, y, z, r]) => paint(place(jitterVertices(ico(r, 0), r * 0.2, rnd), { x, y, z }), '#8c8a82', 0.1, rnd, P.rock)),
    paint(place(cyl(0.05, 0.06, 2.4, 5), { y: 2.9 }), '#4a3526', 0, null, P.planks),
    B(0.8, 0.5, 0.04, '#2f6f8f', P.cloth, { x: 0.42, y: 3.7 }),
  ]);
  const ruin = merge([
    B(6, 0.4, 5, '#6f6d67', P.stone, { y: 0.1 }),
    B(6, 2.6, 0.7, '#8c8a82', P.stone, { y: 1.3, z: -2.2 }),
    B(0.7, 1.6, 4.4, '#8c8a82', P.stone, { x: -2.7, y: 0.8, z: 0 }),
    B(0.7, 3.4, 0.7, '#8c8a82', P.stone, { x: 2.7, y: 1.7, z: -2.2 }),
    B(2.2, 0.8, 0.7, '#8c8a82', P.stone, { x: 1.2, y: 0.4, z: 2.2 }),
    paint(place(cyl(0.35, 0.35, 2.6, 8), { x: 1.4, y: 0.35, z: 0.8, rz: Math.PI / 2, ry: 0.4 }), '#9a988f', 0, null, P.stone),
    ...Array.from({ length: 7 }, (_, i) => paint(place(jitterVertices(ico(0.3 + rnd() * 0.3, 0), 0.1, rnd), { x: -2 + rnd() * 4.5, y: 0.3, z: -1.5 + rnd() * 3.5 }), '#6f6d67', 0.1, rnd, P.rock)),
    paint(place(ico(0.9, 1), { x: -0.8, y: 0.2, z: 0.6, sy: 0.4 }), '#5d6a3a', 0.15, rnd, P.foliage),
  ]);
  const chest = merge([B(0.9, 0.5, 0.6, '#6e5037', P.planks, { y: 0.25 }), B(0.95, 0.08, 0.65, '#4a4a4c', P.metal, { y: 0.3 }), B(0.2, 0.2, 0.05, '#d1a54a', P.metal, { y: 0.38, z: 0.32 })]);
  const hamlet = merge([
    ...hut(-4, -2, 0.6, '#9a8450'), ...hut(3.5, -3.5, -0.4, '#8a7447'), ...hut(0, 4, 3.0, '#a8915a'),
    paint(place(cyl(0.8, 0.9, 0.9, 10), { x: 0, y: 0.45, z: -0.2 }), '#8c8a82', 0, null, P.stone), // well
    paint(place(cone(1.1, 0.7, 4), { x: 0, y: 2.2, z: -0.2, ry: Math.PI / 4 }), '#5f4330', 0, null, P.planks),
    B(0.12, 1.8, 0.12, '#5f4330', P.planks, { x: -0.8, y: 1, z: -0.2 }), B(0.12, 1.8, 0.12, '#5f4330', P.planks, { x: 0.8, y: 1, z: -0.2 }),
    ...Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 1.6 + 2.2; return B(0.1, 0.9, 1.6, '#6e5037', P.planks, { x: Math.sin(a) * 8.5, y: 0.45, z: Math.cos(a) * 8.5, ry: a + Math.PI / 2 }); }),
  ]);
  const banner = merge([paint(place(cyl(0.05, 0.06, 3.2, 5), { y: 1.6 }), '#4a3526', 0, null, P.planks), B(0.9, 0.6, 0.04, '#2f6f8f', P.cloth, { x: 0.47, y: 2.8 })]);
  return { trader, cairn, ruin, chest, hamlet, banner };
}

export function createPoisView({ scene, terrain, world }) {
  const geos = models();
  const mat = createStructureMaterial({ roughness: 0.88 }, 'kh-structure');
  const meshes = new Map();
  return {
    id: 'pois-view',
    kind: 'view',
    render() {
      for (const p of all(world(), 'poi')) {
        let m = meshes.get(p.id);
        if (!m) {
          const g = new THREE.Group();
          g.position.set(p.x, terrain.height(p.x, p.z) - 0.05, p.z);
          g.rotation.y = (p.id * 1.7) % (Math.PI * 2);
          const body = new THREE.Mesh(geos[p.type], mat);
          body.castShadow = true; body.receiveShadow = true;
          g.add(body);
          const extra = p.type === 'ruin' ? new THREE.Mesh(geos.chest, mat) : p.type === 'hamlet' ? new THREE.Mesh(geos.banner, mat) : null;
          if (extra) { extra.castShadow = true; if (p.type === 'ruin') extra.position.set(-0.6, 0.2, 0.4); else extra.position.set(0, 0, 6); g.add(extra); }
          scene.add(g);
          m = { g, extra };
          meshes.set(p.id, m);
        }
        // the ruin's chest is carried off once found; Millbrook raises Kindlehold's banner when allied
        if (m.extra) m.extra.visible = p.type === 'ruin' ? p.state !== 'done' : p.state === 'done';
      }
    },
    dispose() {
      for (const m of meshes.values()) scene.remove(m.g);
      for (const k in geos) geos[k].dispose();
      mat.dispose();
    },
  };
}
