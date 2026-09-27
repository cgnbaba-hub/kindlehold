// Wildlife: deer herds graze in the forest clearings of the valley, shy away from people,
// and slowly grow back. Hunters live off them. Deterministic (world RNG), saved with the world.
import { all, spawn, remove, worldRng, emit } from '../world/world.js';
import { DT } from '../core/contracts.js';
import { distToPolyline } from '../world/terrain-data.js';

export const DEER = { speed: 1.4, fleeSpeed: 5.2, fleeRadius: 7, roam: 11, maxPerHerd: 7, breedEvery: 50 * 20 };
const HERDS = 9;

export function spawnDeer(world, herd, x, z) {
  return spawn(world, { kind: 'animal', type: 'deer', owner: 'none', x, z, heading: 0, hp: 1, herd: herd.id, goal: null, wait: 0, flee: 0, anim: 'graze', reservedBy: null });
}

/** Place herds in forest clearings: near trees, on dry flat land, away from both settlements. */
export function setupWildlife(world, terrain) {
  if (world.herds) return;
  const rng = worldRng(world);
  const map = terrain.map;
  const trees = all(world, 'deposit').filter((d) => d.type === 'tree');
  world.herds = [];
  let tries = 0;
  while (world.herds.length < HERDS && tries++ < 400 && trees.length) {
    const t = trees[rng.int(0, trees.length - 1)];
    const x = t.x + rng.range(-8, 8), z = t.z + rng.range(-8, 8);
    if (Math.abs(x) > terrain.half - 14 || Math.abs(z) > terrain.half - 14) continue;
    if (terrain.waterDepth(x, z) > 0 || terrain.slope(x, z) > 0.4) continue;
    if (distToPolyline(x, z, map.river.points) < map.river.bankWidth + 4) continue;
    if (Math.hypot(x - map.playerStart.x, z - map.playerStart.z) < 34) continue;
    if (Math.hypot(x - map.enemyCamp.x, z - map.enemyCamp.z) < 36) continue;
    if (world.herds.some((h) => Math.hypot(h.x - x, h.z - z) < 38)) continue;
    const herd = { id: world.herds.length + 1, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, nextBirth: 0 };
    world.herds.push(herd);
    const n = rng.int(3, 5);
    for (let i = 0; i < n; i++) spawnDeer(world, herd, herd.x + rng.range(-4, 4), herd.z + rng.range(-4, 4));
  }
}

export function createWildlifeModule() {
  let ctx = null;
  const unsub = [];
  const near = [];

  function step(world) {
    const nav = ctx.services.nav;
    const spatial = ctx.services.spatial;
    const rng = worldRng(world);
    const herds = world.herds || [];
    const count = new Map();
    for (const a of all(world, 'animal')) count.set(a.herd, (count.get(a.herd) || 0) + 1);
    for (const a of all(world, 'animal')) {
      a.px = a.x; a.pz = a.z;
      const herd = herds.find((h) => h.id === a.herd);
      if (!herd) continue;
      // shy: bolt away from the nearest person (hunters stalk to just outside this radius)
      if ((world.tick + a.id) % 6 === 0 && spatial) {
        spatial.query(a.x, a.z, DEER.fleeRadius, near, (e) => e.kind === 'unit' || (e.kind === 'settler' && !e.hidden));
        if (near.length) {
          const e = near[0];
          const dx = a.x - e.x, dz = a.z - e.z, d = Math.hypot(dx, dz) || 1;
          a.goal = [a.x + (dx / d) * 9, a.z + (dz / d) * 9];
          a.flee = 40;
        }
      }
      if (!a.goal) {
        if (a.wait > 0) { a.wait--; a.anim = 'graze'; continue; }
        const ang = rng.range(0, Math.PI * 2), r = rng.range(1, DEER.roam);
        a.goal = [herd.x + Math.cos(ang) * r, herd.z + Math.sin(ang) * r];
      }
      const speed = a.flee > 0 ? DEER.fleeSpeed : DEER.speed;
      if (a.flee > 0) a.flee--;
      const dx = a.goal[0] - a.x, dz = a.goal[1] - a.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { a.goal = null; a.wait = rng.int(40, 160); a.anim = 'graze'; continue; }
      const stepLen = Math.min(d, speed * DT);
      const nx = a.x + (dx / d) * stepLen, nz = a.z + (dz / d) * stepLen;
      if (!nav.walkable(nx, nz)) { a.goal = null; a.wait = 20; continue; }
      a.x = nx; a.z = nz; a.heading = Math.atan2(dx, dz);
      a.anim = a.flee > 0 ? 'run' : 'walk';
    }
    // herds slowly recover while at least two animals remain
    if (world.tick % 20 === 7) {
      for (const h of herds) {
        const n = count.get(h.id) || 0;
        if (n < 2 || n >= DEER.maxPerHerd) continue;
        if (!h.nextBirth) h.nextBirth = world.tick + DEER.breedEvery;
        if (world.tick >= h.nextBirth) {
          h.nextBirth = world.tick + DEER.breedEvery;
          const a = spawnDeer(world, h, h.x + rng.range(-3, 3), h.z + rng.range(-3, 3));
          if (a) emit(world, 'animal:born', { id: a.id });
        }
      }
    }
  }

  return {
    id: 'wildlife',
    kind: 'sim',
    init(c) {
      ctx = c;
      unsub.push(c.bus.on('world:setup-done', () => setupWildlife(ctx.world, ctx.services.terrain)));
      // saves from before wildlife existed get their herds on load
      unsub.push(c.bus.on('world:loaded', () => setupWildlife(ctx.world, ctx.services.terrain)));
    },
    update() { step(ctx.world); },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
  };
}

/** A hunter's kill: the animal falls and is removed; returns true when it existed. */
export function killAnimal(world, id, by) {
  const a = world.entities[id];
  if (!a || a.kind !== 'animal') return false;
  emit(world, 'animal:killed', { id, x: a.x, z: a.z, by });
  remove(world, id, 'hunted');
  return true;
}
