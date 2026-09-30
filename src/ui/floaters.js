// Floating "+4 timber" labels that rise from a workplace when a batch is done (the settler-game
// feedback that shows the economy at work). A handful of pooled DOM nodes, positioned by projecting
// the world point every frame; nothing is created while the pool is busy.
import * as THREE from 'three';
import { h, icon } from './dom.js';
import { EV, PLAYER } from '../core/contracts.js';

const LIFE = 1.7; // seconds
const MAX = 12;

export function createFloaters({ root, session }) {
  const layer = h('div.floaters', { 'aria-hidden': 'true' });
  root.append(layer);
  const live = [];
  const free = [];
  const v = new THREE.Vector3();
  const unsub = [];

  function node() {
    if (free.length) return free.pop();
    const text = h('span');
    const el = h('div.floater', {}, [h('span.floater-icon'), text]);
    return { el, text };
  }

  function add(x, z, res, amount) {
    if (live.length >= MAX || !(amount > 0)) return;
    // a second batch at the same place in the same moment adds up instead of stacking labels
    const same = live.find((f) => f.res === res && f.t < 0.4 && Math.hypot(f.x - x, f.z - z) < 3);
    if (same) { same.amount += amount; same.text.textContent = `+${same.amount}`; return; }
    const n = node();
    n.el.firstChild.replaceChildren(icon(res, 'icon icon-xs'));
    n.text.textContent = `+${amount}`;
    layer.append(n.el);
    live.push({ ...n, x, z, y: session.sim.terrain.height(x, z) + 3.2, res, amount, t: 0 });
  }

  unsub.push(session.sim.bus.on(EV.PRODUCTION_CYCLE, (d) => {
    const w = session.world;
    const e = w.entities[d.id];
    if (!e || e.owner !== PLAYER) return;
    const res = d.res === 'meals' ? 'canteen' : d.res;
    add(d.x, d.z, res, Math.round(d.amount));
  }));

  function update(dt) {
    if (!live.length) return;
    const rc = session.rc;
    const cam = rc.camera;
    const rect = rc.renderer.domElement.getBoundingClientRect();
    for (let i = live.length - 1; i >= 0; i--) {
      const f = live[i];
      f.t += Math.min(dt, 0.1);
      if (f.t >= LIFE) { f.el.remove(); free.push({ el: f.el, text: f.text }); live.splice(i, 1); continue; }
      v.set(f.x, f.y + f.t * 1.1, f.z).project(cam);
      const onScreen = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      f.el.style.display = onScreen ? '' : 'none';
      if (!onScreen) continue;
      const px = rect.left + (v.x * 0.5 + 0.5) * rect.width, py = rect.top + (-v.y * 0.5 + 0.5) * rect.height;
      f.el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -100%)`;
      f.el.style.opacity = String(Math.min(1, (LIFE - f.t) / 0.5, f.t / 0.15));
    }
  }

  return {
    update,
    dispose() { unsub.forEach((u) => u()); layer.remove(); live.length = 0; free.length = 0; },
  };
}
