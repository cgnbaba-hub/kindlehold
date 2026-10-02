// Effects: one pooled particle system (instanced soft sprites) for chimney smoke,
// work dust, sparks, fire, embers, hits, ability bursts; plus projectile meshes and
// ability rings. Reacts to simulation events; never writes simulation state.
import * as THREE from 'three';
import { all } from '../world/world.js';
import { EV } from '../core/contracts.js';
import { BUILDINGS } from '../buildings/defs.js';
import { chimneyOf } from '../buildings/meshes.js';
import { viewRng } from '../render/geometry-kit.js';
import { shroudOverlay } from '../render/structure-material.js';
import { flushInstances } from '../render/instancing.js';
import { isFactionHall } from '../ai/factions.js';

function spriteTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size - 0.5, dy = (y + 0.5) / size - 0.5;
    const d = Math.sqrt(dx * dx + dy * dy) * 2;
    const a = Math.max(0, 1 - d);
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(Math.pow(a, 1.6) * 255);
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.needsUpdate = true; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  return t;
}

const KINDS = {
  smoke: { life: 6, size: [1.1, 4.4], color: '#9a968f', alpha: 0.55, rise: 1.1, drag: 0.3, additive: false },
  darksmoke: { life: 4, size: [1.2, 4.5], color: '#3a3532', alpha: 0.6, rise: 1.6, drag: 0.3, additive: false },
  dust: { life: 1.1, size: [0.4, 1.4], color: '#b39a78', alpha: 0.5, rise: 0.4, drag: 2.5, additive: false },
  chips: { life: 0.7, size: [0.12, 0.08], color: '#c9a978', alpha: 1, rise: -9, drag: 0.5, additive: false },
  sparks: { life: 0.55, size: [0.16, 0.05], color: '#ffc46a', alpha: 1, rise: -6, drag: 0.8, additive: true },
  fire: { life: 0.9, size: [1.2, 0.3], color: '#ff8a2a', alpha: 0.85, rise: 2.6, drag: 0.8, additive: true },
  ember: { life: 2.2, size: [0.12, 0.05], color: '#ffb35c', alpha: 1, rise: 1.8, drag: 0.4, additive: true },
  blood: { life: 0.5, size: [0.25, 0.1], color: '#7a2a20', alpha: 0.9, rise: -7, drag: 0.6, additive: false },
  flare: { life: 0.9, size: [1.2, 3.4], color: '#ffe0a0', alpha: 0.6, rise: 0.5, drag: 1.5, additive: true },
  ward: { life: 1.4, size: [0.5, 0.1], color: '#8fd0ff', alpha: 0.9, rise: 1.6, drag: 0.5, additive: true },
  glint: { life: 0.8, size: [0.35, 0.1], color: '#ffe9b0', alpha: 1, rise: 1.2, drag: 1, additive: true },
  splash: { life: 0.8, size: [0.35, 0.12], color: '#cfe4ee', alpha: 0.9, rise: -8, drag: 0.6, additive: false },
};

