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
      const map = c.services.terrain.map;
      if (map.palisade) {
        // the ford-fort palisade is impassable except at its gate (facing the player's side)
        const camp = map.enemyCamp, start = map.playerStart;
        const gate = Math.atan2(start.x - camp.x, start.z - camp.z);
        for (let a = 0; a < Math.PI * 2; a += map.palisade.step) {
          let da = a - gate; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
          if (Math.abs(da) < map.palisade.gateHalfAngle + 0.05) continue;
          nav.blockStatic(camp.x + Math.sin(a) * map.palisade.r, camp.z + Math.cos(a) * map.palisade.r, 0.9);
        }
      }
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
    setFrozen: (f) => nav.setFrozen(f),
    isFrozen: () => nav.isFrozen(),
    isIce: (x, z) => nav.isIce(x, z),
    budgetLeft: () => budget,
    rebuildDynamic,

    /**
     * Request a path for an entity. Returns 'ok', 'wait' (budget exhausted this tick) or 'fail'.
     * On success sets e.path = [[x,z],...] and e.pathI = 0.
     */
    requestPath(e, tx, tz) {
      if (budget <= 0) return 'wait';
      // the ford retry costs up to two more searches: only when the budget still has room for them
      const r = nav.findPath(e.x, e.z, tx, tz, { retry: budget >= 3 });
      budget -= (r && r.searches) || 1;
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

export const FORMATIONS = ['block', 'line', 'wedge', 'ring'];

/**
 * Formation slots facing from (fromX,fromZ) towards (x,z), front first: callers sort front-line
 * troops first and ranged ones last.
 *   block — a few deep rows (the default); line — one wide rank (two if many);
 *   wedge — a spearhead with the first unit at the tip; ring — a circle facing out, the last
 *   `inner` units (archers, the hero) in its middle.
 */
export function formationSlots(count, x, z, fromX, fromZ, spacing = 1.9, shape = 'block', inner = 0) {
  const dirX = x - fromX, dirZ = z - fromZ;
  const len = Math.hypot(dirX, dirZ);
  const fx = len > 1e-6 ? dirX / len : 0, fz = len > 1e-6 ? dirZ / len : 1; // forward
  const rx = fz, rz = -fx;                 // right
  const at = (col, row) => [x + rx * col * spacing - fx * row * spacing, z + rz * col * spacing - fz * row * spacing];
  const slots = [];
  if (shape === 'ring' && count > 3) {
    const out = Math.max(3, count - Math.min(inner, count - 3));
    const r = Math.max(2.2, (out * spacing) / (Math.PI * 2));
    for (let i = 0; i < out; i++) { const a = (i / out) * Math.PI * 2; slots.push([x + Math.sin(a) * r, z + Math.cos(a) * r]); }
    const rest = count - out, r2 = Math.min(r - spacing, Math.max(0.9, (rest * spacing) / (Math.PI * 2)));
    for (let i = 0; i < rest; i++) { const a = (i / Math.max(1, rest)) * Math.PI * 2 + 0.4; slots.push(rest === 1 ? [x, z] : [x + Math.sin(a) * r2, z + Math.cos(a) * r2]); }
    return slots;
  }
  if (shape === 'wedge') {
    // rows of 1, 2, 3 … behind the tip, each row centred: the point of a spear
    let i = 0;
    for (let row = 0; i < count; row++) {
      const inRow = Math.min(row + 1, count - i);
      for (let k = 0; k < inRow; k++, i++) slots.push(at(k - (inRow - 1) / 2, row * 0.85));
    }
    return slots;
  }
  const perRow = shape === 'line' ? Math.max(3, count > 12 ? Math.ceil(count / 2) : count) : Math.max(3, Math.ceil(Math.sqrt(count * 2)));
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    slots.push(at((i % perRow) - (inRow - 1) / 2, row));
  }
  return slots;
}
