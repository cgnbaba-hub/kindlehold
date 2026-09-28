// Chapter intro: letterboxed camera flight over the valley while the intro is spoken.
// View-only (the simulation is paused meanwhile); any key or click skips it.
import { h, portrait } from './dom.js';
import { portraitKey } from './portraits.js';

export function playCinematic({ root, rts, scenario, reducedMotion = false, onDone }) {
  const shots = scenario.cinematic || [];
  const lines = scenario.intro || [];
  if (!shots.length) { onDone(); return { update() {}, skip() {}, done: true }; }
  const speakerBox = h('div.cine-line');
  const el = h('div.cinematic', { role: 'dialog', 'aria-label': `${scenario.title} — introduction` }, [
    h('div.cine-bar.top', {}, [h('div.cine-title', {}, [scenario.chapter ? h('span.cine-chapter', { text: `Chapter ${scenario.chapter}` }) : null, h('strong', { text: scenario.title })].filter(Boolean))]),
    h('div.cine-bar.bottom', {}, [speakerBox, h('span.cine-skip', { text: 'Click or press any key to skip' })]),
  ]);
  root.append(el);
  const start = { ...rts.serialize() };
  let i = -1, t = 0, dur = 0, from = start, finished = false;
  const ease = (x) => x * x * (3 - 2 * x);

  function next() {
    i++;
    if (i >= shots.length) return finish();
    from = { ...rts.serialize(), x: rts.state.x, z: rts.state.z, yaw: rts.state.yaw, zoom: rts.state.zoom };
    const s = shots[i];
    const line = s.line != null ? lines[s.line] : null;
    speakerBox.replaceChildren();
    if (line) {
      const sp = (scenario.speakers && scenario.speakers[line.speaker]) || { name: line.speaker, role: '' };
      const pk = portraitKey({ portrait: line.speaker, speaker: sp.name });
      speakerBox.append(...[pk ? portrait(pk, 'cine-portrait') : null, h('div', {}, [h('strong', { text: sp.name }), sp.role ? h('span', { text: ` — ${sp.role}` }) : null, h('p', { text: line.text })].filter(Boolean))].filter(Boolean));
    }
    t = 0;
    dur = Math.max(4.5, line ? line.text.length * 0.06 : 4);
  }

  function finish() {
    if (finished) return;
    finished = true;
    window.removeEventListener('keydown', skip, true);
    el.removeEventListener('pointerdown', skip);
    el.classList.add('out');
    setTimeout(() => el.remove(), 450);
    const s = shots[shots.length - 1];
    rts.jumpTo(s.x, s.z, s.yaw, s.zoom);
    onDone();
  }
  function skip(ev) { if (ev) { ev.preventDefault(); ev.stopPropagation(); } finish(); }
  window.addEventListener('keydown', skip, true);
  el.addEventListener('pointerdown', skip);
  next();

  return {
    get done() { return finished; },
    skip,
    update(dt) {
      if (finished) return;
      t += dt;
      const s = shots[i];
      // glide to the shot in the first 2.5 s, then drift slowly while the line is read
      const k = reducedMotion ? 1 : ease(Math.min(1, t / 2.5));
      const drift = reducedMotion ? 0 : Math.max(0, t - 2.5) * 0.025;
      rts.jumpTo(from.x + (s.x - from.x) * k, from.z + (s.z - from.z) * k, from.yaw + (s.yaw + drift - from.yaw) * k, from.zoom + (s.zoom - from.zoom) * k);
      if (t >= dur) next();
    },
  };
}