export function createEffects({ scene, terrain, world, bus, quality, camera, reducedMotion = () => false }) {
  const max = (quality && quality.particles) || 1500;
  const tex = spriteTexture();
  const geo = new THREE.PlaneGeometry(1, 1);
  function makeLayer(additive) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, vertexColors: false, fog: true });
    mat.onBeforeCompile = (shader) => {
      // per-instance alpha packed into instanceColor's luminance is not enough; use an attribute
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAlpha;')
        .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vAlpha;');
    };
    mat.customProgramCacheKey = () => 'kh-particles-' + additive;
    shroudOverlay(mat); // effects in unexplored land stay hidden
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    const alphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    alphaAttr.setUsage(THREE.DynamicDrawUsage);
    mesh.geometry = geo.clone();
    mesh.geometry.setAttribute('aAlpha', alphaAttr);
    mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 5;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    return { mesh, alphaAttr, mat };
  }
  const layers = { normal: makeLayer(false), additive: makeLayer(true) };

  // particle pool (structure of arrays)
  const px = new Float32Array(max), py = new Float32Array(max), pz = new Float32Array(max);
  const vx = new Float32Array(max), vy = new Float32Array(max), vz = new Float32Array(max);
  const age = new Float32Array(max), life = new Float32Array(max), kindIdx = new Uint8Array(max), seedA = new Float32Array(max);
  const kindList = Object.keys(KINDS);
  const kindCols = kindList.map((k) => new THREE.Color(KINDS[k].color));
  let alive = 0;
  const rnd = viewRng(777);

  function emit(kind, x, y, z, n = 1, spread = 0.3, vel = [0, 0, 0], velSpread = 0.6) {
    const k = kindList.indexOf(kind);
    const def = KINDS[kind];
    for (let i = 0; i < n; i++) {
      if (alive >= max) return;
      const j = alive++;
      px[j] = x + (rnd() - 0.5) * spread; py[j] = y + (rnd() - 0.5) * spread * 0.5; pz[j] = z + (rnd() - 0.5) * spread;
      vx[j] = vel[0] + (rnd() - 0.5) * velSpread; vy[j] = vel[1] + rnd() * velSpread; vz[j] = vel[2] + (rnd() - 0.5) * velSpread;
      age[j] = 0; life[j] = def.life * (0.7 + rnd() * 0.6); kindIdx[j] = k; seedA[j] = rnd() * 6.28;
    }
  }

  // projectiles (arrows / sling stones) and ability rings
  const shots = [];
  const arrowGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4); arrowGeo.rotateX(Math.PI / 2);
  const stoneGeo = new THREE.SphereGeometry(0.08, 6, 4);
  const shotMat = new THREE.MeshStandardMaterial({ color: '#3b2a1c', roughness: 0.8 });
  const arrows = new THREE.InstancedMesh(arrowGeo, shotMat, 200);
  const stones = new THREE.InstancedMesh(stoneGeo, shotMat, 200);
  for (const m of [arrows, stones]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
  const rings = [];
  const ringGeo = new THREE.RingGeometry(0.92, 1, 48); ringGeo.rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(1, 48); discGeo.rotateX(-Math.PI / 2);
  const flash = new THREE.PointLight('#ffcf80', 0, 22, 1.5);
  scene.add(flash);
  let flashT = 0;

  const unsub = [];
  const heightAt = (x, z) => terrain.height(x, z);
  unsub.push(bus.on(EV.WORK_STRIKE, (d) => {
    const y = heightAt(d.x, d.z);
    if (d.kind === 'forester') { emit('chips', d.x, y + 1.2, d.z, 4, 0.3, [0, 2.5, 0], 2.2); }
    else if (d.kind === 'quarrier') { emit('dust', d.x, y + 0.6, d.z, 2, 0.8, [0, 0.6, 0], 0.6); emit('chips', d.x, y + 0.8, d.z, 3, 0.4, [0, 2.8, 0], 2.2); }
    else if (d.kind === 'mine') { emit('sparks', d.x, y + 1.1, d.z, 5, 0.3, [0, 2.2, 0], 2.8); }
    else if (d.kind === 'build' || d.kind === 'repair') { emit('dust', d.x, y + 0.3, d.z, 2, 0.6, [0, 0.4, 0], 0.5); }
    else if (d.kind === 'cook') { emit('smoke', d.x, y + 5.5, d.z, 1, 0.6, [0, 0.8, 0], 0.3); }
    else if (d.kind === 'bake') { emit('smoke', d.x, y + 5.8, d.z, 1, 0.7, [0, 0.8, 0], 0.3); }
    else if (d.kind === 'mill') { emit('dust', d.x, y + 0.6, d.z, 2, 0.5, [0, 0.5, 0], 0.4); }
    else if (d.kind === 'forge') { emit('sparks', d.x, y + 1.2, d.z, 6, 0.25, [0, 2.4, 0], 3.0); }
    else if (d.kind === 'salter') { emit('glint', d.x, heightAt(d.x, d.z) + 0.5, d.z, 2, 0.8, [0, 0.8, 0], 0.6); }
    else if (d.kind === 'fish') { emit('splash', d.x, heightAt(d.x, d.z) + 0.3, d.z, 3, 0.4, [0, 1.6, 0], 1.2); }
    else if (d.kind === 'harvest' || d.kind === 'sow') { emit('dust', d.x, y + 0.2, d.z, 1, 0.8, [0, 0.3, 0], 0.4); }
  }));
  // a feast: sparks and embers fly up from the hall
  unsub.push(bus.on('population:feast', (d) => { for (let i = 0; i < 4; i++) { emit('ember', d.x, heightAt(d.x, d.z) + 8 + i, d.z, 12, 2.5, [0, 2.5, 0], 2); emit('glint', d.x, heightAt(d.x, d.z) + 10, d.z, 6, 3, [0, 1.5, 0], 2); } }));
  // breaking ice: whoever was on the river scrambles out in a spray of water and ice
  unsub.push(bus.on('weather:soaked', (d) => { emit('splash', d.x, heightAt(d.x, d.z) + 0.6, d.z, 10, 0.5, [0, 3.2, 0], 2.4); }));
  unsub.push(bus.on(EV.COMBAT_SHOT, (d) => {
    if (shots.length > 180) return;
    const fy = d.fy != null ? d.fy : 1.4;
    shots.push({ fx: d.fx, fz: d.fz, fy: heightAt(d.fx, d.fz) + fy, tx: d.tx, tz: d.tz, ty: heightAt(d.tx, d.tz) + 1.1, t: 0, dur: d.flightTicks / 20, kind: d.kind, target: d.to });
  }));
  // a boulder lands: a ring of dust and flying earth
  unsub.push(bus.on('combat:impact', (d) => {
    const y = heightAt(d.x, d.z);
    emit('dust', d.x, y + 0.6, d.z, 14, d.r * 0.8, [0, 1.4, 0], 2.2);
    emit('chips', d.x, y + 0.5, d.z, 8, d.r * 0.4, [0, 4.5, 0], 3.5);
  }));
  unsub.push(bus.on(EV.COMBAT_HIT, (d) => {
    const y = heightAt(d.x, d.z);
    if (d.targetKind === 'building') { emit('dust', d.x, y + 1.5, d.z, 3, 2, [0, 0.8, 0], 1); emit('chips', d.x, y + 2, d.z, 3, 1.5, [0, 3, 0], 3); }
    else {
      emit(d.kind === 'flare' ? 'glint' : 'sparks', d.x, y + 1.2, d.z, 4, 0.3, [0, 1.6, 0], 2.5);
      emit('blood', d.x, y + 1.1, d.z, 2, 0.2, [0, 1.5, 0], 1.6);
      if (d.kind === 'strong') emit('glint', d.x, y + 1.5, d.z, 5, 0.4, [0, 2.2, 0], 1.8); // counter hit: bright gold burst
    }
  }));
  unsub.push(bus.on(EV.HERO_ABILITY, (d) => {
    const y = heightAt(d.x, d.z);
    if (d.ability === 'flare') {
      emit('flare', d.x, y + 1.2, d.z, 14, d.radius * 1.2, [0, 0.6, 0], 2);
      emit('ember', d.x, y + 1, d.z, 30, d.radius * 1.4, [0, 2.5, 0], 2.5);
      rings.push({ x: d.x, z: d.z, r: d.radius, t: 0, dur: 0.8, color: '#ffd27a' });
      rings.push({ x: d.x, z: d.z, r: d.radius * 1.1, t: 0, dur: 1.4, color: '#ffb35c', disc: true });
      flash.position.set(d.x, y + 3, d.z); flashT = 0.9;
    } else if (d.ability === 'volley') {
      rings.push({ x: d.x, z: d.z, r: d.radius, t: 0, dur: 1.2, color: '#e8e0cc' });
      emit('dust', d.x, y + 0.4, d.z, 12, d.radius, [0, 0.6, 0], 1.5);
    } else if (d.ability === 'mark') {
      rings.push({ x: d.x, z: d.z, r: d.radius, t: 0, dur: 1.6, color: '#d86a4f' });
      rings.push({ x: d.x, z: d.z, r: d.radius * 1.05, t: 0, dur: 2.2, color: '#f0a070', disc: true });
      emit('glint', d.x, y + 1.2, d.z, 16, d.radius, [0, 1.2, 0], 1.2);
    } else if (d.ability === 'kindle') {
      emit('ward', d.x, y + 0.6, d.z, 40, d.radius * 1.6, [0, 1.2, 0], 1.2);
      rings.push({ x: d.x, z: d.z, r: d.radius, t: 0, dur: 1.2, color: '#8fd0ff' });
    } else if (d.ability === 'horn') {
      rings.push({ x: d.x, z: d.z, r: d.radius, t: 0, dur: 1.0, color: '#d86a4f' });
    }
  }));
  unsub.push(bus.on(EV.BUILDING_DESTROYED, (d) => {
    const y = heightAt(d.x, d.z);
    emit('darksmoke', d.x, y + 2, d.z, 18, 5, [0, 1.5, 0], 1.5);
    emit('fire', d.x, y + 1, d.z, 20, 4, [0, 2, 0], 1.5);
  }));
  unsub.push(bus.on(EV.BUILDING_COMPLETED, (d) => {
    const b = world().entities[d.id];
    if (!b) return;
    const y = heightAt(b.x, b.z);
    emit('dust', b.x, y + 0.5, b.z, 16, BUILDINGS[b.type].radius * 2, [0, 0.8, 0], 1.2);
    emit('glint', b.x, y + 3, b.z, 10, BUILDINGS[b.type].radius, [0, 1, 0], 1);
  }));
  unsub.push(bus.on(EV.PRODUCTION_CYCLE, (d) => { emit('glint', d.x, heightAt(d.x, d.z) + 1.8, d.z, 2, 0.4, [0, 1, 0], 0.4); }));
  unsub.push(bus.on('keep:rekindled', ({ id }) => {
    const b = world().entities[id];
    if (b) emit('ember', b.x + Math.sin(b.rot) * -2.2, heightAt(b.x, b.z) + 12.5, b.z + Math.cos(b.rot) * -2.2, 40, 1.5, [0, 3, 0], 2);
  }));

  // continuous emitters (chimneys, braziers, damage fires) evaluated a few times per second
  let emitTimer = 0;
  function continuous(dt) {
    emitTimer += dt;
    if (emitTimer < 0.12) return;
    const step = emitTimer; emitTimer = 0;
    const w = world();
    for (const b of all(w, 'building')) {
      const y = heightAt(b.x, b.z);
      const c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0);
      const toW = (lx, lz) => [b.x + lx * c + lz * s, b.z - lx * s + lz * c];
      if (b.state === 'active') {
        if (b.type === 'cottage' && rnd() < step * 1.8) { const ch = chimneyOf('cottage', b.level || 1) || [-1.5, 6.4, -0.8]; const [x, z] = toW(ch[0], ch[2]); emit('smoke', x, y + ch[1], z, 1, 0.2, [0.25, 0.6, 0.1], 0.2); }
        if (b.type === 'keep') {
          if (rnd() < step * 1.4) { const [x, z] = toW(2.6, 0.8); emit('smoke', x, y + 7.8, z, 1, 0.2, [0.25, 0.6, 0.1], 0.2); }
          if (b.lit) { const [x, z] = toW(0, -2.2); emit('fire', x, y + 12.2, z, Math.ceil(step * 18), 0.6, [0, 1.2, 0], 0.4); if (rnd() < step * 5) emit('ember', x, y + 12.6, z, 1, 0.5, [0, 1.5, 0], 1); }
        }
        if (b.type === 'mine' && rnd() < step * 0.7) { const [x, z] = toW(0, 2); emit('dust', x, y + 0.5, z, 1, 0.6, [0, 0.3, 0.2], 0.3); }
        if (isFactionHall(b.type) && rnd() < step * 2) { const [x, z] = toW(4, -2); emit('smoke', x, y + 8, z, 1, 0.4, [0.3, 0.8, 0], 0.3); }
      }
      // damage: smoke below 60%, fire below 35%
      if (b.state !== 'destroyed' && b.maxHp) {
        const frac = b.hp / b.maxHp;
        const h = BUILDINGS[b.type].radius;
        if (b.state === 'active' && frac < 0.6 && rnd() < step * 3) emit('darksmoke', b.x + (rnd() - 0.5) * h, y + 3, b.z + (rnd() - 0.5) * h, 1, 0.5, [0, 1, 0], 0.4);
        if (b.state === 'active' && frac < 0.35) emit('fire', b.x + (rnd() - 0.5) * h, y + 2.5, b.z + (rnd() - 0.5) * h, Math.ceil(step * 14), 1, [0, 1.5, 0], 0.6);
      }
      if (b.state === 'destroyed' && w.tick - b.destroyedTick < 400 && rnd() < step * 4) emit('darksmoke', b.x, y + 1, b.z, 1, BUILDINGS[b.type].radius, [0, 1.2, 0], 0.5);
    }
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), fwd = new THREE.Vector3(0, 0, 1);
  const camQ = new THREE.Quaternion();
  const col = new THREE.Color();
  const ringMeshes = [];

  return {
    id: 'effects',
    kind: 'view',
    emit,
    /** Smoke and dust are unlit sprites: dim them at night so they do not glow (fire stays bright). */
    setNight(n) { layers.normal.mat.color.setScalar(1 - n * 0.78); },
    render(alpha, frame) {
      const dt = reducedMotion() ? frame.dt * 0.5 : frame.dt;
      continuous(frame.dt);
      camQ.copy(camera.quaternion);
      // integrate + compact
      let n = 0;
      const nL = layers.normal, aL = layers.additive;
      let cn = 0, ca = 0;
      for (let i = 0; i < alive; i++) {
        age[i] += dt;
        if (age[i] >= life[i]) continue;
        const k = KINDS[kindList[kindIdx[i]]];
        vx[i] *= 1 - k.drag * dt; vz[i] *= 1 - k.drag * dt;
        vy[i] += (k.rise < 0 ? k.rise : (k.rise - vy[i]) * k.drag) * dt;
        px[i] += vx[i] * dt + Math.sin(age[i] * 1.3 + seedA[i]) * 0.15 * dt * (k.rise > 0 ? 1 : 0);
        py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
        if (n !== i) { px[n] = px[i]; py[n] = py[i]; pz[n] = pz[i]; vx[n] = vx[i]; vy[n] = vy[i]; vz[n] = vz[i]; age[n] = age[i]; life[n] = life[i]; kindIdx[n] = kindIdx[i]; seedA[n] = seedA[i]; }
        const t = age[n] / life[n];
        const size = k.size[0] + (k.size[1] - k.size[0]) * t;
        const a = k.alpha * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
        m4.compose(p.set(px[n], py[n], pz[n]), camQ, s.set(size, size, size));
        const layer = k.additive ? aL : nL;
        const idx = k.additive ? ca++ : cn++;
        layer.mesh.setMatrixAt(idx, m4);
        col.copy(kindCols[kindIdx[n]]);
        layer.mesh.setColorAt(idx, col);
        layer.alphaAttr.array[idx] = Math.max(0, a);
        n++;
      }
      alive = n;
      nL.mesh.count = cn; aL.mesh.count = ca;
      for (const L of [nL, aL]) {
        flushInstances(L.mesh, [L.alphaAttr]);
      }
      // projectiles
      let na = 0, ns = 0;
      for (let i = shots.length - 1; i >= 0; i--) {
        const sh = shots[i];
        sh.t += frame.dt;
        const k = Math.min(1, sh.t / sh.dur);
        const x = sh.fx + (sh.tx - sh.fx) * k, z = sh.fz + (sh.tz - sh.fz) * k;
        const dist = Math.hypot(sh.tx - sh.fx, sh.tz - sh.fz);
        const arc = Math.sin(k * Math.PI) * dist * (sh.kind === 'boulder' ? 0.32 : sh.kind !== 'stone' ? 0.22 : 0.12);
        const y = sh.fy + (sh.ty - sh.fy) * k + arc;
        if (k >= 1) { shots.splice(i, 1); continue; }
        const vyv = (sh.ty - sh.fy) + Math.cos(k * Math.PI) * Math.PI * dist * (sh.kind === 'boulder' ? 0.32 : sh.kind !== 'stone' ? 0.22 : 0.12);
        p.set(sh.tx - sh.fx, vyv, sh.tz - sh.fz).normalize();
        q.setFromUnitVectors(fwd, p);
        m4.compose(s.set(x, y, z), q, p.set(1, 1, 1));
        // a boulder is the iron shot, three times the size
        if (sh.kind === 'boulder') { m4.compose(s.set(x, y, z), q, p.set(3.2, 3.2, 3.2)); stones.setMatrixAt(ns++, m4); }
        else if (sh.kind !== 'stone') arrows.setMatrixAt(na++, m4); else stones.setMatrixAt(ns++, m4);
      }
      arrows.count = na; stones.count = ns;
      flushInstances(arrows); flushInstances(stones);
      if (flashT > 0) { flashT = Math.max(0, flashT - frame.dt); flash.intensity = 180 * flashT; } else flash.intensity = 0;
      // expanding ability rings
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        if (!r.mesh) {
          // geometry baked in world space, draped over the terrain so slopes never clip it
          const g = (r.disc ? discGeo : ringGeo).clone();
          const gp = g.attributes.position;
          for (let k = 0; k < gp.count; k++) {
            const wx = r.x + gp.getX(k) * r.r, wz = r.z + gp.getZ(k) * r.r;
            gp.setXYZ(k, gp.getX(k) * r.r, heightAt(wx, wz) + 0.2, gp.getZ(k) * r.r);
          }
          r.base = (r.disc ? discGeo : ringGeo).attributes.position.array;
          r.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: r.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
          r.mesh.position.set(r.x, 0, r.z);
          scene.add(r.mesh); ringMeshes.push(r.mesh);
        }
        r.t += frame.dt;
        const k = r.t / r.dur;
        if (k >= 1) { scene.remove(r.mesh); r.mesh.material.dispose(); r.mesh.geometry.dispose(); rings.splice(i, 1); continue; }
        if (!r.disc) {
          // expanding ring: re-drape every frame at the current radius
          const sc = (0.3 + 0.7 * Math.sqrt(k)) * r.r;
          const gp = r.mesh.geometry.attributes.position;
          for (let q = 0; q < gp.count; q++) {
            const lx = r.base[q * 3] * sc, lz = r.base[q * 3 + 2] * sc;
            gp.setXYZ(q, lx, heightAt(r.x + lx, r.z + lz) + 0.2, lz);
          }
          gp.needsUpdate = true;
        }
        r.mesh.material.opacity = r.disc ? 0.45 * (1 - k) : 1 - k;
      }
    },
    particleCount: () => alive,
    getHealthStatus() { return { status: 'ok', detail: `${alive}/${max} particles` }; },
    dispose() {
      unsub.forEach((u) => u());
      for (const L of Object.values(layers)) { scene.remove(L.mesh); L.mesh.geometry.dispose(); L.mat.dispose(); }
      scene.remove(arrows, stones); arrowGeo.dispose(); stoneGeo.dispose(); shotMat.dispose();
      for (const r of rings) if (r.mesh) { scene.remove(r.mesh); r.mesh.material.dispose(); }
      ringGeo.dispose(); discGeo.dispose(); scene.remove(flash); tex.dispose(); geo.dispose();
    },
  };
}
