// Save-game migrations. MIGRATIONS[n] upgrades a world from schema n to n+1.
// Schema 1 (pre-release test saves) lacked map entry points, stats.buildingsBuilt and
// per-player burnPenalty; schema 2 adds them.

export const MIGRATIONS = {
  1(world) {
    world.mapEntry = world.mapEntry || { x: -96, z: 96 };
    world.enemyEntry = world.enemyEntry || { x: 100, z: -100 };
    world.stats = world.stats || {};
    if (typeof world.stats.buildingsBuilt !== 'number') world.stats.buildingsBuilt = 0;
    for (const id of Object.keys(world.players || {})) {
      const p = world.players[id];
      if (typeof p.burnPenalty !== 'number') p.burnPenalty = 0;
    }
    return world;
  },
};
