// window.__GAME__ verification API (enabled in dev and with ?verify=1).
// Everything here drives the game through the same paths as the player.

import { findSpot } from '../demo/bot.js';

export function installVerifyApi(session) {
  const api = {
    version: 1,
    setCameraPreset: (name) => session.setCameraPreset(name),
    setTimeOfDay: (hour) => session.setTimeOfDay(hour),
    runTicks: (n) => session.runTicks(n),
    getStats: () => session.getStats(),
    getHealth: () => session.getHealth(),
    getWorldHash: () => session.getWorldHash(),
    sampleFrame: () => session.sampleFrame(),
    renderNow: () => session.renderNow(),
    freeze: (on) => session.freeze(on),
    advanceFrames: (n, dt) => session.advanceFrames(n, dt),
    /** Named pre-capture actions for verification presets. */
    action(name) {
      const w = session.world;
      if (name === 'flare') {
        const hero = Object.values(w.entities).find((e) => e.hero);
        const foes = Object.values(w.entities).filter((e) => e.kind === 'unit' && e.owner === 'p2' && hero && Math.hypot(e.x - hero.x, e.z - hero.z) < 14);
        if (!hero || !foes.length) return false;
        let x = 0, z = 0; foes.forEach((f) => { x += f.x; z += f.z; });
        hero.abilityCd = {};
        session.issue({ type: 'ability', heroId: hero.id, ability: 'flare', x: x / foes.length, z: z / foes.length });
        session.advanceFrames(9, 1 / 30);
        return true;
      }
      return false;
    },
    issue: (cmd) => session.issue(cmd),
    save: (slot) => session.save && session.save(slot),
    load: (slot) => session.load && session.load(slot),
    world: () => session.world,
    /** Screen position (CSS px) of a world point, for driving the real UI in e2e tests. */
    project(x, z, y = null) {
      const rc = session.rc;
      const v = { x, y: y ?? session.sim.terrain.height(x, z) + 1, z };
      const p = rc.camera.position.clone().set(v.x, v.y, v.z).project(rc.camera);
      const r = rc.renderer.domElement.getBoundingClientRect();
      return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height, visible: p.z < 1 };
    },
    findSpot(type, x, z) { return findSpot(session.sim.world, session.sim.services, type, x, z); },
    find(kind, type) { return Object.values(session.world.entities).filter((e) => e.kind === kind && (!type || e.type === type)).map((e) => e.id); },
    /** Make a critical module throw (tests the recoverable error screen). */
    forceCriticalFailure() { session.sim.host.register({ id: 'test-critical-' + Date.now(), kind: 'sim', critical: true, update() { throw new Error('forced failure for testing'); } }); },
    session,
  };
  window.__GAME__ = api;
  return api;
}

export function markReady() {
  window.__GAME_READY__ = true;
  document.documentElement.dataset.gameReady = 'true';
}
