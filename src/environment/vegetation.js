// Vegetation & deposits rendering: resource trees (fell animation, stumps), rock outcrops
// that shrink as they are quarried, iron vein, decorative forests, grass, bushes, reeds.
import * as THREE from 'three';
import { all, structureVersion } from '../world/world.js';
import { createStructureMaterial, patchStructureShader, PATTERN } from '../render/structure-material.js';
import { paint, paintGradient, place, merge, jitterVertices, viewRng, cyl, cone, ico } from '../render/geometry-kit.js';
import { computeSplat } from '../terrain/terrain-view.js';
import { distToPolyline } from '../world/terrain-data.js';
import { BUILDINGS } from '../buildings/defs.js';

function conifer(rnd) {
  const parts = [paint(place(cyl(0.13, 0.22, 2.2, 7), { y: 1.1 }), '#5a3f2a', 0.1, rnd, PATTERN.planks)];
  const tiers = [[1.75, 2.0, 1.5], [1.4, 1.9, 2.6], [1.05, 1.7, 3.6], [0.62, 1.5, 4.55]];
  for (const [r, h, y] of tiers) {
    const g = jitterVertices(cone(r, h, 9), 0.18, rnd);
    parts.push(paintGradient(place(g, { y: y + h / 2 - 0.2, ry: rnd() * 3 }), '#1f3a24', '#3f6538', PATTERN.foliage));
  }
  return merge(parts);
}

function broadleaf(rnd) {
  const parts = [paint(place(cyl(0.16, 0.28, 2.8, 7), { y: 1.4 }), '#5e4630', 0.1, rnd, PATTERN.planks)];
  parts.push(paint(place(cyl(0.06, 0.1, 1.4, 5), { x: 0.4, y: 2.6, rz: -0.8 }), '#5e4630', 0, null, PATTERN.planks));
  const blobs = [[0, 3.9, 0, 1.55], [0.9, 3.4, 0.3, 1.15], [-0.8, 3.5, -0.4, 1.2], [0.2, 4.7, -0.3, 1.1], [-0.3, 3.2, 0.9, 1.0]];
  const greens = ['#4f6b2f', '#5d7a36', '#6a8540', '#566f32', '#627c3a'];
  blobs.forEach(([x, y, z, r], i) => {
    const g = jitterVertices(ico(r, 1), 0.28, rnd);
    parts.push(paintGradient(place(g, { x, y, z }), '#3b5226', greens[i], PATTERN.foliage));
  });
  return merge(parts);
}

function stumpGeo() {
  return merge([
    paint(place(cyl(0.22, 0.28, 0.45, 8), { y: 0.22 }), '#5a3f2a', 0, null, PATTERN.planks),
    paint(place(cyl(0.2, 0.2, 0.02, 8), { y: 0.46 }), '#c9a978', 0, null, PATTERN.plain),
  ]);
}

function rockGeo(rnd, colorA, colorB, iron = false) {
  const parts = [];
  const pieces = [[0, 0.7, 0, 1.5], [1.2, 0.5, 0.5, 1.0], [-1.0, 0.45, 0.7, 0.9], [0.3, 0.4, -1.1, 0.85]];
  for (const [x, y, z, r] of pieces) {
    const g = jitterVertices(ico(r, 1), r * 0.45, rnd);
    place(g, { x, y, z, sy: 0.8, ry: rnd() * 3 });
    paintGradient(g, colorA, colorB, PATTERN.rock);
    parts.push(g);
  }
  if (iron) {
    for (let i = 0; i < 7; i++) {
      const g = jitterVertices(ico(0.28 + rnd() * 0.2, 0), 0.1, rnd);
      place(g, { x: (rnd() - 0.5) * 2.6, y: 0.6 + rnd() * 0.9, z: (rnd() - 0.5) * 2.2 });
      paint(g, rnd() > 0.4 ? '#8a4a24' : '#3d3531', 0.15, rnd, PATTERN.metal);
      parts.push(g);
    }
  }
  return merge(parts);
}

