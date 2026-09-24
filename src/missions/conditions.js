// Declarative condition evaluation for scenario objectives and triggers.
import { all } from '../world/world.js';
import { PLAYER } from '../core/contracts.js';

export function countBuilt(world, owner, type) {
  let n = 0;
  for (const b of all(world, 'building')) if (b.owner === owner && b.type === type && b.state === 'active') n++;
  return n;
}

export function soldierCount(world, owner) {
  let n = 0;
  for (const u of all(world, 'unit')) if (u.owner === owner && !u.hero) n++;
  return n;
}

/** Evaluate a condition object. Unknown keys evaluate to false (fail-safe). */
export function evaluate(world, cond, owner = PLAYER) {
  if (!cond || typeof cond !== 'object') return false;
  if (cond.all) return cond.all.every((c) => evaluate(world, c, owner));
  if (cond.any) return cond.any.some((c) => evaluate(world, c, owner));
  if (cond.always) return true;
  if ('keepLit' in cond) return !!world.mission.flags.keepLit === cond.keepLit;
  if (cond.completed) { const o = world.mission.objectives.find((x) => x.id === cond.completed); return !!o && o.state === 'done'; }
  if (cond.flag) return !!world.mission.flags[cond.flag];
  if (cond.built) return countBuilt(world, owner, cond.built) >= (cond.count || 1);
  if (cond.pop !== undefined) return world.players[owner].pop >= cond.pop;
  if (cond.stock) return (world.players[owner].res[cond.stock] || 0) >= cond.amount;
  if (cond.produced) return (world.stats.produced[cond.produced] || 0) >= cond.amount;
  if (cond.soldiers !== undefined) return soldierCount(world, owner) >= cond.soldiers;
  if (cond.tech) return !!world.players[owner].techs[cond.tech];
  if (cond.raidsRepelled !== undefined) return (world.ai.wave || 0) >= cond.raidsRepelled;
  if (cond.destroyed) return !all(world, 'building').some((b) => b.type === cond.destroyed && b.state !== 'destroyed');
  if (cond.tickAtLeast !== undefined) return world.tick >= cond.tickAtLeast;
  return false;
}
