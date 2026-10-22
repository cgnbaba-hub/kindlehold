// Founding the rival town (free play): its Keep, two cottages, its first families, a squad, and
// enough wood, stone and iron in reach to grow (the maps were laid out for one town only).
import { RIVAL } from '../core/contracts.js';
import { addPlayer, spawn, all } from '../world/world.js';
import { createBuildingEntity, completeBuilding } from '../construction/index.js';
import { BUILDINGS } from '../buildings/defs.js';
import { findSpot } from '../demo/bot.js';
import { spawnSettler } from '../population/index.js';
import { spawnUnit } from '../units/sim.js';
import { distToPolyline } from '../world/terrain-data.js';
import { SKIRMISH_PEACE, sanitizeSkirmish } from '../missions/skirmish.js';
import { RIVAL_COLOR, RIVAL_TOWNS, rivalSettings, rivalRecruit } from './defs.js';

// what the rival's home flat must hold: trees within 38 m, rocks within 46 m, and an iron vein inside
// the Keep's own territory (34 m: a Mine stands right beside its vein)
const KIT = { trees: [38, 36, 46], rocks: [46, 5, 7], iron: 28 };

function seedHash(seed) { return [...String(seed)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 5); }

export function setupRivalTown(world, terrain, scenario, at, { rng, clearOf, placed }) {
  const cfg = rivalSettings(world);
  const res = {};
  for (const r in scenario.startResources) res[r] = Math.round(scenario.startResources[r] * cfg.goods);
  const name = seedHash(world.meta.seed) % RIVAL_TOWNS.length;
  const t = RIVAL_TOWNS[name];
  addPlayer(world, { id: RIVAL, name: t.town, faction: 'rival', color: RIVAL_COLOR, res, stability: 55 });
  const sk = sanitizeSkirmish(world.meta.skirmish);
  world.rival = { name, phase: 'economy', lastAct: -999, waves: 0, firstAttackTick: Math.round(cfg.firstAttack * SKIRMISH_PEACE[sk.peace].mult * 20) };
  // newcomers walk in along the road on the rival's side of the map
  const entry = terrain.map.reinforcementEntry || { x: at.x, z: at.z };
  world.townEntries = { ...(world.townEntries || {}), [RIVAL]: { x: entry.x, z: entry.z } };

  const keep = createBuildingEntity(world, { type: 'keep', owner: RIVAL, x: at.x, z: at.z, rot: at.rot, state: 'active' });
  keep.lit = true;
  for (const [type, dx, dz] of (scenario.setup && scenario.setup.homeBuildings) || []) {
    // the player's two cottages, mirrored to face the other way
    const spot = findSpot(world, { terrain, nav: null }, type, at.x - dx, at.z - dz, 30, RIVAL);
    if (!spot) continue;
    const b = createBuildingEntity(world, { type, owner: RIVAL, x: spot.x, z: spot.z, rot: Math.atan2(at.x - spot.x, at.z - spot.z), state: 'site' });
    completeBuilding(world, b);
  }

  const ok = (x, z, r) => terrain.inBounds(x, z, 8) && terrain.height(x, z) >= 0.7 && terrain.slope(x, z) <= 0.7 && Math.hypot(x - at.x, z - at.z) >= 13
    && !terrain.map.roads.some((rd) => distToPolyline(x, z, rd.points) < rd.width + 1.2) && clearOf(x, z, r)
    && all(world, 'building').every((b) => Math.hypot(x - b.x, z - b.z) > (BUILDINGS[b.type].radius || 3) + r);
  const near = (type, d) => all(world, 'deposit').filter((p) => p.type === type && p.amount > 0 && Math.hypot(p.x - at.x, p.z - at.z) < d).length;
  // trees: a wood within reach of a Woodcutter's Lodge
  if (near('tree', KIT.trees[0]) < KIT.trees[1]) {
    const a0 = rng.range(0, Math.PI * 2);
    for (let i = 0, made = 0; i < 600 && made < KIT.trees[2]; i++) {
      const a = a0 + rng.range(-0.9, 0.9), r = rng.range(16, KIT.trees[0]);
      const x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
      if (!ok(x, z, 2.4)) continue;
      spawn(world, { kind: 'deposit', type: 'tree', x, z, amount: 8, maxAmount: 8, variant: rng.next() < 0.62 ? 0 : 1, scale: rng.range(0.85, 1.25), rot: rng.range(0, Math.PI * 2), reservedBy: null });
      placed.push({ x, z }); made++;
    }
  }
  // rocks: an outcrop for a Quarry
  if (near('rock', KIT.rocks[0]) < KIT.rocks[1]) {
    for (let tries = 0; tries < 40; tries++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(24, 34);
      const cx = at.x + Math.cos(a) * r, cz = at.z + Math.sin(a) * r;
      if (!ok(cx, cz, 5)) continue;
      for (let i = 0, made = 0; i < 80 && made < KIT.rocks[2]; i++) {
        const x = cx + rng.range(-6, 6), z = cz + rng.range(-6, 6);
        if (!ok(x, z, 3) || terrain.waterDepth(x, z) > 0) continue;
        spawn(world, { kind: 'deposit', type: 'rock', x, z, amount: 150, maxAmount: 150, variant: rng.int(0, 2), rot: rng.range(0, Math.PI * 2), reservedBy: null });
        placed.push({ x, z }); made++;
      }
      break;
    }
  }
  // iron: one vein on flat ground for a Mine
  if (!near('iron', KIT.iron)) {
    for (let tries = 0; tries < 160; tries++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(18, KIT.iron);
      const x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
      // (flat ground first; after many tries any dry spot will do)
      if (!ok(x, z, tries < 120 ? 6 : 4) || (tries < 120 && terrain.slope(x, z) > 0.5)) continue;
      spawn(world, { kind: 'deposit', type: 'iron', x, z, amount: 400, maxAmount: 400, variant: 0, rot: 0.6, reservedBy: null });
      placed.push({ x, z });
      break;
    }
  }

  // the first families and a squad, in front of the door
  const door = { x: keep.x + Math.sin(keep.rot) * 9, z: keep.z + Math.cos(keep.rot) * 9 };
  const freeAt = (x, z) => !terrain.isWater(x, z) && all(world, 'building').every((b) => Math.hypot(x - b.x, z - b.z) > (BUILDINGS[b.type].radius || 3) + 0.6);
  const front = (across, out) => {
    const px = door.x + Math.cos(keep.rot) * across + Math.sin(keep.rot) * out, pz = door.z - Math.sin(keep.rot) * across + Math.cos(keep.rot) * out;
    for (let r = 0; r <= 24; r += 1.2) {
      for (let k = 0, n = Math.max(1, Math.round(r * 4)); k < n; k++) {
        const a = (k / n) * Math.PI * 2, x = px + Math.sin(a) * r, z = pz + Math.cos(a) * r;
        if (freeAt(x, z)) return { x, z };
      }
    }
    return { x: px, z: pz };
  };
  const st = scenario.setup || {};
  for (let i = 0; i < (st.settlers || 5); i++) { const p = front(((i % 5) - 2) * 1.4, 1.5 + (i < 5 ? i % 2 : Math.floor(i / 5) * 1.3)); spawnSettler(world, RIVAL, p.x, p.z); }
  for (let i = 0; i < 2; i++) { const p = front(-3.5 - i * 1.4, 0.5); spawnSettler(world, RIVAL, p.x, p.z, { hand: true }); }
  (st.soldiers || []).forEach((type, i) => {
    const p = front(-4 + (i % 4) * 1.6, 5 + Math.floor(i / 4) * 1.6);
    const u = rivalRecruit(world, spawnUnit(world, Array.isArray(type) ? type[0] : type, RIVAL, p.x, p.z));
    if (u) u.order = { type: 'idle', ax: u.x, az: u.z };
  });
  // the rival's own Warden, beside the Keep (Maren's match)
  if (cfg.hero) {
    const hp = front(2, -1.5);
    const w = spawnUnit(world, 'warden', RIVAL, hp.x, hp.z);
    if (w) w.order = { type: 'idle', ax: w.x, az: w.z };
  }
  // Watchtowers on the side facing the player (the raiders' seat has its towers as well)
  const towardX = Math.sin(at.rot), towardZ = Math.cos(at.rot);
  const pl = world.players[RIVAL];
  const had = !!pl.techs.charter;
  pl.techs.charter = true; // (towers need the Charter: only for the search)
  for (let i = 0; i < cfg.towers; i++) {
    const side = i % 2 ? -1 : 1;
    const wx = at.x + towardX * 15 + towardZ * 11 * side, wz = at.z + towardZ * 15 - towardX * 11 * side;
    const spot = findSpot(world, { terrain, nav: null }, 'tower', Math.round(wx), Math.round(wz), 14, RIVAL);
    if (spot) createBuildingEntity(world, { type: 'tower', owner: RIVAL, x: spot.x, z: spot.z, rot: at.rot, state: 'active' });
  }
  if (!had) delete pl.techs.charter;
  return keep;
}
