// A running game session: simulation + views + frame loop.
import { createFixedLoop } from '../core/loop.js';
import { createSimulation } from './simulation.js';
import { createRenderContext } from './render-context.js';
import { createSkyLight } from '../environment/sky-light.js';
import { CLOUDS, ENV, SHROUD } from '../render/structure-material.js';
import { createTerrainView } from '../terrain/terrain-view.js';
import { createWater } from '../environment/water.js';
import { createVegetation } from '../environment/vegetation.js';
import { createWinter } from '../environment/winter.js';
import { createShroud } from '../environment/shroud.js';
import { createWildlifeView } from '../environment/wildlife-view.js';
import { createPoisView } from '../environment/pois-view.js';
import { createBuildingsView } from '../buildings/view.js';
import { createUnitsView } from '../units/view.js';
import { loadFigureAssets } from '../units/skinned-figures.js';
import { createEffects } from '../effects/index.js';
import { applyDemoState } from '../demo/states.js';
import { createSelectionView } from '../selection/view.js';
import { createInput } from '../input/index.js';
import { createAudio } from '../audio/index.js';
import { createFrameStats } from '../telemetry/frame-stats.js';
import { log } from '../core/logger.js';

export async function createSession({ container, seed, quality = 'high', verify = false, onCritical, difficulty = 'normal', demo = null, settings = {}, world: loadedWorld = null, hooks = {}, scenarioId = 'harrowmere', campaign = null }) {
  const sim = createSimulation({ seed, difficulty, onCritical, scenarioId, campaign });
  if (loadedWorld) sim.replaceWorld(loadedWorld);
  if (demo) applyDemoState(sim, demo);
  const rc = createRenderContext({ container, terrain: sim.terrain, quality, verify });
  const views = sim.host; // views share the module host for health reporting
  views.register(rc);
  const sky = views.register(createSkyLight({ scene: rc.scene, renderer: rc.renderer, quality: rc.quality }));
  rc.on('restored', () => sky.invalidateEnv());
  ENV.on.value = rc.quality.post && rc.quality.ibl !== false ? 1 : 0;
  SHROUD.linear.value = rc.quality.post ? 1 : 0;
  const world = () => sim.world;
  // the fog of war lifts while a chapter intro flies over the valley
  let showShroud = true;
  const shroud = views.register(createShroud({ world, terrain: sim.terrain, enabled: () => showShroud }));
  shroud.snap();
  const terrainView = views.register(createTerrainView({ scene: rc.scene, terrain: sim.terrain, quality: rc.quality, world }));
  const water = views.register(createWater({ scene: rc.scene, terrain: sim.terrain }));
  views.register(createVegetation({ scene: rc.scene, terrain: sim.terrain, world, quality: rc.quality }));
  views.register(createWildlifeView({ scene: rc.scene, terrain: sim.terrain, world }));
  views.register(createPoisView({ scene: rc.scene, terrain: sim.terrain, world }));
  const buildingsView = views.register(createBuildingsView({ scene: rc.scene, terrain: sim.terrain, world, renderer: rc.renderer, sky }));
  // modelled, animated characters (KayKit); ?figs=classic keeps the procedural figures
  const figureAssets = typeof location !== 'undefined' && /[?&]figs=classic\b/.test(location.search) ? null : await loadFigureAssets();
  const unitsView = views.register(createUnitsView({ scene: rc.scene, terrain: sim.terrain, world, bus: sim.bus, getZoom: () => rc.rts.state.zoom, figureAssets }));
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
  const audio = views.register(createAudio({ bus: sim.bus, world, settings, getListener: () => rc.rts.state, terrain: sim.terrain }));
  if (demo) terrainView.seedWear(0.5);
  // start over the player's town, wherever the map puts it
  { const ps = sim.terrain.map.playerStart; rc.rts.jumpTo(ps.x + 2, ps.z, 0.6, 60); }
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
      effects.setNight(sky.nightFactor);
      selectionView.setNight(sky.nightFactor);
      const st = rc.rts.state;
      sky.fitShadow(st.x, st.z, Math.min(120, 30 + st.zoom * 0.8));
      rc.setLook({ night: sky.nightFactor, zoom: st.zoom, tilt: settings.depthOfField !== false });
      // drifting cloud shadows by day (denser before and during a shower); none on Low quality
      const wx = sim.world.weather;
      CLOUDS.time.value = sim.world.tick / 20;
      CLOUDS.strength.value = rc.quality.post && rc.quality.clouds !== false ? (0.2 + (wx && wx.kind === 'rain' ? 0.2 * (wx.intensity || 1) : 0)) * (1 - sky.nightFactor) : 0;
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

  let frozen = false, cpuMs = 0;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame); // schedule first: one throwing frame can never stop the game
    if (frozen) { last = now; return; }
    // optional 30 fps limit: skip every other display frame (the next one catches up the time)
    if (settings.frameCap30 && last && now - last < 1000 / 30 - 4) return;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    stats.pushFrame(dt * 1000 || 16.7);
    if (dt) rc.govern(dt * 1000, cpuMs);
    const t0 = performance.now();
    rc.drawMs = 0;
    loop.advance(dt);
    cpuMs = performance.now() - t0 - rc.drawMs; // simulation and HUD only
    frames++;
    if (frames === 2) resolveFirst();
  }

  const session = {
    sim, rc, stats, loop, firstFrame, effects, winter, unitsView, buildingsView, sky, settings, input, selectionView, audio, overlay, marker: (k, x, z) => selectionView.marker(k, x, z),
    get world() { return sim.world; },
    setShroud(on) { showShroud = !!on; shroud.snap(); },
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
