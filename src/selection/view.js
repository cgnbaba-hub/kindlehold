// Selection feedback: rings under selected/hovered entities, health bars, command
// markers, building placement ghost with valid/invalid tint and footprint, deposit
// range circle, hero ability targeting preview, drag box, territory border.
import * as THREE from 'three';
import { all, structureVersion } from '../world/world.js';
import { PLAYER } from '../core/contracts.js';
import { BUILDINGS } from '../buildings/defs.js';
import { buildingGeometries } from '../buildings/meshes.js';
import { checkPlacement } from '../construction/index.js';
import { ABILITIES } from '../heroes/index.js';
import { territorySources } from '../world/territory.js';
import { shroudOverlay } from '../render/structure-material.js';

const MAX_RINGS = 240;
const MAX_BARS = 240;

export function createSelectionView({ scene, terrain, world, sim, input, camera, overlay }) {
  const ringGeo = new THREE.RingGeometry(0.82, 1, 40); ringGeo.rotateX(-Math.PI / 2);
  const ringMat = shroudOverlay(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, MAX_RINGS);
  rings.count = 0; rings.frustumCulled = false; rings.renderOrder = 3;
  scene.add(rings);

  // faction discs under every soldier: tells friend from foe inside a melee at a glance
  const discGeo = new THREE.CircleGeometry(0.62, 20); discGeo.rotateX(-Math.PI / 2);
  const discMat = shroudOverlay(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false, fog: false }));
  const discs = new THREE.InstancedMesh(discGeo, discMat, 400);
  discs.count = 0; discs.frustumCulled = false; discs.renderOrder = 2;
  scene.add(discs);
  const cDiscP = new THREE.Color('#4fb8e0'), cDiscE = new THREE.Color('#e05a3a'), cDiscH = new THREE.Color('#ffd27a');

  // health bars: background + fill quads, camera-facing
  const barGeo = new THREE.PlaneGeometry(1, 1);
  const barBgMat = shroudOverlay(new THREE.MeshBasicMaterial({ color: '#141414', transparent: true, opacity: 0.75, depthTest: false, fog: false }));
  const barMat = shroudOverlay(new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, fog: false }));
  const barsBg = new THREE.InstancedMesh(barGeo, barBgMat, MAX_BARS);
  const bars = new THREE.InstancedMesh(barGeo, barMat, MAX_BARS);
  for (const m of [barsBg, bars]) { m.count = 0; m.frustumCulled = false; m.renderOrder = 10; scene.add(m); }

  // placement ghost
  const ghostMat = new THREE.MeshStandardMaterial({ color: '#7fd67f', transparent: true, opacity: 0.55, emissive: '#1f5a1f', emissiveIntensity: 0.6, depthWrite: false });
  const ghost = new THREE.Mesh(new THREE.BufferGeometry(), ghostMat);
  ghost.visible = false; ghost.renderOrder = 4;
  scene.add(ghost);
  const footGeo = new THREE.RingGeometry(0.94, 1, 48); footGeo.rotateX(-Math.PI / 2);
  const footMat = new THREE.MeshBasicMaterial({ color: '#7fd67f', transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  const foot = new THREE.Mesh(footGeo, footMat); foot.visible = false; foot.renderOrder = 4; scene.add(foot);
  const rangeMat = new THREE.MeshBasicMaterial({ color: '#f0d9a0', transparent: true, opacity: 0.45, depthWrite: false, fog: false });
  const range = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 72).rotateX(-Math.PI / 2), rangeMat); range.visible = false; range.renderOrder = 4; scene.add(range);
  // ability preview
  const aoeMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.35, depthWrite: false, fog: false });
  const aoe = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), aoeMat); aoe.visible = false; aoe.renderOrder = 4; scene.add(aoe);
  const castRange = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 72).rotateX(-Math.PI / 2), rangeMat.clone()); castRange.visible = false; scene.add(castRange);

  // stall markers: an amber "!" floating over buildings that stopped working
  const markCanvas = document.createElement('canvas');
  markCanvas.width = markCanvas.height = 64;
  const mctx = markCanvas.getContext('2d');
  mctx.fillStyle = '#e0a83a'; mctx.beginPath(); mctx.arc(32, 32, 28, 0, Math.PI * 2); mctx.fill();
  mctx.lineWidth = 4; mctx.strokeStyle = '#3a2a10'; mctx.stroke();
  mctx.fillStyle = '#1a1208'; mctx.fillRect(28, 13, 8, 26); mctx.fillRect(28, 44, 8, 8);
  const markTex = new THREE.CanvasTexture(markCanvas);
  markTex.colorSpace = THREE.SRGBColorSpace;
  const markMat = new THREE.MeshBasicMaterial({ map: markTex, transparent: true, depthTest: false, fog: false });
  const stallMarks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 1.1), markMat, 64);
  stallMarks.count = 0; stallMarks.frustumCulled = false; stallMarks.renderOrder = 11;
  scene.add(stallMarks);
  const STALL_SHOWN = new Set(['noWorker', 'storageFull', 'noDeposit', 'noInput', 'noAccess', 'noSettler']);

  // command markers
  const markers = [];
  const markerGeo = new THREE.RingGeometry(0.5, 0.75, 24).rotateX(-Math.PI / 2);

  // territory border (rebuilt when buildings change)
  const borderMat = shroudOverlay(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false, fog: true }));
  const border = new THREE.Mesh(new THREE.BufferGeometry(), borderMat);
  border.renderOrder = 1;
  scene.add(border);
  let lastVersion = -1, lastCharter = null;

  function rebuildBorder() {
    const src = territorySources(world());
    const pos = [], col = [];
    const cP = new THREE.Color('#8fc6dc'), cE = new THREE.Color('#d88a6a');
    for (const s of src) {
      const n = Math.max(48, Math.round(s.r * 3));
      const c = s.owner === PLAYER ? cP : cE;
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = s.x + Math.cos(a) * s.r, z = s.z + Math.sin(a) * s.r;
        // skip border segments inside another source of the same owner
        const inside = src.some((o) => o !== s && o.owner === s.owner && Math.hypot(x - o.x, z - o.z) < o.r - 0.5);
        if (inside || !terrain.inBounds(x, z, 1)) { prev = null; continue; }
        const dash = Math.floor(i / 2) % 2 === 0;
        if (prev && dash) {
          const [px, pz] = prev;
          const nx = -(z - pz), nz = x - px, len = Math.hypot(nx, nz) || 1;
          const w = 0.14;
          const ox = (nx / len) * w, oz = (nz / len) * w;
          const y1 = terrain.height(px, pz) + 0.25, y2 = terrain.height(x, z) + 0.25;
          pos.push(px - ox, y1, pz - oz, px + ox, y1, pz + oz, x + ox, y2, z + oz, px - ox, y1, pz - oz, x + ox, y2, z + oz, x - ox, y2, z - oz);
          for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
        }
        prev = [x, z];
      }
    }
    border.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    border.geometry = g;
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const col = new THREE.Color();
  const right = new THREE.Vector3(), tmpEnt = { x: 0, z: 0, owner: null }, cWard = new THREE.Color('#8fd0ff');
  const cOwn = new THREE.Color('#7fe07f'), cEnemy = new THREE.Color('#e0604a'), cNeutral = new THREE.Color('#e8d9a0'), cHover = new THREE.Color('#ffffff');
  const ringFor = (ent) => ent.owner === PLAYER ? cOwn : ent.owner === 'none' ? cNeutral : cEnemy;
  let ghostType = null, placeCheckTimer = 0, lastCheck = { ok: false };

  function addRing(ent, color, scale) {
    if (rings.count >= MAX_RINGS) return;
    m4.compose(p.set(ent.x, terrain.height(ent.x, ent.z) + 0.08, ent.z), q.identity(), s.set(scale, 1, scale));
    rings.setMatrixAt(rings.count, m4);
    rings.setColorAt(rings.count, color);
    rings.count++;
  }

  function addBar(ent, x, z, h, frac, color) {
    if (bars.count >= MAX_BARS) return;
    const y = terrain.height(x, z) + h;
    const w = ent.kind === 'building' ? 3.2 : 1.5;
    m4.compose(p.set(x, y, z), camera.quaternion, s.set(w + 0.18, 0.34, 1));
    barsBg.setMatrixAt(barsBg.count++, m4);
    // fill anchored left: shift along camera right
    p.set(x, y, z);
    p.addScaledVector(right, -(w * (1 - frac)) / 2);
    m4.compose(p, camera.quaternion, s.set(Math.max(0.001, w * frac), 0.18, 1));
    bars.setMatrixAt(bars.count, m4);
    bars.setColorAt(bars.count, color);
    bars.count++;
  }

  return {
    id: 'selection-view',
    kind: 'view',
    marker(kind, x, z) {
      const mat = new THREE.MeshBasicMaterial({ color: kind === 'attack' ? '#e0604a' : kind === 'rally' ? '#e3b04b' : '#9fe09f', transparent: true, depthWrite: false, fog: false });
      const m = new THREE.Mesh(markerGeo, mat);
      m.position.set(x, terrain.height(x, z) + 0.15, z);
      scene.add(m);
      markers.push({ m, t: 0 });
      if (markers.length > 12) { const o = markers.shift(); scene.remove(o.m); o.m.material.dispose(); }
    },
    render(alpha, frame) {
      const w = world();
      const v = structureVersion(w);
      const charter = !!(w.players[PLAYER] && w.players[PLAYER].techs.charter);
      if (v !== lastVersion || charter !== lastCharter) { lastVersion = v; lastCharter = charter; rebuildBorder(); }
      rings.count = 0; bars.count = 0; barsBg.count = 0;
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      const sel = new Set(w.selection.ids);
      for (const id of w.selection.ids) {
        const ent = w.entities[id];
        if (!ent) continue;
        const sc = ent.kind === 'building' ? BUILDINGS[ent.type].radius + 0.8 : ent.kind === 'deposit' ? 2 : (ent.commander ? 1.1 : 0.7);
        // interpolate mobile entities
        if (ent.px !== undefined && ent.kind !== 'building') {
          const x = ent.px + (ent.x - ent.px) * alpha, z = ent.pz + (ent.z - ent.pz) * alpha;
          tmpEnt.x = x; tmpEnt.z = z; tmpEnt.owner = ent.owner;
          addRing(tmpEnt, ringFor(ent), sc);
        } else addRing(ent, ringFor(ent), sc);
      }
      const hov = input.state.hoverEntity;
      if (hov && !sel.has(hov.id) && w.entities[hov.id]) addRing(hov, cHover, hov.kind === 'building' ? BUILDINGS[hov.type].radius + 0.6 : 0.65);
      discs.count = 0;
      for (const u of all(w, 'unit')) {
        if (u.downed || discs.count >= 400) continue;
        const x = u.px + (u.x - u.px) * alpha, z = u.pz + (u.z - u.pz) * alpha;
        const sc = u.commander ? 1.5 : u.hero ? 1.25 : 1;
        m4.compose(p.set(x, terrain.height(x, z) + 0.06, z), q.identity(), s.set(sc, 1, sc));
        discs.setMatrixAt(discs.count, m4);
        discs.setColorAt(discs.count, u.hero ? cDiscH : u.owner === PLAYER ? cDiscP : cDiscE);
        discs.count++;
      }
      discs.instanceMatrix.needsUpdate = true; if (discs.instanceColor) discs.instanceColor.needsUpdate = true;
      // health bars: selected, damaged units in view, damaged buildings
      for (const u of all(w, 'unit')) {
        if (u.downed) continue;
        const dmg = u.hp < u.maxHp;
        if (!sel.has(u.id) && !(u.hp < u.maxHp * 0.7)) continue; // avoid bar ladders in melee
        const x = u.px + (u.x - u.px) * alpha, z = u.pz + (u.z - u.pz) * alpha;
        const frac = Math.max(0, u.hp / u.maxHp);
        col.setRGB(1 - frac, 0.25 + frac * 0.6, 0.2);
        if (u.owner !== PLAYER) col.setRGB(0.85, 0.3 + frac * 0.3, 0.2);
        addBar(u, x, z, u.commander ? 3.7 : 2.9, frac, col);
        if (u.ward > 0 && u.wardUntil > w.tick) { tmpEnt.x = x; tmpEnt.z = z; addRing(tmpEnt, cWard, 0.9); }
      }
      for (const b of all(w, 'building')) {
        if (b.state === 'destroyed') continue;
        const show = sel.has(b.id) || b.hp < b.maxHp * 0.98 || b.state === 'site';
        if (!show) continue;
        const frac = b.state === 'site' ? b.build.progress : b.hp / b.maxHp;
        if (b.state === 'site') col.set('#e3b04b'); else col.setRGB(1 - frac, 0.3 + frac * 0.55, 0.2);
        addBar(b, b.x, b.z, (b.state === 'site' ? 3 : 7), Math.max(0.02, frac), col);
      }
      for (const m of [rings, bars, barsBg]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }

      // stall markers
      stallMarks.count = 0;
      const bob = Math.sin(frame.time * 3) * 0.15;
      for (const b of all(w, 'building')) {
        if (b.owner !== PLAYER || b.state !== 'active' || !STALL_SHOWN.has(b.stall) || stallMarks.count >= 64) continue;
        m4.compose(p.set(b.x, terrain.height(b.x, b.z) + BUILDINGS[b.type].radius * 1.1 + 4.5 + bob, b.z), camera.quaternion, s.set(1, 1, 1));
        stallMarks.setMatrixAt(stallMarks.count++, m4);
      }
      stallMarks.instanceMatrix.needsUpdate = true;

      // placement ghost
      const st = input.state;
      const g = st.hoverGround;
      if (st.mode === 'place' && g) {
        const def = BUILDINGS[st.placeType];
        if (ghostType !== st.placeType) { ghost.geometry = buildingGeometries(st.placeType, def.radius).body; ghostType = st.placeType; }
        const x = Math.round(g.x * 2) / 2, z = Math.round(g.z * 2) / 2;
        placeCheckTimer += frame.dt;
        if (placeCheckTimer > 0.08) { placeCheckTimer = 0; lastCheck = checkPlacement(w, sim.services, PLAYER, st.placeType, x, z); }
        const ok = lastCheck.ok;
        ghost.visible = true;
        ghost.position.set(x, terrain.height(x, z), z);
        ghost.rotation.y = st.placeRot;
        ghostMat.color.set(ok ? '#8fe08f' : '#e07060'); ghostMat.emissive.set(ok ? '#1f5a1f' : '#5a1f1f');
        foot.visible = true; foot.position.set(x, terrain.height(x, z) + 0.12, z); foot.scale.setScalar(def.radius);
        footMat.color.set(ok ? '#8fe08f' : '#e07060');
        if (def.depositRange || def.attack || def.plotRadius) {
          const r = def.depositRange || (def.attack && def.attack.range) || def.plotRadius + 3;
          range.visible = true; range.position.set(x, terrain.height(x, z) + 0.2, z); range.scale.setScalar(r);
        } else range.visible = false;
        if (overlay) overlay.placementReason = ok ? '' : lastCheck.reason;
      } else {
        ghost.visible = false; foot.visible = false; range.visible = false;
        if (overlay) overlay.placementReason = '';
      }
      // ability targeting preview
      if (st.mode === 'target' && st.targetKind === 'flare' && g) {
        const hero = w.entities[st.heroId];
        const ab = ABILITIES.flare;
        aoe.visible = true; aoe.position.set(g.x, terrain.height(g.x, g.z) + 0.18, g.z); aoe.scale.setScalar(ab.radius);
        if (hero) {
          const inRange = Math.hypot(g.x - hero.x, g.z - hero.z) <= ab.range;
          aoeMat.color.set(inRange ? '#ffd27a' : '#c9a860');
          castRange.visible = true; castRange.position.set(hero.x, terrain.height(hero.x, hero.z) + 0.2, hero.z); castRange.scale.setScalar(ab.range);
        }
      } else { aoe.visible = false; castRange.visible = false; }
      // markers fade
      for (let i = markers.length - 1; i >= 0; i--) {
        const mk = markers[i];
        mk.t += frame.dt;
        mk.m.scale.setScalar(1 + mk.t * 1.5);
        mk.m.material.opacity = Math.max(0, 1 - mk.t / 0.8);
        if (mk.t > 0.8) { scene.remove(mk.m); mk.m.material.dispose(); markers.splice(i, 1); }
      }
    },
    /** Night dims the unlit border so it never outshines the scene. */
    setNight(n) { borderMat.opacity = 0.22 * (1 - 0.7 * n); },
    /** Photo mode (key art, trailers): hide all overlays drawn by this module. */
    setVisible(v) { for (const o of [rings, bars, barsBg, border, stallMarks, discs, ghost, foot, range, aoe, castRange]) o.visible = v && o !== ghost && o !== foot && o !== range && o !== aoe && o !== castRange ? true : v ? o.visible : false; },
    getHealthStatus() { return { status: 'ok' }; },
    dispose() {
      scene.remove(rings, bars, barsBg, ghost, foot, range, aoe, castRange, border, stallMarks, discs);
      discGeo.dispose(); discMat.dispose();
      markTex.dispose(); markMat.dispose(); stallMarks.geometry.dispose();
      for (const mk of markers) { scene.remove(mk.m); mk.m.material.dispose(); }
      ringGeo.dispose(); ringMat.dispose(); barGeo.dispose(); barBgMat.dispose(); barMat.dispose();
      ghostMat.dispose(); footGeo.dispose(); footMat.dispose(); rangeMat.dispose(); aoeMat.dispose(); markerGeo.dispose();
      border.geometry.dispose(); borderMat.dispose();
    },
  };
}
