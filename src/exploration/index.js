// Exploration: the valley starts hidden under a dark shroud and is revealed where the
// player's people, soldiers and buildings have been. Stored as a compact bitset in the
// world (saved with it). Presentation only for the player; the enemy AI is unaffected.
import { all } from '../world/world.js';
import { PLAYER } from '../core/contracts.js';

export const EXPLORE_GRID = 64;               // 64 x 64 cells over the map
export const EXPLORE_WORDS = (EXPLORE_GRID * EXPLORE_GRID) / 32;
const SIGHT = { unit: 20, hero: 26, settler: 14, building: 20, keep: 52, tower: 34, barracks: 24 };

export function ensureExplored(world) {
  if (!Array.isArray(world.explored) || world.explored.length !== EXPLORE_WORDS) world.explored = new Array(EXPLORE_WORDS).fill(0);
  return world.explored;
}

function cellSize(half) { return (half * 2) / EXPLORE_GRID; }

/** Mark a circle as explored. Returns true when any new cell was revealed. */
export function reveal(world, half, x, z, r) {
  const bits = ensureExplored(world);
  const cs = cellSize(half);
  const i0 = Math.max(0, Math.floor((x - r + half) / cs)), i1 = Math.min(EXPLORE_GRID - 1, Math.floor((x + r + half) / cs));
  const j0 = Math.max(0, Math.floor((z - r + half) / cs)), j1 = Math.min(EXPLORE_GRID - 1, Math.floor((z + r + half) / cs));
  let changed = false;
  for (let j = j0; j <= j1; j++) {
    const cz = -half + (j + 0.5) * cs;
    for (let i = i0; i <= i1; i++) {
      const cx = -half + (i + 0.5) * cs;
      if ((cx - x) ** 2 + (cz - z) ** 2 > r * r) continue;
      const k = j * EXPLORE_GRID + i;
      const word = k >>> 5, bit = 1 << (k & 31);
      if ((bits[word] & bit) === 0) { bits[word] = (bits[word] | bit) >>> 0; changed = true; }
    }
  }
  return changed;
}

export function isExplored(world, half, x, z) {
  const bits = world.explored;
  if (!bits) return true;
  const cs = cellSize(half);
  const i = Math.floor((x + half) / cs), j = Math.floor((z + half) / cs);
  if (i < 0 || j < 0 || i >= EXPLORE_GRID || j >= EXPLORE_GRID) return true;
  const k = j * EXPLORE_GRID + i;
  return (bits[k >>> 5] & (1 << (k & 31))) !== 0;
}

export function exploredFraction(world) {
  let n = 0;
  for (const w of ensureExplored(world)) { let v = w >>> 0; while (v) { v &= v - 1; n++; } }
  return n / (EXPLORE_GRID * EXPLORE_GRID);
}

export function createExplorationModule() {
  let ctx = null;
  const unsub = [];
  function pass() {
    const world = ctx.world;
    const half = ctx.services.terrain.half;
    ensureExplored(world);
    for (const u of all(world, 'unit')) if (u.owner === PLAYER && !u.downed) reveal(world, half, u.x, u.z, u.hero ? SIGHT.hero : SIGHT.unit);
    for (const s of all(world, 'settler')) if (s.owner === PLAYER) reveal(world, half, s.x, s.z, SIGHT.settler);
    for (const b of all(world, 'building')) if (b.owner === PLAYER && b.state !== 'destroyed') reveal(world, half, b.x, b.z, SIGHT[b.type] || SIGHT.building);
    // once the counter-attack is the objective, the scouts have mapped the ford fort
    const flags = world.mission.flags;
    if (!flags.fortRevealed) {
      const strike = world.mission.objectives.find((o) => o.id === 'strike');
      const camp = ctx.services.terrain.map.enemyCamp;
      if (strike && strike.state !== 'pending' && camp) { reveal(world, half, camp.x, camp.z, 40); flags.fortRevealed = true; }
    }
  }
  return {
    id: 'exploration',
    kind: 'sim',
    init(c) { ctx = c; unsub.push(c.bus.on('world:setup-done', pass)); },
    update({ tick }) { if (tick % 10 === 3 || !ctx.world.explored) pass(); },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
  };
}
