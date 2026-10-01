// Deer: instanced low-poly bodies with swinging legs and a head that dips to graze.
// View-only: reads the world, never changes it.
import * as THREE from 'three';
import { all } from '../world/world.js';
import { createStructureMaterial, PATTERN as P } from '../render/structure-material.js';
import { paint, place, merge, box, cyl, cone, ico } from '../render/geometry-kit.js';
import { flushInstances } from '../render/instancing.js';
import { createSkinnedAnimals } from './animals-skinned.js';

const MAX = 80;

function geometries() {
  const coat = '#9a6a3e', belly = '#d9c09a', dark = '#3a2818';
  const body = merge([
    paint(place(ico(0.5, 1), { y: 0.95, sx: 0.75, sy: 0.7, sz: 1.35 }), coat, 0, null, P.cloth),
    paint(place(ico(0.32, 0), { y: 0.82, z: -0.05, sx: 0.9, sy: 0.6, sz: 1.5 }), belly, 0, null, P.cloth),
    paint(place(cone(0.1, 0.25, 5), { y: 1.1, z: -0.68, rx: -2.2 }), belly, 0, null, P.cloth), // tail
  ]);
  // neck + head pivot at the shoulders (local origin), pointing forward (+z)
  const head = merge([
    paint(place(cyl(0.11, 0.16, 0.6, 6), { y: 0.22, z: 0.12, rx: 0.5 }), coat, 0, null, P.cloth),
    paint(place(box(0.2, 0.22, 0.42), { y: 0.5, z: 0.35 }), coat, 0, null, P.cloth),
    paint(place(box(0.12, 0.12, 0.14), { y: 0.46, z: 0.6 }), dark, 0, null, P.plain),
    paint(place(cone(0.05, 0.16, 4), { x: 0.1, y: 0.66, z: 0.25, rz: -0.5 }), coat, 0, null, P.cloth),
    paint(place(cone(0.05, 0.16, 4), { x: -0.1, y: 0.66, z: 0.25, rz: 0.5 }), coat, 0, null, P.cloth),
  ]);
  const antlers = merge([0.09, -0.09].flatMap((x) => [
    paint(place(cyl(0.02, 0.025, 0.42, 4), { x: x * 1.4, y: 0.82, z: 0.28, rz: x > 0 ? -0.35 : 0.35 }), '#e0d4b8', 0, null, P.plain),
    paint(place(cyl(0.015, 0.02, 0.2, 4), { x: x * 2.4, y: 0.9, z: 0.36, rx: 0.8 }), '#e0d4b8', 0, null, P.plain),
  ]));
  const leg = merge([paint(place(cyl(0.05, 0.035, 0.72, 5), { y: -0.36 }), coat, 0, null, P.cloth), paint(place(box(0.07, 0.06, 0.09), { y: -0.72 }), dark, 0, null, P.plain)]);
  return { body, head, antlers, leg };
}

