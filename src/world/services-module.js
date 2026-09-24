// World services: rebuilds the spatial hash of mobile entities and buildings once per tick.
import { all } from './world.js';
import { createSpatialHash } from './spatial.js';

export function createWorldServicesModule() {
  let ctx = null;
  let spatial = null;
  return {
    id: 'world-services',
    kind: 'sim',
    critical: true,
    init(c) {
      ctx = c;
      spatial = createSpatialHash(c.services.terrain.half, 8);
      c.services.spatial = spatial;
    },
    update() {
      const world = ctx.world;
      spatial.clear();
      for (const u of all(world, 'unit')) if (!u.downed) spatial.insert(u);
      for (const s of all(world, 'settler')) spatial.insert(s);
      for (const b of all(world, 'building')) if (b.state !== 'destroyed') spatial.insert(b);
    },
  };
}