function grassClump(rnd) {
  const pos = [];
  const col = [];
  const base = new THREE.Color('#5d7a3c'), tip = new THREE.Color('#9fae68');
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 0.25;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 0.22 + rnd() * 0.25;
    const lean = (rnd() - 0.5) * 0.25;
    const w = 0.06;
    const dx = Math.cos(a + 1.57) * w, dz = Math.sin(a + 1.57) * w;
    pos.push(x - dx, 0, z - dz, x + dx, 0, z + dz, x + lean, h, z + lean * 0.5);
    pos.push(x + dx, 0, z + dz, x - dx, 0, z - dz, x + lean, h, z + lean * 0.5);
    for (let k = 0; k < 2; k++) col.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('pattern', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(PATTERN.plain), 1));
  g.computeVertexNormals();
  // grass normals point up for soft lighting
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

function reedClump(rnd) {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const h = 1 + rnd() * 0.8;
    const x = (rnd() - 0.5) * 0.6, z = (rnd() - 0.5) * 0.6;
    const g = cyl(0.015, 0.03, h, 3);
    place(g, { x, y: h / 2, z });
    paintGradient(g, '#4d5a2c', '#9d9a5a', PATTERN.plain);
    parts.push(g);
    if (rnd() > 0.5) parts.push(paint(place(cyl(0.04, 0.04, 0.22, 5), { x, y: h, z }), '#5a3b22', 0, null, PATTERN.plain));
  }
  return merge(parts);
}

function bush(rnd) {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const g = jitterVertices(ico(0.5 + rnd() * 0.3, 1), 0.2, rnd);
    place(g, { x: (rnd() - 0.5) * 0.8, y: 0.35 + rnd() * 0.2, z: (rnd() - 0.5) * 0.8, sy: 0.8 });
    paintGradient(g, '#34491f', rnd() > 0.5 ? '#5c7634' : '#6b7d38', PATTERN.foliage);
    parts.push(g);
  }
  return merge(parts);
}

