// Building rendering: construction stages (staked site -> rising walls with scaffolding
// -> finished), rubble, farm plots with growing crops, window glow and pooled night lights.
import * as THREE from 'three';
import { all, structureVersion } from '../world/world.js';
import { BUILDINGS } from './defs.js';
import { buildingGeometries, disposeBuildingGeometries } from './meshes.js';
import { createStructureMaterial, PATTERN } from '../render/structure-material.js';
import { paint, place, merge, box, cyl, viewRng } from '../render/geometry-kit.js';

const LIGHTS = 6;

function cropGeometry() {
  // a tuft of thin stalks with grain heads (double-sided triangles, up-facing normals)
  const rnd = viewRng(99);
  const pos = [];
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 0.22;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 0.75 + rnd() * 0.3, w = 0.035;
    const lean = (rnd() - 0.5) * 0.18;
    const dx = Math.cos(a + 1.57) * w, dz = Math.sin(a + 1.57) * w;
    const tx = x + lean, tz = z + lean * 0.4;
    pos.push(x - dx, 0, z - dz, x + dx, 0, z + dz, tx, h, tz, x + dx, 0, z + dz, x - dx, 0, z - dz, tx, h, tz);
    // grain head: small diamond
    const hy = h * 0.82;
    pos.push(tx - 0.04, hy, tz, tx + 0.04, hy, tz, tx, h + 0.12, tz, tx + 0.04, hy, tz, tx - 0.04, hy, tz, tx, h + 0.12, tz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const n = pos.length / 3;
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(n * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const y = pos[i * 3 + 1]; const k = 0.7 + Math.min(1, y) * 0.3; col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('pattern', new THREE.BufferAttribute(new Float32Array(n).fill(PATTERN.plain), 1));
  return g;
}

function plotGeometry() {
  const parts = [paint(place(box(5.2, 0.12, 4.2), { y: 0.02 }), '#5b4431', 0, null, PATTERN.plain)];
  for (let i = 0; i < 6; i++) parts.push(paint(place(box(5.0, 0.1, 0.22), { y: 0.1, z: -1.7 + i * 0.68 }), '#6e5238', 0, null, PATTERN.plain));
  const posts = [[-2.7, -2.2], [2.7, -2.2], [-2.7, 2.2], [2.7, 2.2]];
  for (const [x, z] of posts) parts.push(paint(place(cyl(0.06, 0.07, 0.9, 5), { x, y: 0.45, z }), '#5f4330', 0, null, PATTERN.planks));
  return merge(parts);
}

export function createBuildingsView({ scene, terrain, world, renderer, sky }) {
  renderer.localClippingEnabled = true;
  const mat = createStructureMaterial({ roughness: 0.85 }, 'kh-structure');
  const glowMat = new THREE.MeshStandardMaterial({ color: '#2a1d10', emissive: '#ffb35c', emissiveIntensity: 0.2, roughness: 0.6 });
  const cropMat = createStructureMaterial({ roughness: 0.95 }, 'kh-structure');
  const group = new THREE.Group();
  group.name = 'buildings';
  scene.add(group);

  const records = new Map(); // id -> { root, parts, state }
  const cropGeo = cropGeometry();
  const plotGeo = plotGeometry();
  const MAX_PLOTS = 60;
  const plots = new THREE.InstancedMesh(plotGeo, mat, MAX_PLOTS);
  plots.receiveShadow = true; plots.count = 0; plots.frustumCulled = false;
  const crops = new THREE.InstancedMesh(cropGeo, cropMat, MAX_PLOTS * 12);
  crops.castShadow = true; crops.count = 0; crops.frustumCulled = false;
  scene.add(plots, crops);

  const lights = [];
  for (let i = 0; i < LIGHTS; i++) {
    const l = new THREE.PointLight('#ffae5a', 0, 18, 1.6);
    l.castShadow = false;
    scene.add(l);
    lights.push(l);
  }

  function groundY(b) {
    const r = BUILDINGS[b.type].radius * 0.7;
    let min = Infinity;
    for (let a = 0; a < 6; a++) min = Math.min(min, terrain.height(b.x + Math.cos(a) * r, b.z + Math.sin(a) * r));
    return Math.min(min, terrain.height(b.x, b.z)) - 0.05;
  }

  function makeRecord(b) {
    const def = BUILDINGS[b.type];
    const geos = buildingGeometries(b.type, def.radius);
    const root = new THREE.Group();
    root.position.set(b.x, groundY(b), b.z);
    root.rotation.y = b.rot || 0;
    root.userData.entityId = b.id;
    const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const siteMat = mat.clone();
    siteMat.onBeforeCompile = mat.onBeforeCompile;
    siteMat.customProgramCacheKey = mat.customProgramCacheKey;
    siteMat.clippingPlanes = [clip];
    siteMat.clipShadows = true;
    const body = new THREE.Mesh(geos.body, mat);
    body.castShadow = true; body.receiveShadow = true;
    body.userData.entityId = b.id;
    const glow = geos.glow ? new THREE.Mesh(geos.glow, glowMat) : null;
    const site = new THREE.Mesh(geos.site, mat);
    site.castShadow = true; site.receiveShadow = true; site.userData.entityId = b.id;
    const scaffold = new THREE.Mesh(geos.scaffold, mat);
    scaffold.castShadow = true;
    const rubble = new THREE.Mesh(geos.rubble, mat);
    rubble.receiveShadow = true;
    const charter = geos.charter ? new THREE.Mesh(geos.charter, mat) : null;
    if (charter) { charter.castShadow = true; charter.userData.entityId = b.id; }
    root.add(body, site, scaffold, rubble);
    if (glow) root.add(glow);
    if (charter) root.add(charter);
    group.add(root);
    return { root, body, glow, site, scaffold, rubble, charter, siteMat, clip, height: geos.height, state: null, lantern: geos.lantern };
  }

  function sync() {
    const w = world();
    const seen = new Set();
    for (const b of all(w, 'building')) {
      seen.add(b.id);
      let r = records.get(b.id);
      if (!r) { r = makeRecord(b); records.set(b.id, r); }
    }
    for (const [id, r] of records) {
      if (!seen.has(id)) {
        group.remove(r.root);
        r.siteMat.dispose();
        records.delete(id);
      }
    }
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
  const col = new THREE.Color(), green = new THREE.Color('#5f8a34'), gold = new THREE.Color('#d9b653'), seed = new THREE.Color('#6d5a3e');

  function updatePlots() {
    let pc = 0, cc = 0;
    for (const b of all(world(), 'building')) {
      if (b.type !== 'farm' || b.state !== 'active' || !b.plots) continue;
      for (const pl of b.plots) {
        if (pc >= MAX_PLOTS) break;
        const y = terrain.height(pl.x, pl.z);
        const ang = Math.atan2(pl.x - b.x, pl.z - b.z);
        m4.compose(p.set(pl.x, y, pl.z), q.setFromEuler(e.set(0, ang, 0)), s.set(1, 1, 1));
        plots.setMatrixAt(pc++, m4);
        if (pl.state === 'fallow') continue;
        const g = pl.state === 'ripe' ? 1 : pl.growth;
        col.copy(green).lerp(gold, Math.max(0, (g - 0.55) / 0.45));
        if (g < 0.08) col.copy(seed);
        for (let i = 0; i < 12; i++) {
          const lx = ((i % 4) - 1.5) * 1.2, lz = (Math.floor(i / 4) - 1) * 1.3;
          const c = Math.cos(ang), sn = Math.sin(ang);
          const wx = pl.x + lx * c + lz * sn, wz = pl.z - lx * sn + lz * c;
          const h = 0.15 + g * 1.0;
          m4.compose(p.set(wx, y, wz), q.setFromEuler(e.set(0, i * 1.3, 0)), s.set(0.9 + g * 0.4, h, 0.9 + g * 0.4));
          crops.setMatrixAt(cc, m4);
          crops.setColorAt(cc, col);
          cc++;
        }
      }
    }
    plots.count = pc; crops.count = cc;
    plots.instanceMatrix.needsUpdate = true; crops.instanceMatrix.needsUpdate = true;
    if (crops.instanceColor) crops.instanceColor.needsUpdate = true;
  }

  let lastVersion = -1;
  let plotTimer = 0;
  const camTarget = new THREE.Vector3();
  const litList = [];

  return {
    id: 'buildings-view',
    kind: 'view',
    group,
    records,
    render(alpha, frame) {
      const w = world();
      const v = structureVersion(w);
      if (v !== lastVersion) { lastVersion = v; sync(); }
      const night = sky ? sky.nightFactor : 0;
      glowMat.emissiveIntensity = 0.15 + night * 2.8;
      litList.length = 0;
      for (const b of all(w, 'building')) {
        const r = records.get(b.id);
        if (!r) continue;
        const stage = b.state === 'destroyed' ? 'rubble' : b.state === 'site' ? (b.build.progress < 0.1 ? 'staked' : 'rising') : 'done';
        if (stage !== r.state) {
          r.state = stage;
          r.site.visible = stage === 'staked' || stage === 'rising';
          r.scaffold.visible = stage === 'rising';
          r.rubble.visible = stage === 'rubble';
          r.body.visible = stage === 'rising' || stage === 'done';
          r.body.material = stage === 'rising' ? r.siteMat : mat;
          if (r.glow) r.glow.visible = stage === 'done';
        }
        if (stage === 'rising') {
          const k = (b.build.progress - 0.1) / 0.9;
          r.clip.constant = r.root.position.y + 0.3 + k * r.height;
          r.site.scale.setScalar(Math.max(0.4, 1 - k * 0.6));
        }
        if (r.charter) r.charter.visible = stage === 'done' && !!(w.players[b.owner] && w.players[b.owner].techs.charter);
        // lit buildings for the night light pool (keep only when its hearth burns)
        if (stage === 'done' && (b.type !== 'keep' || b.lit) && (r.glow || b.type === 'keep' || r.lantern)) litList.push(b);
      }
      plotTimer += frame.dt;
      if (plotTimer > 0.25 || v !== lastVersion) { plotTimer = 0; updatePlots(); }
      // night lights: nearest lit buildings to the camera target
      if (night > 0.05 && this.cameraTarget) {
        camTarget.set(this.cameraTarget.x, 0, this.cameraTarget.z);
        litList.sort((a, c) => ((a.x - camTarget.x) ** 2 + (a.z - camTarget.z) ** 2) - ((c.x - camTarget.x) ** 2 + (c.z - camTarget.z) ** 2));
      }
      for (let i = 0; i < LIGHTS; i++) {
        const l = lights[i];
        const b = litList[i];
        if (!b || night < 0.05) { l.intensity = 0; continue; }
        const r = records.get(b.id);
        const hy = b.type === 'keep' ? 12.6 : b.type === 'tower' ? 9.6 : 2.6;
        const dz = b.type === 'keep' ? -2.2 : b.type === 'tower' ? 1.2 : BUILDINGS[b.type].radius * 0.9;
        const c = Math.cos(b.rot || 0), sn = Math.sin(b.rot || 0);
        l.position.set(b.x + dz * sn, r.root.position.y + hy, b.z + dz * c);
        l.intensity = night * (b.type === 'keep' ? 60 : 22) * (0.9 + 0.1 * Math.sin(frame.time * 9 + i * 2));
        l.distance = b.type === 'keep' ? 26 : 14;
      }
    },
    cameraTarget: null,
    getHealthStatus() { return { status: 'ok', detail: `${records.size} buildings` }; },
    dispose() {
      scene.remove(group, plots, crops);
      for (const l of lights) scene.remove(l);
      for (const r of records.values()) r.siteMat.dispose();
      records.clear();
      mat.dispose(); glowMat.dispose(); cropMat.dispose(); cropGeo.dispose(); plotGeo.dispose();
      disposeBuildingGeometries();
    },
  };
}
