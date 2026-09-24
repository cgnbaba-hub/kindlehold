// Input: keyboard + mouse -> camera motion, selection, and simulation commands.
// Modes: 'select' (default), 'place' (building preview), 'target' (attack-move,
// patrol, ability). Every gameplay action becomes a command for the simulation.
import * as THREE from 'three';
import { all } from '../world/world.js';
import { PLAYER } from '../core/contracts.js';
import { BUILDINGS } from '../buildings/defs.js';
import { DEFAULT_BINDINGS } from './bindings.js';

const DRAG_PX = 6;
const PICK_PX = 22;

export function createInput({ canvas, rc, sim, terrain, settings, hooks = {} }) {
  const cam = rc.rts;
  const keys = new Set();
  const state = {
    mode: 'select', placeType: null, placeRot: 2.3, targetKind: null,
    mouse: { x: 0, y: 0, inside: false }, down: null, box: null, hoverGround: null, hoverEntity: null,
    lastClick: { t: 0, id: null },
  };
  const bindings = () => ({ ...DEFAULT_BINDINGS, ...(settings.bindings || {}) });
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const v = new THREE.Vector3();
  const unsub = [];
  const world = () => sim.world;

  function selection() { return world().selection.ids.map((id) => world().entities[id]).filter(Boolean); }
  function selectedUnits() { return selection().filter((e) => e.kind === 'unit' && e.owner === PLAYER && !e.downed); }
  function setSelection(ids) {
    world().selection.ids = ids.slice(0, 120);
    if (hooks.onSelection) hooks.onSelection(world().selection.ids);
  }

  function toNdc(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    return ndc;
  }

  /** Ray-march the heightfield (fast, no triangle raycast). */
  function pickGround(x, y) {
    ray.setFromCamera(toNdc(x, y), rc.camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    let t = 0;
    for (let i = 0; i < 400; i++) {
      const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t;
      const h = Math.max(terrain.height(px, pz), terrain.waterLevel);
      if (py <= h) {
        // refine with bisection
        let a = Math.max(0, t - 2), b = t;
        for (let k = 0; k < 10; k++) {
          const m = (a + b) / 2;
          const mx = o.x + d.x * m, mz = o.z + d.z * m;
          if (o.y + d.y * m <= Math.max(terrain.height(mx, mz), terrain.waterLevel)) b = m; else a = m;
        }
        return { x: o.x + d.x * b, z: o.z + d.z * b };
      }
      t += Math.max(0.5, (py - h) * 0.5);
      if (t > 1200) break;
    }
    return null;
  }

  function screenOf(e, out) {
    v.set(e.x, terrain.height(e.x, e.z) + (e.kind === 'building' ? 2 : 1), e.z).project(rc.camera);
    const r = canvas.getBoundingClientRect();
    out.x = r.left + (v.x * 0.5 + 0.5) * r.width;
    out.y = r.top + (-v.y * 0.5 + 0.5) * r.height;
    out.z = v.z;
    return out;
  }

  const sp = { x: 0, y: 0, z: 0 };
  /** Entity under the cursor: units/settlers by screen distance, buildings by footprint. */
  function pickEntity(x, y) {
    let best = null, bestD = PICK_PX;
    for (const kind of ['unit', 'settler']) {
      for (const e of all(world(), kind)) {
        screenOf(e, sp);
        if (sp.z > 1) continue;
        const d = Math.hypot(sp.x - x, sp.y - (y + 6));
        if (d < bestD) { bestD = d; best = e; }
      }
    }
    if (best) return best;
    const g = pickGround(x, y);
    if (!g) return null;
    let bb = null, bd = Infinity;
    for (const b of all(world(), 'building')) {
      const r = BUILDINGS[b.type].radius;
      const d = Math.hypot(b.x - g.x, b.z - g.z);
      if (d < r && d < bd) { bd = d; bb = b; }
    }
    if (bb) return bb;
    // deposits give information too
    for (const d of all(world(), 'deposit')) if (Math.hypot(d.x - g.x, d.z - g.z) < (d.type === 'tree' ? 1.2 : 2.2)) return d;
    return null;
  }

  function issue(cmd) { sim.issue(cmd); if (hooks.onCommand) hooks.onCommand(cmd); }

  function contextOrder(x, y) {
    const units = selectedUnits();
    const sel = selection();
    const target = pickEntity(x, y);
    const g = pickGround(x, y);
    if (units.length) {
      if (target && target.owner !== PLAYER && target.owner !== 'none' && (target.kind === 'unit' || target.kind === 'building' || target.kind === 'settler')) {
        issue({ type: 'attack', ids: units.map((u) => u.id), target: target.id });
        if (hooks.onMarker) hooks.onMarker('attack', target.x, target.z);
      } else if (g) {
        issue({ type: 'move', ids: units.map((u) => u.id), x: g.x, z: g.z });
        if (hooks.onMarker) hooks.onMarker('move', g.x, g.z);
      }
      return;
    }
    const b = sel.find((e) => e.kind === 'building' && e.owner === PLAYER && e.type === 'barracks');
    if (b && g) { issue({ type: 'rally', building: b.id, x: g.x, z: g.z }); if (hooks.onMarker) hooks.onMarker('rally', g.x, g.z); }
  }

  function beginTarget(kind) {
    const units = selectedUnits();
    if (kind === 'move') {
      if (!units.length) return;
      state.mode = 'target'; state.targetKind = 'move';
    } else if (kind === 'flare' || kind === 'kindle') {
      const hero = units.find((u) => u.hero) || all(world(), 'unit').find((u) => u.hero && u.owner === PLAYER && !u.downed);
      if (!hero) return;
      if (kind === 'kindle') { issue({ type: 'ability', heroId: hero.id, ability: 'kindle' }); return; }
      state.mode = 'target'; state.targetKind = 'flare'; state.heroId = hero.id;
    } else {
      if (!units.length) return;
      state.mode = 'target'; state.targetKind = kind;
    }
    if (hooks.onMode) hooks.onMode(state.mode, state.targetKind);
  }

  function cancelMode() {
    state.mode = 'select'; state.placeType = null; state.targetKind = null;
    if (hooks.onMode) hooks.onMode('select');
  }

  function startPlacement(type) {
    state.mode = 'place'; state.placeType = type;
    if (hooks.onMode) hooks.onMode('place', type);
  }

  function commitTarget(x, y) {
    const g = pickGround(x, y);
    if (!g) return;
    if (state.targetKind === 'flare') {
      issue({ type: 'ability', heroId: state.heroId, ability: 'flare', x: g.x, z: g.z });
    } else {
      const ids = selectedUnits().map((u) => u.id);
      const t = pickEntity(x, y);
      if (state.targetKind === 'attackMove' && t && t.owner !== PLAYER && t.owner !== 'none' && t.kind !== 'deposit') issue({ type: 'attack', ids, target: t.id });
      else issue({ type: state.targetKind, ids, x: g.x, z: g.z });
      if (hooks.onMarker) hooks.onMarker(state.targetKind === 'attackMove' ? 'attack' : 'move', g.x, g.z);
    }
    cancelMode();
  }

  function boxSelect(x0, y0, x1, y1, additive) {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    const ids = additive ? world().selection.ids.slice() : [];
    for (const u of all(world(), 'unit')) {
      if (u.owner !== PLAYER || u.downed) continue;
      screenOf(u, sp);
      if (sp.z < 1 && sp.x >= minX && sp.x <= maxX && sp.y >= minY && sp.y <= maxY && !ids.includes(u.id)) ids.push(u.id);
    }
    if (ids.length === 0 && !additive) {
      // no soldiers: allow selecting settlers
      for (const s of all(world(), 'settler')) {
        if (s.owner !== PLAYER) continue;
        screenOf(s, sp);
        if (sp.z < 1 && sp.x >= minX && sp.x <= maxX && sp.y >= minY && sp.y <= maxY) ids.push(s.id);
      }
    }
    setSelection(ids);
  }

  function clickSelect(x, y, additive, now) {
    const e = pickEntity(x, y);
    if (!e) { if (!additive) setSelection([]); return; }
    // double-click: all visible own units of the same type
    if (state.lastClick.id === e.id && now - state.lastClick.t < 350 && e.kind === 'unit' && e.owner === PLAYER) {
      const r = canvas.getBoundingClientRect();
      const ids = all(world(), 'unit').filter((u) => u.owner === PLAYER && u.type === e.type && !u.downed).filter((u) => { screenOf(u, sp); return sp.z < 1 && sp.x >= r.left && sp.x <= r.right && sp.y >= r.top && sp.y <= r.bottom; }).map((u) => u.id);
      setSelection(ids);
    } else if (additive) {
      const ids = world().selection.ids.slice();
      const i = ids.indexOf(e.id);
      if (i >= 0) ids.splice(i, 1); else ids.push(e.id);
      setSelection(ids);
    } else setSelection([e.id]);
    state.lastClick = { t: now, id: e.id };
  }

  // --- DOM events --------------------------------------------------------------
  function onPointerDown(ev) {
    canvas.focus({ preventScroll: true });
    state.mouse.x = ev.clientX; state.mouse.y = ev.clientY;
    if (ev.button === 1) { state.down = { x: ev.clientX, y: ev.clientY, button: 1, yaw: cam.state.tyaw, moved: false }; ev.preventDefault(); return; }
    if (ev.button === 2) {
      // right button: short click = context order / cancel; drag = grab the map and pull it
      state.down = { x: ev.clientX, y: ev.clientY, button: 2, moved: false, anchor: pickGround(ev.clientX, ev.clientY) };
      return;
    }
    if (ev.button === 0) {
      if (state.mode === 'place') {
        const g = pickGround(ev.clientX, ev.clientY);
        if (g) {
          issue({ type: 'place', buildingType: state.placeType, x: Math.round(g.x * 2) / 2, z: Math.round(g.z * 2) / 2, rot: state.placeRot });
          if (!ev.shiftKey) cancelMode();
        }
        return;
      }
      if (state.mode === 'target') { commitTarget(ev.clientX, ev.clientY); return; }
      state.down = { x: ev.clientX, y: ev.clientY, button: 0, moved: false, shift: ev.shiftKey };
    }
  }

  function onPointerMove(ev) {
    const dx = ev.clientX - state.mouse.x, dy = ev.clientY - state.mouse.y;
    state.mouse.x = ev.clientX; state.mouse.y = ev.clientY; state.mouse.inside = true;
    if (state.down && state.down.button === 1) {
      // middle drag: rotate around the view centre
      cam.rotate(-dx * 0.006);
      return;
    }
    if (state.down && state.down.button === 2) {
      if (!state.down.moved && Math.hypot(ev.clientX - state.down.x, ev.clientY - state.down.y) > DRAG_PX) state.down.moved = true;
      if (state.down.moved && state.down.anchor) {
        // keep the grabbed ground point under the cursor
        const g = pickGround(ev.clientX, ev.clientY);
        if (g) cam.panWorld(state.down.anchor.x - g.x, state.down.anchor.z - g.z);
        canvas.style.cursor = 'grabbing';
      }
      return;
    }
    if (state.down && state.down.button === 0) {
      if (!state.down.moved && Math.hypot(ev.clientX - state.down.x, ev.clientY - state.down.y) > DRAG_PX) state.down.moved = true;
      if (state.down.moved) state.box = { x0: state.down.x, y0: state.down.y, x1: ev.clientX, y1: ev.clientY };
    }
  }

  function onPointerUp(ev) {
    if (!state.down) return;
    const d = state.down;
    state.down = null;
    if (d.button === 2) {
      canvas.style.cursor = '';
      if (!d.moved) { if (state.mode !== 'select') cancelMode(); else contextOrder(ev.clientX, ev.clientY); }
      return;
    }
    if (d.button === 0) {
      if (d.moved && state.box) boxSelect(state.box.x0, state.box.y0, state.box.x1, state.box.y1, d.shift);
      else clickSelect(ev.clientX, ev.clientY, d.shift, performance.now());
      state.box = null;
    }
  }

  function onWheel(ev) {
    ev.preventDefault();
    const f = ev.deltaY > 0 ? 1.12 : 1 / 1.12;
    // zoom towards the point under the cursor (zooming out stays centred)
    if (f < 1) {
      const g = pickGround(ev.clientX, ev.clientY);
      if (g) cam.focus(cam.state.tx + (g.x - cam.state.tx) * (1 - f), cam.state.tz + (g.z - cam.state.tz) * (1 - f));
    }
    cam.zoomBy(f);
  }


  function onContext(ev) { ev.preventDefault(); }

  function groupKey(ev) { return ev.code.startsWith('Digit') ? ev.code.slice(5) : null; }

  function onKeyDown(ev) {
    if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT' || ev.target.tagName === 'TEXTAREA')) return;
    if (hooks.blocked && hooks.blocked()) return;
    const b = bindings();
    const code = ev.code;
    keys.add(code);
    const g = groupKey(ev);
    if (g && g !== '0') {
      const w = world();
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        w.selection.groups[g] = selectedUnits().map((u) => u.id);
        if (hooks.onToast) hooks.onToast(`Group ${g} set (${w.selection.groups[g].length})`);
      } else {
        const ids = (w.selection.groups[g] || []).filter((id) => w.entities[id]);
        if (ids.length) {
          const now = performance.now();
          if (state.lastGroup === g && now - state.lastGroupT < 400) focusSelection();
          state.lastGroup = g; state.lastGroupT = now;
          setSelection(ids);
        }
      }
      return;
    }
    if (code === b.pause) {
      if (state.mode !== 'select') { cancelMode(); return; }
      if (hooks.onPause) hooks.onPause();
      return;
    }
    if (state.mode === 'place' && (code === b.rotateLeft || code === b.rotateRight)) { state.placeRot += code === b.rotateLeft ? 0.3927 : -0.3927; return; }
    switch (code) {
      case b.attackMove: beginTarget('attackMove'); break;
      case b.patrol: beginTarget('patrol'); break;
      case b.stop: { const ids = selectedUnits().map((u) => u.id); if (ids.length) issue({ type: 'stop', ids }); break; }
      case b.hold: { const ids = selectedUnits().map((u) => u.id); if (ids.length) issue({ type: 'hold', ids }); break; }
      case b.abilityFlare: beginTarget('flare'); break;
      case b.abilityKindle: beginTarget('kindle'); break;
      case b.buildMenu: if (hooks.onBuildMenu) hooks.onBuildMenu(); break;
      case b.focusSelection: ev.preventDefault(); focusSelection(); break;
      case b.focusKeep: { const k = all(world(), 'building').find((x) => x.type === 'keep' && x.owner === PLAYER); if (k) cam.focus(k.x, k.z); break; }
      case b.quickSave: ev.preventDefault(); if (hooks.onQuickSave) hooks.onQuickSave(); break;
      case b.quickLoad: ev.preventDefault(); if (hooks.onQuickLoad) hooks.onQuickLoad(); break;
      case b.speedUp: if (hooks.onSpeed) hooks.onSpeed(1); break;
      case b.speedDown: if (hooks.onSpeed) hooks.onSpeed(-1); break;
      default: break;
    }
  }
  function onKeyUp(ev) { keys.delete(ev.code); }
  function onBlur() { keys.clear(); state.down = null; state.box = null; }
  function onLeave() { state.mouse.inside = false; }

  function focusSelection() {
    const sel = selection();
    if (!sel.length) return;
    let x = 0, z = 0;
    for (const e of sel) { x += e.x; z += e.z; }
    cam.focus(x / sel.length, z / sel.length);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContext);
  canvas.addEventListener('pointerleave', onLeave);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    id: 'input',
    kind: 'view',
    state,
    pickGround, pickEntity, startPlacement, cancelMode, beginTarget, setSelection, focusSelection, issue,
    render(alpha, frame) {
      const b = bindings();
      const speed = (settings.cameraSpeed || 1) * 55 * frame.dt;
      let px = 0, pz = 0;
      if (keys.has(b.panLeft)) px -= 1;
      if (keys.has(b.panRight)) px += 1;
      if (keys.has(b.panUp)) pz += 1;
      if (keys.has(b.panDown)) pz -= 1;
      if (state.mode !== 'place') {
        if (keys.has(b.rotateLeft)) cam.rotate(1.6 * frame.dt);
        if (keys.has(b.rotateRight)) cam.rotate(-1.6 * frame.dt);
      }
      if (keys.has(b.zoomIn)) cam.zoomBy(1 - frame.dt * 1.5);
      if (keys.has(b.zoomOut)) cam.zoomBy(1 + frame.dt * 1.5);
      if (settings.edgeScroll !== false && state.mouse.inside && !state.down) {
        const r = canvas.getBoundingClientRect();
        const m = 8;
        if (state.mouse.x < r.left + m) px -= 1;
        if (state.mouse.x > r.right - m) px += 1;
        if (state.mouse.y < r.top + m) pz += 1;
        if (state.mouse.y > r.bottom - m) pz -= 1;
      }
      if (px || pz) cam.pan(px * speed, pz * speed);
      // hover ground for placement / targeting previews
      if (state.mode !== 'select' && state.mouse.inside) state.hoverGround = pickGround(state.mouse.x, state.mouse.y);
      else state.hoverGround = null;
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContext);
      canvas.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      unsub.forEach((u) => u());
    },
  };
}

