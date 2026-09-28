// Shared showcase runner: builds a session from a showcase config and exposes the
// verification API (window.__GAME__ / __GAME_READY__) plus the showcase's own health.
import { createSession } from '../app/session.js';
import { installVerifyApi, markReady } from '../debug/verify-api.js';
import { createHud } from '../ui/hud.js';
import { loadSettings } from '../app/settings.js';
import { showErrorOverlay } from '../app/error-overlay.js';
import { h } from '../ui/dom.js';

export async function startShowcase(id, config, params) {
  const cfg = { seed: '1337', demo: null, camera: 'settlement', hour: 11, ticks: 0, hud: false, ...config };
  const container = document.getElementById('app');
  const boot = document.getElementById('boot-screen');
  const settings = loadSettings();
  const session = await createSession({
    container, seed: params.get('seed') || cfg.seed, quality: params.get('quality') || 'high', verify: true, settings, demo: cfg.demo,
    onCritical: (mid, err) => showErrorOverlay({ title: `Showcase "${id}" failed`, message: `Module ${mid} failed.`, detail: err && err.stack }),
  });
  if (cfg.ticks) session.runTicks(cfg.ticks);
  session.setCameraPreset(cfg.camera);
  if (cfg.cameraAt) session.rc.rts.jumpTo(...cfg.cameraAt);
  session.setTimeOfDay(Number(params.get('hour') ?? cfg.hour));
  if (cfg.freezeTime) session.world.time.running = false;
  const uiRoot = h('div.ui-root');
  container.append(uiRoot);
  if (cfg.hud) createHud({ root: uiRoot, session, input: session.input, settings, actions: { pause: () => {}, cycleSpeed: () => {} } });
  uiRoot.append(h('div.showcase-tag.panel', {}, [h('strong', { text: `Showcase: ${id}` }), h('span', { text: cfg.caption || '' })]));
  if (cfg.setup) await cfg.setup(session, uiRoot, params);
  const api = installVerifyApi(session);
  api.showcase = { id, health: () => (cfg.health ? cfg.health(session) : { status: 'ok' }) };
  session.start();
  if (cfg.paused) session.loop.pause(); // static line-ups: no simulation (units would fight)
  if (boot) boot.remove();
  await session.firstFrame;
  markReady();
  return session;
}