function windPatch(uniforms, strength) {
  return (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    patchStructureShader(shader);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
vec3 khIP = instanceMatrix[3].xyz;
#else
vec3 khIP = vec3(0.0);
#endif
float khSway = sin(uTime * 1.3 + khIP.x * 0.31 + khIP.z * 0.23) * 0.6 + sin(uTime * 2.7 + khIP.x * 0.9) * 0.4;
float khH = max(0.0, position.y - ${strength[1].toFixed(2)});
transformed.x += khSway * khH * ${strength[0].toFixed(3)};
transformed.z += khSway * khH * ${(strength[0] * 0.6).toFixed(3)};`);
  };
}

export function createVegetation({ scene, terrain, world, quality }) {
  const rnd = viewRng(20260924);
  const uniforms = { uTime: { value: 0 } };
  const treeMat = createStructureMaterial({ roughness: 0.9 });
  treeMat.onBeforeCompile = windPatch(uniforms, [0.03, 2.0]);
  treeMat.customProgramCacheKey = () => 'kh-tree';
  const grassMat = createStructureMaterial({ roughness: 1 });
  grassMat.onBeforeCompile = windPatch(uniforms, [0.12, 0.05]);
  grassMat.customProgramCacheKey = () => 'kh-grass';
  const rockMat = createStructureMaterial({ roughness: 0.9 });

  const geos = { conifer: conifer(rnd), broadleaf: broadleaf(rnd), stump: stumpGeo(), rock: rockGeo(rnd, '#5d5e5b', '#9b9c96'), iron: rockGeo(rnd, '#4a3e36', '#8a7a6a', true), grass: grassClump(rnd), reed: reedClump(rnd), bush: bush(rnd) };
  const deps = all(world(), 'deposit');
  const counts = { tree0: 0, tree1: 0 };
  for (const d of deps) if (d.type === 'tree') counts['tree' + (d.variant || 0)]++;

  const make = (geo, mat, n, shadow = true) => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    m.castShadow = shadow; m.receiveShadow = true;
    m.count = 0;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  };
  const cap = (n) => Math.ceil(n * 1.1) + 8;
  const meshes = {
    tree0: make(geos.conifer, treeMat, cap(counts.tree0)),
    tree1: make(geos.broadleaf, treeMat, cap(counts.tree1)),
    stump: make(geos.stump, treeMat, 120),
    rock: make(geos.rock, rockMat, 40),
    iron: make(geos.iron, rockMat, 6),
  };

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const col = new THREE.Color();

  // --- decorative, static layers -------------------------------------------------
  const map = terrain.map;
  const splat = computeSplat(terrain);
  const nearRoad = (x, z, pad) => map.roads.some((rd) => distToPolyline(x, z, rd.points) < rd.width + pad);
  const splatAt = (x, z) => {
    const i = Math.round((x + terrain.half) / terrain.step), j = Math.round((z + terrain.half) / terrain.step);
    const k = (j * terrain.n + i) * 4;
    return [splat[k], splat[k + 1], splat[k + 2], splat[k + 3]];
  };
  const decoTrees = [];
  for (let i = 0; i < 2600 && decoTrees.length < 900; i++) {
    const x = (rnd() - 0.5) * terrain.size * 0.98, z = (rnd() - 0.5) * terrain.size * 0.98;
    const edge = Math.max(Math.abs(x), Math.abs(z));
    const h = terrain.height(x, z);
    if (h < 0.8) continue;
    const dk = Math.hypot(x - map.playerStart.x, z - map.playerStart.z);
    const de = Math.hypot(x - map.enemyCamp.x, z - map.enemyCamp.z);
    if (dk < 52 || de < 34 || nearRoad(x, z, 3)) continue;
    // denser near the borders and on hills, sparse in the valley floor
    const density = edge > 96 ? 0.9 : terrain.slope(x, z) > 0.25 ? 0.5 : 0.12;
    if (rnd() > density) continue;
    if (terrain.slope(x, z) > 1.3) continue;
    decoTrees.push([x, z, rnd() < 0.7 ? 0 : 1, 0.8 + rnd() * 0.6, rnd() * 6.28]);
  }
  const decoMesh = [make(geos.conifer, treeMat, decoTrees.length), make(geos.broadleaf, treeMat, decoTrees.length)];
  for (const [x, z, v, sc, rot] of decoTrees) {
    const mesh = decoMesh[v];
    m4.compose(p.set(x, terrain.height(x, z) - 0.1, z), q.setFromEuler(e.set(0, rot, 0)), s.set(sc, sc * (0.9 + (sc % 0.2)), sc));
    mesh.setMatrixAt(mesh.count, m4);
    mesh.setColorAt(mesh.count, col.setScalar(0.85 + (rot % 0.3)));
    mesh.count++;
  }

  const grassDensity = quality ? quality.grass : 1;
  const grassCount = Math.round(9000 * grassDensity);
  const grass = make(geos.grass, grassMat, grassCount, false);
  const grassPos = [];
  for (let i = 0; i < grassCount * 3 && grassPos.length < grassCount; i++) {
    // cluster around the settlement and the valley for close-up detail
    const near = rnd() < 0.55;
    const x = near ? map.playerStart.x + (rnd() - 0.5) * 120 : (rnd() - 0.5) * terrain.size * 0.9;
    const z = near ? map.playerStart.z + (rnd() - 0.5) * 110 : (rnd() - 0.5) * terrain.size * 0.9;
    if (!terrain.inBounds(x, z, 4)) continue;
    const [g, d] = splatAt(x, z);
    if (g < 0.72 || d > 0.15 || nearRoad(x, z, 1)) continue;
    const dk = Math.hypot(x - map.playerStart.x, z - map.playerStart.z);
    if (dk < 9) continue;
    grassPos.push([x, z, 0.7 + rnd() * 0.8, rnd() * 6.28]);
  }
  const grassMatrices = [];
  for (const [x, z, sc, rot] of grassPos) {
    m4.compose(p.set(x, terrain.height(x, z) - 0.02, z), q.setFromEuler(e.set(0, rot, 0)), s.set(sc, sc, sc));
    grassMatrices.push(m4.clone());
    grass.setMatrixAt(grass.count, m4);
    grass.setColorAt(grass.count, col.setRGB(0.8 + (rot % 0.4), 0.85 + (sc % 0.2), 0.75 + (rot % 0.3)));
    grass.count++;
  }

  const bushes = make(geos.bush, treeMat, 320);
  for (let i = 0; i < 1600 && bushes.count < 320; i++) {
    const x = (rnd() - 0.5) * terrain.size * 0.92, z = (rnd() - 0.5) * terrain.size * 0.92;
    const [g] = splatAt(x, z);
    if (g < 0.6 || nearRoad(x, z, 2) || Math.hypot(x - map.playerStart.x, z - map.playerStart.z) < 30) continue;
    const sc = 0.7 + rnd() * 0.8;
    m4.compose(p.set(x, terrain.height(x, z) - 0.1, z), q.setFromEuler(e.set(0, rnd() * 6, 0)), s.set(sc, sc, sc));
    bushes.setMatrixAt(bushes.count++, m4);
  }

  const reeds = make(geos.reed, grassMat, 700, false);
  for (let i = 0; i < 12000 && reeds.count < 700; i++) {
    const x = (rnd() - 0.5) * terrain.size * 0.95, z = (rnd() - 0.5) * terrain.size * 0.95;
    const h = terrain.height(x, z);
    if (h < -0.25 || h > 0.55) continue;
    const sc = 0.8 + rnd() * 0.5;
    m4.compose(p.set(x, h - 0.05, z), q.setFromEuler(e.set(0, rnd() * 6, 0)), s.set(sc, sc, sc));
    reeds.setMatrixAt(reeds.count++, m4);
  }

  // decorative boulders on slopes
  const boulders = make(geos.rock, rockMat, 160);
  for (let i = 0; i < 3000 && boulders.count < 160; i++) {
    const x = (rnd() - 0.5) * terrain.size * 0.95, z = (rnd() - 0.5) * terrain.size * 0.95;
    const sl = terrain.slope(x, z);
    if (sl < 0.3 || terrain.height(x, z) < 1 || nearRoad(x, z, 3) || Math.hypot(x - map.playerStart.x, z - map.playerStart.z) < 40) continue;
    const sc = 0.3 + rnd() * 0.7;
    m4.compose(p.set(x, terrain.height(x, z) - 0.3 * sc, z), q.setFromEuler(e.set(rnd() * 0.4, rnd() * 6, rnd() * 0.4)), s.set(sc, sc, sc));
    boulders.setMatrixAt(boulders.count++, m4);
  }

  // --- dynamic deposits ------------------------------------------------------------
  let lastVersion = -1;
  const animTrees = [];

  function hideGrassUnderBuildings() {
    const bs = all(world(), 'building').filter((b) => b.state !== 'destroyed');
    for (let i = 0; i < grassPos.length; i++) {
      const [x, z] = grassPos[i];
      let hidden = false;
      for (const b of bs) {
        const r = BUILDINGS[b.type].radius + (b.type === 'farm' ? 12 : 0.8);
        if ((b.x - x) ** 2 + (b.z - z) ** 2 < r * r) { hidden = true; break; }
      }
      if (hidden) { m4.makeScale(0, 0, 0); grass.setMatrixAt(i, m4); } else grass.setMatrixAt(i, grassMatrices[i]);
    }
    grass.instanceMatrix.needsUpdate = true;
  }

  function rebuildDeposits() {
    const w = world();
    for (const k of ['tree0', 'tree1', 'stump', 'rock', 'iron']) meshes[k].count = 0;
    animTrees.length = 0;
    for (const d of all(w, 'deposit')) {
      const y = terrain.height(d.x, d.z);
      if (d.type === 'tree') {
        if (d.amount <= 0) {
          const mesh = meshes.stump;
          if (mesh.count < 120) { m4.compose(p.set(d.x, y - 0.05, d.z), q.setFromEuler(e.set(0, d.rot, 0)), s.set(1, 1, 1)); mesh.setMatrixAt(mesh.count++, m4); }
          // falling trunk animates for a few seconds after depletion
          if (w.tick - d.depletedTick < 20 * 30) animTrees.push({ d, mesh: meshes['tree' + (d.variant || 0)], index: meshes['tree' + (d.variant || 0)].count++ });
          continue;
        }
        const mesh = meshes['tree' + (d.variant || 0)];
        const idx = mesh.count++;
        m4.compose(p.set(d.x, y - 0.15, d.z), q.setFromEuler(e.set(0, d.rot, 0)), s.setScalar(d.scale || 1));
        mesh.setMatrixAt(idx, m4);
        { const k = ((d.id * 37) % 100) / 100, j = ((d.id * 61) % 100) / 100; col.setRGB(0.82 + k * 0.3 + j * 0.08, 0.86 + k * 0.24, 0.8 + k * 0.2 - j * 0.1); }
        mesh.setColorAt(idx, col);
        if (d.reservedBy) animTrees.push({ d, mesh, index: idx, shake: true });
      } else {
        const mesh = d.type === 'iron' ? meshes.iron : meshes.rock;
        const frac = d.type === 'iron' ? 1 : 0.45 + 0.55 * Math.max(0, d.amount) / d.maxAmount;
        if (d.amount <= 0 && d.type === 'rock') continue;
        m4.compose(p.set(d.x, y - 0.2, d.z), q.setFromEuler(e.set(0, d.rot, 0)), s.set(frac * 1.1, frac, frac * 1.1));
        mesh.setMatrixAt(mesh.count++, m4);
      }
    }
    for (const k in meshes) { meshes[k].instanceMatrix.needsUpdate = true; if (meshes[k].instanceColor) meshes[k].instanceColor.needsUpdate = true; }
  }

  let rebuildTimer = 0;
  return {
    id: 'environment-vegetation',
    kind: 'view',
    meshes,
    render(alpha, frame) {
      uniforms.uTime.value = frame.time;
      const w = world();
      const v = structureVersion(w);
      rebuildTimer += frame.dt;
      // amounts change without structural changes; refresh a few times per second
      if (v !== lastVersion || rebuildTimer > 0.5) {
        if (v !== lastVersion) hideGrassUnderBuildings();
        lastVersion = v; rebuildTimer = 0;
        rebuildDeposits();
      }
      // animate chopped / falling trees
      const t = w.tick / 20;
      for (const a of animTrees) {
        const d = a.d;
        const y = terrain.height(d.x, d.z);
        if (a.shake) {
          const sh = Math.sin(t * 22 + d.id) * 0.012;
          m4.compose(p.set(d.x, y - 0.15, d.z), q.setFromEuler(e.set(sh, d.rot, sh * 0.6)), s.setScalar(d.scale || 1));
        } else {
          const k = Math.min(1, (w.tick - d.depletedTick) / 34);
          const fall = k * k * (Math.PI / 2 - 0.08);
          const sink = Math.max(0, (w.tick - d.depletedTick - 200) / 400);
          m4.compose(p.set(d.x, y - 0.15 - sink * 1.5, d.z), q.setFromEuler(e.set(fall, d.rot, 0, 'YXZ')), s.setScalar((d.scale || 1) * (1 - sink * 0.6)));
        }
        a.mesh.setMatrixAt(a.index, m4);
        a.mesh.instanceMatrix.needsUpdate = true;
      }
    },
    getHealthStatus() { return { status: 'ok' }; },
    dispose() {
      for (const k in meshes) scene.remove(meshes[k]);
      scene.remove(decoMesh[0], decoMesh[1], grass, bushes, reeds, boulders);
      for (const k in geos) geos[k].dispose();
      treeMat.dispose(); grassMat.dispose(); rockMat.dispose();
    },
  };
}
