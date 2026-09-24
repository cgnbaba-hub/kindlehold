// Minimap: pre-rendered terrain + live buildings/units + camera view; click to move the camera.
import { all } from '../world/world.js';
import { PLAYER } from '../core/contracts.js';
import { BUILDINGS } from '../buildings/defs.js';
import { computeSplat } from '../terrain/terrain-view.js';
import { h } from './dom.js';

const SIZE = 256; // drawn at native resolution, scaled down by CSS

export function createMinimap({ terrain, world, rts, onMoveOrder }) {
  const canvas = h('canvas.minimap-canvas', { width: SIZE, height: SIZE, 'aria-label': 'Minimap. Click to move the camera, right-click to send selected units.' });
  const base = document.createElement('canvas');
  base.width = SIZE; base.height = SIZE;
  const bctx = base.getContext('2d');
  const img = bctx.createImageData(SIZE, SIZE);
  const splat = computeSplat(terrain);
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
    const x = -terrain.half + (i + 0.5) / SIZE * terrain.size, z = -terrain.half + (j + 0.5) / SIZE * terrain.size;
    const hgt = terrain.height(x, z);
    const ii = Math.round((x + terrain.half) / terrain.step), jj = Math.round((z + terrain.half) / terrain.step);
    const k = (jj * terrain.n + ii) * 4;
    let r = 96 * splat[k] + 140 * splat[k + 1] + 128 * splat[k + 2] + 120 * splat[k + 3];
    let g = 128 * splat[k] + 110 * splat[k + 1] + 126 * splat[k + 2] + 112 * splat[k + 3];
    let b = 64 * splat[k] + 80 * splat[k + 1] + 120 * splat[k + 2] + 90 * splat[k + 3];
    const shade = 0.92 + Math.min(0.25, hgt / 60);
    r *= shade; g *= shade; b *= shade;
    if (hgt < terrain.waterLevel - 0.05) { r = 40; g = 90; b = 108; }
    const o = (j * SIZE + i) * 4;
    img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
  bctx.putImageData(img, 0, 0);
  const ctx = canvas.getContext('2d');
  const toPx = (x) => ((x + terrain.half) / terrain.size) * SIZE;
  const toW = (px) => (px / SIZE) * terrain.size - terrain.half;

  function pointer(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: toW(((ev.clientX - r.left) / r.width) * SIZE), z: toW(((ev.clientY - r.top) / r.height) * SIZE) };
  }
  let dragging = false;
  canvas.addEventListener('pointerdown', (ev) => {
    const p = pointer(ev);
    if (ev.button === 2) { if (onMoveOrder) onMoveOrder(p.x, p.z); return; }
    dragging = true; rts.focus(p.x, p.z);
  });
  canvas.addEventListener('pointermove', (ev) => { if (dragging) { const p = pointer(ev); rts.focus(p.x, p.z); } });
  window.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  let timer = 0;
  function draw() {
    const w = world();
    ctx.drawImage(base, 0, 0);
    for (const b of all(w, 'building')) {
      if (b.state === 'destroyed') continue;
      const r = Math.max(2.5, (BUILDINGS[b.type].radius / terrain.size) * SIZE * 1.3);
      ctx.fillStyle = b.owner === PLAYER ? (b.state === 'site' ? '#9fd6ec' : '#4fb0dc') : '#e0604a';
      ctx.fillRect(toPx(b.x) - r, toPx(b.z) - r, r * 2, r * 2);
    }
    for (const d of all(w, 'deposit')) {
      if (d.type === 'tree' || d.amount <= 0) continue;
      ctx.fillStyle = d.type === 'iron' ? '#c26a3a' : '#d8d6cc';
      ctx.fillRect(toPx(d.x) - 1.5, toPx(d.z) - 1.5, 3, 3);
    }
    for (const s of all(w, 'settler')) { ctx.fillStyle = '#efe6d2'; ctx.fillRect(toPx(s.x) - 0.8, toPx(s.z) - 0.8, 1.6, 1.6); }
    for (const u of all(w, 'unit')) {
      if (u.downed) continue;
      ctx.fillStyle = u.hero ? '#ffd27a' : u.owner === PLAYER ? '#7fe0ff' : '#ff7a5a';
      const r = u.hero || u.commander ? 2.4 : 1.5;
      ctx.beginPath(); ctx.arc(toPx(u.x), toPx(u.z), r, 0, Math.PI * 2); ctx.fill();
    }
    // camera footprint
    const st = rts.state;
    const reach = st.zoom * 0.9;
    const c = Math.cos(st.yaw), s = Math.sin(st.yaw);
    const corners = [[-reach, -reach * 0.9], [reach, -reach * 0.9], [reach * 0.55, reach * 0.35], [-reach * 0.55, reach * 0.35]].map(([dx, dz]) => [st.x + dx * c + dz * s, st.z - dx * s + dz * c]);
    ctx.strokeStyle = 'rgba(255,240,210,0.9)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    corners.forEach(([x, z], i) => { if (i === 0) ctx.moveTo(toPx(x), toPx(z)); else ctx.lineTo(toPx(x), toPx(z)); });
    ctx.closePath(); ctx.stroke();
  }

  return {
    el: canvas,
    update(dt) { timer += dt; if (timer > 0.25) { timer = 0; draw(); } },
    draw,
  };
}
