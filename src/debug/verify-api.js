// window.__GAME__ verification API (enabled in dev and with ?verify=1).
// Everything here drives the game through the same paths as the player.

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
