// A running game session: simulation + views + frame loop.
import { createFixedLoop } from '../core/loop.js';
import { createSimulation } from './simulation.js';
import { createRenderContext } from './render-context.js';
import { createSkyLight } from '../environment/sky-light.js';
import { createTerrainView } from '../terrain/terrain-view.js';
import { createFrameStats } from '../telemetry/frame-stats.js';
import { log } from '../core/logger.js';

export async function createSession({ container, seed, quality = 'high', verify = false, onCritical }) {
  const sim = createSimulation({ seed, onCritical });
  const rc = createRenderContext({ container, terrain: sim.terrain, quality, verify });
  const views = sim.host; // views share the module host for health reporting
  views.register(rc);
  const sky = views.register(createSkyLight({ scene: rc.scene, renderer: rc.renderer, quality: rc.quality }));
  views.register(createTerrainView({ scene: rc.scene, terrain: sim.terrain }));
  rc.rts.setPreset('settlement');

  const stats = createFrameStats();
  let running = false;
  let last = 0;
  let resolveFirst;
  const firstFrame = new Promise((r) => { resolveFirst = r; });
  let frames = 0;

  const loop = createFixedLoop({
    step() {
      const t0 = performance.now();
      sim.step();
      stats.pushSim(performance.now() - t0);
    },
    render(alpha, frameDt) {
      rc.rts.update(frameDt);
      sky.setHour(sim.world.time.hour);
      const st = rc.rts.state;
      sky.fitShadow(st.x, st.z, Math.min(120, 30 + st.zoom * 0.8));
      views.render(alpha, { dt: frameDt, time: sim.world.tick / 20 });
      rc.draw();
    },
  });

  function frame(now) {
    if (!running) return;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    stats.pushFrame(dt * 1000 || 16.7);
    loop.advance(dt);
    frames++;
    if (frames === 2) resolveFirst();
    requestAnimationFrame(frame);
  }

  const session = {
    sim, rc, stats, loop, firstFrame,
    get world() { return sim.world; },
    start() { running = true; requestAnimationFrame(frame); },
    stop() { running = false; },
    lastPreset: null,
    setCameraPreset(name) { session.lastPreset = name; return rc.rts.setPreset(name); },
    setTimeOfDay(h) { sim.world.time.hour = h; sky.setHour(h); return true; },
    runTicks(n) {
      const t0 = performance.now();
      const count = Math.max(0, Math.min(200000, n | 0));
      for (let i = 0; i < count; i++) sim.step();
      return { ticks: count, ms: performance.now() - t0 };
    },
    renderNow() { loop.advance(0); return rc.info(); },
    getStats() { return { ...stats.summary(), renderer: rc.info(), tick: sim.world.tick, hour: sim.world.time.hour }; },
    getHealth() { return views.health(); },
    getWorldHash() { return sim.hash(); },
    sampleFrame() { return rc.sampleFrame(); },
    issue(cmd) { return sim.issue(cmd); },
    dispose() { running = false; views.disposeAll(); },
  };
  log.info('session', `session created seed=${seed} quality=${quality}`);
  return session;
}
