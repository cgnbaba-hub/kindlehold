// Save-game migrations. MIGRATIONS[n] upgrades a world from schema n to n+1.
// Schema 1 (pre-release test saves) lacked map entry points, stats.buildingsBuilt and
// per-player burnPenalty; schema 2 adds them. Schema 3 adds Taler and taxes. Schema 4 adds
// flour, bread and tools, and counts goods on their way to a workplace per kind.

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
  // Schema 3 adds Taler (money), the tax level and the payday timer.
  2(world) {
    for (const id of Object.keys(world.players || {})) {
      const p = world.players[id];
      p.res = p.res || {};
      if (typeof p.res.taler !== 'number') p.res.taler = 0;
      if (typeof p.tax !== 'number') p.tax = 1;
      if (typeof p.nextPayTick !== 'number') p.nextPayTick = (world.tick || 0) + 2400;
    }
    world.stats = world.stats || {};
    for (const k of ['produced', 'consumed']) {
      world.stats[k] = world.stats[k] || {};
      if (typeof world.stats[k].taler !== 'number') world.stats[k].taler = 0;
    }
    return world;
  },
  // Schema 4: the production chains (flour, bread, tools); inIncoming becomes { good: amount }.
  3(world) {
    const NEW = ['flour', 'bread', 'tools'];
    for (const id of Object.keys(world.players || {})) {
      const p = world.players[id];
      p.res = p.res || {};
      for (const r of NEW) if (typeof p.res[r] !== 'number') p.res[r] = 0;
    }
    world.stats = world.stats || {};
    for (const k of ['produced', 'consumed']) {
      world.stats[k] = world.stats[k] || {};
      for (const r of NEW) if (typeof world.stats[k][r] !== 'number') world.stats[k][r] = 0;
    }
    for (const e of Object.values(world.entities || {})) {
      if (!e || e.kind !== 'building' || !e.stock) continue;
      const n = e.stock.inIncoming;
      if (typeof n === 'number') e.stock.inIncoming = n > 0 ? { provisions: n } : {};
      else if (!n || typeof n !== 'object') e.stock.inIncoming = {};
    }
    return world;
  },
};
