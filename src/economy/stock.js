// Player stock helpers (the Keep store). All mutations emit resource:changed.
import { EV, RESOURCES } from '../core/contracts.js';
import { emit } from '../world/world.js';

export function canAfford(world, owner, cost) {
  const res = world.players[owner].res;
  for (const r in cost) if ((res[r] || 0) < cost[r]) return false;
  return true;
}

export function missingFor(world, owner, cost) {
  const res = world.players[owner].res;
  const out = {};
  for (const r in cost) if ((res[r] || 0) < cost[r]) out[r] = cost[r] - (res[r] || 0);
  return out;
}

export function addRes(world, owner, r, amount, reason = '') {
  if (!RESOURCES.includes(r) || !amount) return;
  const p = world.players[owner];
  p.res[r] = Math.max(0, (p.res[r] || 0) + amount);
  emit(world, EV.RESOURCE_CHANGED, { owner, res: r, amount: p.res[r], delta: amount, reason });
}

/** Deduct a cost if affordable. Returns false (and deducts nothing) otherwise. */
export function pay(world, owner, cost, reason = '') {
  if (!canAfford(world, owner, cost)) return false;
  for (const r in cost) {
    if (!cost[r]) continue;
    addRes(world, owner, r, -cost[r], reason);
    if (owner === 'p1') world.stats.consumed[r] += cost[r];
  }
  return true;
}

export function refund(world, owner, cost, fraction = 1, reason = 'refund') {
  for (const r in cost) {
    const amt = Math.floor((cost[r] || 0) * fraction);
    if (amt > 0) {
      addRes(world, owner, r, amt, reason);
      if (owner === 'p1') world.stats.consumed[r] = Math.max(0, world.stats.consumed[r] - amt);
    }
  }
}