export function createWildlifeView({ scene, terrain, world, animalAssets = null, camera = null }) {
  // modelled, animated animals (Quaternius) when their data loaded; the simple deer otherwise
  if (animalAssets) return skinnedView({ scene, terrain, world, assets: animalAssets, camera });
  const geos = geometries();
  const mat = createStructureMaterial({ roughness: 0.9 }, 'kh-structure');
  const mk = (g, n) => { const m = new THREE.InstancedMesh(g, mat, n); m.count = 0; m.castShadow = true; m.frustumCulled = false; scene.add(m); return m; };
  const bodies = mk(geos.body, MAX), heads = mk(geos.head, MAX), antlers = mk(geos.antlers, MAX), legs = mk(geos.leg, MAX * 4);
  const m4 = new THREE.Matrix4(), root = new THREE.Matrix4(), local = new THREE.Matrix4();
  const q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  const headDip = new Map();
  let time = 0;
  const LEG_AT = [[0.17, 0.72, 0.42], [-0.17, 0.72, 0.42], [0.17, 0.72, -0.42], [-0.17, 0.72, -0.42]];

  return {
    id: 'wildlife-view',
    kind: 'view',
    render(alpha, frame) {
      time += frame.dt || 0;
      let n = 0, nl = 0, na = 0;
      for (const a of all(world(), 'animal')) {
        if (n >= MAX) break;
        const x = a.px + (a.x - a.px) * alpha, z = a.pz + (a.z - a.pz) * alpha;
        const moving = a.anim === 'walk' || a.anim === 'run';
        const gait = a.anim === 'run' ? 11 : 6;
        const ph = time * gait + a.id;
        const bob = moving ? Math.abs(Math.sin(ph)) * (a.anim === 'run' ? 0.12 : 0.04) : 0;
        root.compose(p.set(x, terrain.height(x, z) + bob, z), q.setFromEuler(e.set(0, a.heading || 0, 0)), s.set(1.3, 1.3, 1.3)); // a touch larger than life so herds read from the RTS camera
        bodies.setMatrixAt(n, root);
        // grazing: the head eases down to the grass and back up
        const want = a.anim === 'graze' && Math.sin(time * 0.7 + a.id * 1.3) > -0.2 ? 1 : 0;
        const dip = (headDip.get(a.id) ?? 0) + (want - (headDip.get(a.id) ?? 0)) * Math.min(1, (frame.dt || 0) * 3);
        headDip.set(a.id, dip);
        local.compose(p.set(0, 1.12, 0.52), q.setFromEuler(e.set(0.2 + dip * 1.25, 0, 0)), s.set(1, 1, 1));
        m4.multiplyMatrices(root, local);
        heads.setMatrixAt(n, m4);
        if (a.id % 3 === 0) antlers.setMatrixAt(na++, m4); // stags carry antlers
        LEG_AT.forEach(([lx, ly, lz], i) => {
          const swing = moving ? Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * (a.anim === 'run' ? 0.7 : 0.4) : 0;
          local.compose(p.set(lx, ly, lz), q.setFromEuler(e.set(swing, 0, 0)), s.set(1, 1, 1));
          m4.multiplyMatrices(root, local);
          legs.setMatrixAt(nl++, m4);
        });
        n++;
      }
      bodies.count = n; heads.count = n; antlers.count = na; legs.count = nl;
      for (const m of [bodies, heads, antlers, legs]) flushInstances(m);
      if (headDip.size > MAX * 3) headDip.clear();
    },
    dispose() {
      for (const m of [bodies, heads, antlers, legs]) scene.remove(m);
      for (const k in geos) geos[k].dispose();
      mat.dispose();
    },
  };
}

function skinnedView({ scene, terrain, world, assets, camera }) {
  const herd = createSkinnedAnimals({ scene, assets, max: MAX });
  // only animals in view are skinned and drawn (each one is a few thousand triangles, twice with its shadow)
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), ball = new THREE.Sphere(new THREE.Vector3(), 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  const last = new Map(); // id -> [x, z, speed]
  const f = { id: 0, kind: 'deer', anim: 'idle', matrix: m4, dt: 0, speed: 0 };
  return {
    id: 'wildlife-view',
    kind: 'view',
    render(alpha, frame) {
      const dt = frame.dt || 0;
      herd.begin();
      if (camera) frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      let n = 0;
      for (const a of all(world(), 'animal')) {
        const x = a.px + (a.x - a.px) * alpha, z = a.pz + (a.z - a.pz) * alpha;
        const l = last.get(a.id) || [x, z, 0];
        const moved = Math.hypot(x - l[0], z - l[1]);
        const sp = dt > 0 && moved < 3 ? l[2] + (moved / dt - l[2]) * Math.min(1, dt * 6) : l[2];
        last.set(a.id, [x, z, sp]);
        const y = terrain.height(x, z);
        ball.center.set(x, y + 1, z);
        if (camera && !frustum.intersectsSphere(ball)) continue;
        if (n++ >= MAX) break;
        m4.compose(p.set(x, y, z), q.setFromAxisAngle(up, a.heading || 0), s);
        f.id = a.id; f.kind = a.id % 3 === 0 ? 'stag' : 'deer'; f.anim = a.anim || 'idle'; f.dt = dt; f.speed = sp;
        herd.draw(f);
      }
      herd.end(dt);
      if (last.size > MAX * 3) last.clear();
    },
    dispose() { herd.dispose(); },
  };
}
