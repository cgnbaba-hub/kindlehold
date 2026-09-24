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
    issue: (cmd) => session.issue(cmd),
    save: (slot) => session.save && session.save(slot),
    load: (slot) => session.load && session.load(slot),
    world: () => session.world,
    session,
  };
  window.__GAME__ = api;
  return api;
}

export function markReady() {
  window.__GAME_READY__ = true;
  document.documentElement.dataset.gameReady = 'true';
}
