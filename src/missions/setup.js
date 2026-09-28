// Deterministic scenario setup: players, Keep, hero, settlers, deposits, enemy camp.
import { PLAYER, ENEMY } from '../core/contracts.js';
import { addPlayer, spawn, worldRng, all } from '../world/world.js';
import { createBuildingEntity, completeBuilding } from '../construction/index.js';
import { UPGRADES } from '../buildings/defs.js';
import { findSpot } from '../demo/bot.js';
import { spawnSettler } from '../population/index.js';
import { spawnUnit } from '../units/sim.js';
import { spawnEnemy, aiSettings } from '../ai/index.js';
import { distToPolyline } from '../world/terrain-data.js';
import { HARROWMERE_SCENARIO } from './scenarios/harrowmere.js';
import { enemyFaction } from '../ai/factions.js';

const DIFF_RES = { story: 1.5, normal: 1, hard: 0.8 };

/** Raise a building to a level at setup (its upgrades already built). */
function setLevel(b, level) {
  for (let l = 2; l <= level; l++) {
    const up = UPGRADES[b.type] && UPGRADES[b.type][l];
    if (!up) break;
    if (up.hp) { b.maxHp += up.hp; b.hp = b.maxHp; }
    b.level = l;
  }
}

export function setupScenario(world, terrain, scenario = HARROWMERE_SCENARIO) {
  const map = terrain.map;
  const rng = worldRng(world);
  const mult = Object.hasOwn(DIFF_RES, world.meta.difficulty) ? DIFF_RES[world.meta.difficulty] : 1;
  const res = {};
  for (const r in scenario.startResources) res[r] = Math.round(scenario.startResources[r] * mult);
  addPlayer(world, { id: PLAYER, name: 'Hearthbound', faction: 'hearthbound', color: '#2f6f8f', res, stability: 55 });
  // the enemy faction of this chapter (Rustfang by default)
  if (scenario.enemy && scenario.enemy.faction) world.ai.faction = scenario.enemy.faction;
  const fac = enemyFaction(world);
  addPlayer(world, { id: ENEMY, name: fac.name, faction: fac.id, color: fac.color, res: {}, stability: 100, ai: true });
  world.mapEntry = { ...map.settlerEntry };
  world.enemyEntry = { ...map.reinforcementEntry };
  world.mission.scenarioId = scenario.id;
  world.mission.objectives = scenario.objectives.map((o) => ({ id: o.id, state: 'pending' }));

  // Keep (door faces the valley towards the ford)
  const ks = map.playerStart;
  const keep = createBuildingEntity(world, { type: 'keep', owner: PLAYER, x: ks.x, z: ks.z, rot: 2.3, state: 'active' });

  // Enemy camp
  const ec = map.enemyCamp;
  const hallRot = Math.atan2(ks.x - ec.x, ks.z - ec.z);
  createBuildingEntity(world, { type: fac.hall, owner: ENEMY, x: ec.x, z: ec.z, rot: hallRot, state: 'active' });
  createBuildingEntity(world, { type: fac.tower, owner: ENEMY, x: ec.x - 16, z: ec.z + 14, rot: hallRot, state: 'active' });
  createBuildingEntity(world, { type: fac.tower, owner: ENEMY, x: ec.x + 14, z: ec.z + 18, rot: hallRot, state: 'active' });

  // Deposits — iron veins and rock outcrops first (hand-placed), then forests
  const placed = [];
  const clearOf = (x, z, r) => placed.every((p) => (p.x - x) ** 2 + (p.z - z) ** 2 >= r * r);
  for (const p of map.saltPans || []) {
    spawn(world, { kind: 'deposit', type: 'salt', x: p.x, z: p.z, amount: 999, maxAmount: 999, variant: 0, rot: rng.range(0, Math.PI * 2), reservedBy: null });
    placed.push({ x: p.x, z: p.z });
  }
  for (const v of map.ironVeins) {
    spawn(world, { kind: 'deposit', type: 'iron', x: v.x, z: v.z, amount: 400, maxAmount: 400, variant: 0, rot: 0.6, reservedBy: null });
    placed.push({ x: v.x, z: v.z });
  }
  for (const cl of map.rocks) {
    for (let i = 0; i < cl.count; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const a = rng.range(0, Math.PI * 2), r = rng.range(0, cl.spread);
        const x = cl.x + Math.cos(a) * r, z = cl.z + Math.sin(a) * r;
        if (!clearOf(x, z, 5) || terrain.waterDepth(x, z) > 0) continue;
        spawn(world, { kind: 'deposit', type: 'rock', x, z, amount: 150, maxAmount: 150, variant: rng.int(0, 2), rot: rng.range(0, Math.PI * 2), reservedBy: null });
        placed.push({ x, z });
        break;
      }
    }
  }
  const keepClear = 13;
  const camp = map.enemyCamp;
  for (const f of map.forests) {
    let made = 0;
    for (let tries = 0; tries < f.count * 12 && made < f.count; tries++) {
      const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * f.r;
      const x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
      if (!terrain.inBounds(x, z, 8)) continue;
      if (terrain.height(x, z) < 0.7) continue;
      if (terrain.slope(x, z) > 0.7) continue;
      if (Math.hypot(x - ks.x, z - ks.z) < keepClear || Math.hypot(x - camp.x, z - camp.z) < 30) continue;
      if (map.roads.some((rd) => distToPolyline(x, z, rd.points) < rd.width + 1.2)) continue;
      if (!clearOf(x, z, 2.4)) continue;
      spawn(world, { kind: 'deposit', type: 'tree', x, z, amount: 8, maxAmount: 8, variant: rng.next() < 0.62 ? 0 : 1, scale: rng.range(0.85, 1.25), rot: rng.range(0, Math.PI * 2), reservedBy: null });
      placed.push({ x, z });
      made++;
    }
  }

  // Later chapters begin in an established town (keep level, buildings, techs, soldiers)
  const st = scenario.setup || {};
  if (st.keepLevel > 1) setLevel(keep, st.keepLevel);
  if (st.keepLit) { keep.lit = true; world.mission.flags.keepLit = true; }
  for (const t of st.techs || []) world.players[PLAYER].techs[t] = true;
  for (const [type, x, z, level] of st.buildings || []) {
    const spot = findSpot(world, { terrain, nav: null }, type, x, z, 30);
    if (!spot) continue;
    const rot = Math.atan2(ks.x - spot.x, ks.z - spot.z);
    const b = createBuildingEntity(world, { type, owner: PLAYER, x: spot.x, z: spot.z, rot, state: 'site' });
    completeBuilding(world, b);
    if (level > 1) setLevel(b, level);
  }
  world.stats.buildingsBuilt = 0;
  for (const [dx, dz] of (scenario.enemy && scenario.enemy.extraTowers) || []) {
    createBuildingEntity(world, { type: fac.tower, owner: ENEMY, x: ec.x + dx, z: ec.z + dz, rot: hallRot, state: 'active' });
  }
  if (scenario.ai) world.ai.mods = { ...scenario.ai };
  if (scenario.enemy && scenario.enemy.hallBarred) world.mission.flags.hallBarred = true;

  // Settlers and hero at the Keep
  const door = { x: keep.x + Math.sin(keep.rot) * 9, z: keep.z + Math.cos(keep.rot) * 9 };
  const settlers = st.settlers || 5;
  for (let i = 0; i < settlers; i++) spawnSettler(world, PLAYER, door.x + ((i % 5) - 2) * 1.4, door.z + 1.5 + (i < 5 ? i % 2 : Math.floor(i / 5) * 1.3));
  (st.soldiers || []).forEach((type, i) => {
    const u = spawnUnit(world, type, PLAYER, door.x - 4 + (i % 4) * 1.6, door.z + 5 + Math.floor(i / 4) * 1.6);
    if (u) u.order = { type: 'idle', ax: u.x, az: u.z };
  });
  const maren = spawnUnit(world, 'maren', PLAYER, door.x + 2, door.z - 1.5);
  maren.order = { type: 'idle', ax: maren.x, az: maren.z };
  world.selection.ids = [maren.id];

  // Enemy garrison
  const hallDoor = { x: ec.x + Math.sin(hallRot) * 9, z: ec.z + Math.cos(hallRot) * 9 };
  const garrison = fac.garrison;
  garrison.forEach((type, i) => {
    const u = spawnEnemy(world, type, hallDoor.x + (i % 3) * 2 - 2, hallDoor.z + Math.floor(i / 3) * 2);
    if (u) {
      const ang = (u.id * 2.399) % (Math.PI * 2), rr = 11 + (u.id % 3) * 2.5;
      u.order = { type: 'guard', ax: ec.x + Math.sin(ang) * rr, az: ec.z + Math.cos(ang) * rr, leash: 28 };
    }
  });
  // later chapters: a stronger standing garrison around the hall
  ((scenario.enemy && scenario.enemy.garrison) || []).forEach((type, i) => {
    const u = spawnEnemy(world, type, hallDoor.x + (i % 5) * 1.8 - 3.6, hallDoor.z + 3 + Math.floor(i / 5) * 1.8);
    if (u) {
      const ang = (u.id * 2.399) % (Math.PI * 2), rr = 9 + (u.id % 4) * 2.5;
      u.order = { type: 'guard', ax: ec.x + Math.sin(ang) * rr, az: ec.z + Math.cos(ang) * rr, leash: 26 };
      u.sentinel = true; // the standing garrison holds the fort and never joins the raids
    }
  });
  // (in the last chapter Vharek leads his host in person and arrives later)
  const vharek = scenario.enemy && scenario.enemy.commanderLate ? null : spawnEnemy(world, fac.commander, hallDoor.x, hallDoor.z + 1);
  if (vharek) vharek.order = { type: 'guard', ax: hallDoor.x, az: hallDoor.z + 1, leash: 30 };

  const cfg = aiSettings(world);
  world.ai.nextSpawnTick = cfg.spawnInterval * 20;
  world.ai.nextScoutTick = 240 * 20;
  world.mission.raidWarningTick = (scenario.raidWarningAt[world.meta.difficulty] || scenario.raidWarningAt.normal) * 20;
  return { keep, maren, deposits: all(world, 'deposit').length };
}
