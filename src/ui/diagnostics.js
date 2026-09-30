// Diagnostics (F3): records a sample every 30 s from the start of a game — frame times, hitches,
// memory, graphics resources, page elements, what the load governor switched off — and shows the
// history in a small panel with a download button. Meant for finding what grows or slows on a
// player's own machine (the verification runs use a software renderer and cannot see that).
import { h } from './dom.js';

const EVERY = 30; // seconds between samples
const KEEP = 240; // two hours of samples

export function createDiagnostics({ root, session, settings }) {
  const started = performance.now();
  const rows = [];
  const events = [];
  let sinceSample = EVERY - 3; // the first sample a few seconds in
  let hitches = 0, worst = 0, frames = 0, frameSum = 0;
  let open = false, refresh = 0;

  const rc = session.rc;
  const unsub = [
    rc.on('scaled', (d) => note('scaled', d)),
    rc.on('lost', () => note('context lost')),
    rc.on('restored', (d) => note('context restored', d)),
  ];
  function note(kind, data = null) {
    events.push({ t: +(elapsed()).toFixed(1), kind, data });
    if (events.length > 200) events.shift();
  }
  const elapsed = () => (performance.now() - started) / 1000;

  function sample() {
    const s = session.getStats();
    const r = s.renderer;
    const load = rc.load ? rc.load() : null;
    const mem = performance.memory;
    const w = session.world;
    const row = {
      t: Math.round(elapsed()),
      gameTime: Math.round(w.tick / 20),
      fps: frames ? +(1000 / (frameSum / frames)).toFixed(1) : 0,
      frameP95: +s.frameMs.p95.toFixed(1),
      frameP99: +s.frameMs.p99.toFixed(1),
      worstMs: Math.round(worst),
      hitches, // frames slower than 100 ms since the last sample
      simMs: +s.simMs.mean.toFixed(2),
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
      geometries: r.geometries, textures: r.textures, programs: r.programs,
      drawCalls: r.drawCalls, triangles: r.triangles,
      dom: document.getElementsByTagName('*').length,
      entities: Object.keys(w.entities).length,
      pixelRatio: r.pixelRatio, canvas: `${r.width}x${r.height}`,
      reduced: load ? load.reduced.join('+') || '-' : '-',
      speed: session.loop.getSpeed(),
    };
    rows.push(row);
    if (rows.length > KEEP) rows.shift();
    hitches = 0; worst = 0; frames = 0; frameSum = 0;
    return row;
  }

  // ---- panel --------------------------------------------------------------------------------
  const table = h('pre.diag-table');
  const head = h('p.diag-head');
  const panel = h('div.diag.panel', { role: 'dialog', 'aria-label': 'Diagnostics', hidden: true }, [
    h('div.diag-bar', {}, [
      h('strong', { text: 'Diagnostics' }),
      button('Sample now', () => { sample(); render(); }),
      button('Download log', download),
      button('Close (F3)', () => toggle(false)),
    ]),
    head, table,
  ]);
  root.append(panel);
  function button(label, fn) { const b = h('button.btn-ghost', { type: 'button', text: label }); b.addEventListener('click', fn); return b; }

  function info() {
    const load = rc.load ? rc.load() : {};
    return {
      userAgent: navigator.userAgent,
      gpu: load.gpu || '',
      devicePixelRatio: window.devicePixelRatio,
      screen: `${screen.width}x${screen.height}`,
      window: `${innerWidth}x${innerHeight}`,
      quality: rc.qualityName,
      frameCap30: !!settings.frameCap30,
      scenario: session.world.meta.scenarioId,
      difficulty: session.world.meta.difficulty,
    };
  }

  function render() {
    const i = info();
    head.textContent = `${i.gpu || 'graphics chip unknown'} · quality ${i.quality}${i.frameCap30 ? ' · 30 fps cap' : ''} · pixel ratio ${rows.length ? rows[rows.length - 1].pixelRatio : '?'} of ${i.devicePixelRatio} · running ${fmt(elapsed())}`;
    const cols = [['t', 'time'], ['fps', 'fps'], ['frameP95', 'p95 ms'], ['worstMs', 'worst ms'], ['hitches', 'hitches'], ['heapMB', 'heap MB'], ['textures', 'tex'], ['geometries', 'geo'], ['programs', 'shaders'], ['drawCalls', 'draws'], ['dom', 'dom'], ['reduced', 'reduced']];
    const lines = [cols.map(([, label]) => label.padStart(10)).join('')];
    for (const r of rows.slice(-14)) lines.push(cols.map(([c]) => String(c === 't' ? fmt(r.t) : r[c] ?? '-').padStart(10)).join(''));
    const ev = events.slice(-4).map((e) => `${fmt(e.t)} ${e.kind}${e.data ? ' ' + JSON.stringify(e.data) : ''}`);
    table.textContent = lines.join('\n') + (ev.length ? `\n\nEvents:\n${ev.join('\n')}` : '');
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function download() {
    const doc = { kind: 'kindlehold-diagnostics', at: new Date().toISOString(), info: info(), rows, events };
    const blob = new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `kindlehold-diagnostics-${Date.now()}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function toggle(on = !open) {
    open = on;
    panel.hidden = !open;
    if (open) render();
  }

  // measure real frame intervals with our own animation-frame callback (the game clamps its steps)
  let lastRaf = 0, raf = requestAnimationFrame(function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = lastRaf ? (now - lastRaf) / 1000 : 0;
    lastRaf = now;
    measure(dt);
  });
  function measure(dt) {
    if (!(dt > 0)) return;
    if (dt > 10) return; // the tab was in the background
    frames++; frameSum += dt * 1000;
    if (dt > 0.1) hitches++;
    worst = Math.max(worst, dt * 1000);
    if (dt > 0.25) note('long frame', { ms: Math.round(dt * 1000) });
    sinceSample += dt;
    if (sinceSample >= EVERY) { sinceSample = 0; sample(); if (open) render(); }
    if (open && (refresh += dt) > 2) { refresh = 0; render(); }
  }

  return {
    toggle,
    get open() { return open; },
    rows, events,
    dispose() { cancelAnimationFrame(raf); unsub.forEach((u) => u && u()); panel.remove(); },
  };
}
