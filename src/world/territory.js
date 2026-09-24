// Territory: circles around active territory buildings. Derived, cheap to recompute.
import { all } from './world.js';
import { BUILDINGS } from '../buildings/defs.js';
import { TECH_EFFECTS } from '../technology/defs.js';

export function territorySources(world) {
  const out = [];
  for (const b of all(world, 'building')) {
    const d = BUILDINGS[b.type];
    if (!d.territory || b.state !== 'active') continue;
    let r = d.territory;
    if (b.type === 'keep' && world.players[b.owner] && world.players[b.owner].techs.charter) r += TECH_EFFECTS.charterTerritory;
    out.push({ owner: b.owner, x: b.x, z: b.z, r, id: b.id });
  }
  return out;
}

/** Owner of the territory at (x,z), or null. Player territory wins ties with none only. */
export function territoryOwner(world, x, z, sources = territorySources(world)) {
  let best = null, bestD = Infinity;
  for (const s of sources) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d <= s.r && d / s.r < bestD) { bestD = d / s.r; best = s.owner; }
  }
  return best;
}
