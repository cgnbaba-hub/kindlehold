// A running game session: simulation + views + frame loop.
import { createFixedLoop } from '../core/loop.js';
import { createSimulation } from './simulation.js';
import { createRenderContext } from './render-context.js';
import { createSkyLight } from '../environment/sky-light.js';
import { createTerrainView } from '../terrain/terrain-view.js';
import { createWater } from '../environment/water.js';
import { createVegetation } from '../environment/vegetation.js';
import { createWinter } from '../environment/winter.js';
import { createBuildingsView } from '../buildings/view.js';
import { createUnitsView } from '../units/view.js';
import { createEffects } from '../effects/index.js';
import { applyDemoState } from '../demo/states.js';
import { createSelectionView } from '../selection/view.js';
import { createInput } from '../input/index.js';
import { createAudio } from '../audio/index.js';
import { createFrameStats } from '../telemetry/frame-stats.js';
import { log } from '../core/logger.js';

export async function createSession({ container, seed, quality = 'high', verify = false, onCritical, difficulty = 'normal', demo = null, settings = {}, world: loadedWorld = null, hooks = {} }) {
  const sim = createSimulation({ seed, difficulty, onCritical });
  if (loadedWorld) sim.replaceWorld(loadedWorld);
  if (demo) applyDemoState(sim, demo);
  const rc = createRenderContext({ container, terrain: sim.terrain, quality, verify });
  const views = sim.host; // views share the module host for health reporting
  views.register(rc);
  const sky = views.register(createSkyLight({ scene: rc.scene, renderer: rc.renderer, quality: rc.quality }));
  const world = () => sim.world;
  const terrainView = views.register(createTerrainView({ scene: rc.scene, terrain: sim.terrain, quality: rc.quality, world }));
  const water = views.register(createWater({ scene: rc.scene, terrain: sim.terrain }));
  views.register(createVegetation({ scene: rc.scene, terrain: sim.terrain, world, quality: rc.quality }));
  const buildingsView = views.register(createBuildingsView({ scene: rc.scene, terrain: sim.terrain, world, renderer: rc.renderer, sky }));
  const unitsView = views.register(createUnitsView({ scene: rc.scene, terrain: sim.terrain, world, bus: sim.bus, getZoom: () => rc.rts.state.zoom }));
  const effects = views.register(createEffects({ scene: rc.scene, terrain: sim.terrain, world, bus: sim.bus, quality: rc.quality, camera: rc.camera, reducedMotion: () => !!settings.reducedMotion }));
  const winter = views.register(createWinter({
    scene: rc.scene, world, terrainView, water, sky, quality: rc.quality, reducedMotion: () => !!settings.reducedMotion,
    getTarget: () => { const st = rc.rts.state; return { x: st.x, y: sim.terrain.height(st.x, st.z), z: st.z, scale: 1 }; },
  }));
  winter.snap();
  buildingsView.cameraTarget = { x: 0, z: 0 };
  const overlay = { placementReason: '' };
  const input = views.register(createInput({ canvas: rc.renderer.domElement, rc, sim, terrain: sim.terrain, settings, hooks }));
  const selectionView = views.register(createSelectionView({ scene: rc.scene, terrain: sim.terrain, world, sim, input, camera: rc.camera, overlay }));
  const audio = views.register(createAudio({ bus: sim.bus, world, settings, getListener: () => rc.rts.state }));
  if (demo) terrainView.seedWear(0.5);
  rc.rts.setPreset('settlement');
  if (loadedWorld && loadedWorld.camera) rc.rts.jumpTo(loadedWorld.camera.x, loadedWorld.camera.z, loadedWorld.camera.yaw, loadedWorld.camera.zoom);

  const stats = createFrameStats();
  let running = false;
  let last = 0;
  let resolveFirst;
  const firstFrame = new Promise((r) => { resolveFirst = r; });
  let frames = 0;
  let hudErrors = 0;

  const loop = createFixedLoop({
    step() {
      const t0 = performance.now();
      sim.step();
      stats.pushSim(performance.now() - t0);
    },
    render(alpha, frameDt) {
      rc.rts.update(frameDt);
      sky.setHour(sim.world.time.hour);
      water.setSky(rc.scene.fog.color, sky.nightFactor);
      selectionView.setNight(sky.nightFactor);
      const st = rc.rts.state;
      sky.fitShadow(st.x, st.z, Math.min(120, 30 + st.zoom * 0.8));
      buildingsView.cameraTarget.x = st.x; buildingsView.cameraTarget.z = st.z;
      views.render(alpha, { dt: frameDt, time: sim.world.tick / 20 });
      if (hooks.onFrame) {
        try { hooks.onFrame(frameDt); } catch (err) {
          hudErrors++;
          log.error('ui', `HUD update failed: ${err && err.message}`, err);
          if (hudErrors === 3 && hooks.onUiFailure) hooks.onUiFailure(err);
        }
      }
      rc.draw();
    },
  });

  let frozen = false;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame); // schedule first: one throwing frame can never stop the game
    if (frozen) { last = now; return; }
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    stats.pushFrame(dt * 1000 || 16.7);
    loop.advance(dt);
    frames++;
    if (frames === 2) resolveFirst();
  }

  const session = {
    sim, rc, stats, loop, firstFrame, effects, winter, unitsView, buildingsView, sky, settings, input, selectionView, audio, overlay, marker: (k, x, z) => selectionView.marker(k, x, z),
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
    /** Verification: advance n frames of fixed real time (simulation + effects), deterministic. */
    advanceFrames(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) loop.advance(dt); return rc.info(); },
    /** Verification: stop the continuous loop (screenshots then use renderNow). */
    freeze(on = true) { frozen = !!on; if (on) loop.advance(0); return frozen; },
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
