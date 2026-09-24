// Navigation module: owns the nav grid (derived), a per-tick path budget, movement
// helpers and formation slots. Entities store only their path (serializable arrays).
import { createNavGrid } from './nav-grid.js';
import { all } from '../world/world.js';
import { BUILDINGS } from '../buildings/defs.js';
import { EV } from '../core/contracts.js';

export const PATH_BUDGET_PER_TICK = 12;

export function createNavigationModule() {
  let ctx = null;
  let nav = null;
  let budget = PATH_BUDGET_PER_TICK;
  const unsub = [];

  function rebuildDynamic() {
    nav.clearDynamic();
    for (const b of all(ctx.world, 'building')) {
      if (b.state === 'destroyed') continue;
      nav.block(b.x, b.z, BUILDINGS[b.type].navRadius);
    }
  }

  const mod = {
    id: 'navigation',
    kind: 'sim',
    critical: true,
    init(c) {
      ctx = c;
      nav = createNavGrid(c.services.terrain); // one grid per simulation (dynamic blocks are per world)
      c.services.nav = mod;
      unsub.push(c.bus.on(EV.BUILDING_PLACED, ({ id }) => {
        const b = ctx.world.entities[id];
        if (b) nav.block(b.x, b.z, BUILDINGS[b.type].navRadius);
      }));
      unsub.push(c.bus.on('building:footprint-cleared', ({ x, z, type }) => nav.unblock(x, z, BUILDINGS[type].navRadius)));
      unsub.push(c.bus.on('world:loaded', rebuildDynamic));
      unsub.push(c.bus.on('world:setup-done', rebuildDynamic));
    },
    update() { budget = PATH_BUDGET_PER_TICK; },
    deserialize() { if (ctx) rebuildDynamic(); },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
    getHealthStatus() { return { status: 'ok', detail: `requests=${nav.stats.requests} partial=${nav.stats.partial}` }; },

    grid: () => nav,
    walkable: (x, z) => nav.walkable(x, z),
    budgetLeft: () => budget,
    rebuildDynamic,

    /**
     * Request a path for an entity. Returns 'ok', 'wait' (budget exhausted this tick) or 'fail'.
     * On success sets e.path = [[x,z],...] and e.pathI = 0.
     */
    requestPath(e, tx, tz) {
      if (budget <= 0) return 'wait';
      budget--;
      const r = nav.findPath(e.x, e.z, tx, tz);
      if (!r) { e.path = null; return 'fail'; }
      e.path = r.points;
      e.pathI = 0;
      e.pathPartial = r.partial;
      return 'ok';
    },
    nearestWalkablePoint: (x, z, r) => nav.nearestWalkablePoint(x, z, r),
  };
  return mod;
}

/**
 * Move an entity along its path. Returns true when the final waypoint is reached.
 * Stores previous position for render interpolation.
 */
export function followPath(e, speed, dt) {
  if (!e.path || e.pathI >= e.path.length) return true;
  let remaining = speed * dt;
  while (remaining > 0 && e.pathI < e.path.length) {
    const [tx, tz] = e.path[e.pathI];
    const dx = tx - e.x, dz = tz - e.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4) e.heading = Math.atan2(dx, dz);
    if (d <= remaining) {
      e.x = tx; e.z = tz; remaining -= d; e.pathI++;
    } else {
      e.x += (dx / d) * remaining; e.z += (dz / d) * remaining; remaining = 0;
    }
  }
  if (e.pathI >= e.path.length) { e.path = null; return true; }
  return false;
}

/** Formation slots: rows facing from (fromX,fromZ) towards (x,z). Ranged units go to the back rows. */
export function formationSlots(count, x, z, fromX, fromZ, spacing = 1.9) {
  const dirX = x - fromX, dirZ = z - fromZ;
  const len = Math.hypot(dirX, dirZ) || 1;
  const fx = dirX / len, fz = dirZ / len; // forward
  const rx = fz, rz = -fx;                 // right
  const perRow = Math.max(3, Math.ceil(Math.sqrt(count * 2)));
  const slots = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const col = (i % perRow) - (inRow - 1) / 2;
    slots.push([x + rx * col * spacing - fx * row * spacing, z + rz * col * spacing - fz * row * spacing]);
  }
  return slots;
}
