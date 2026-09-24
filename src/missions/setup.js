// Deterministic scenario setup: players, Keep, hero, settlers, deposits, enemy camp.
import { PLAYER, ENEMY } from '../core/contracts.js';
import { addPlayer, spawn, worldRng, all } from '../world/world.js';
import { createBuildingEntity } from '../construction/index.js';
import { spawnSettler } from '../population/index.js';
import { spawnUnit } from '../units/sim.js';
import { spawnEnemy, aiSettings } from '../ai/index.js';
import { distToPolyline } from '../world/terrain-data.js';
import { HARROWMERE_SCENARIO } from './scenarios/harrowmere.js';

const DIFF_RES = { story: 1.5, normal: 1, hard: 0.8 };

export function setupScenario(world, terrain, scenario = HARROWMERE_SCENARIO) {
  const map = terrain.map;
  const rng = worldRng(world);
  const mult = Object.hasOwn(DIFF_RES, world.meta.difficulty) ? DIFF_RES[world.meta.difficulty] : 1;
  const res = {};
  for (const r in scenario.startResources) res[r] = Math.round(scenario.startResources[r] * mult);
  addPlayer(world, { id: PLAYER, name: 'Hearthbound', faction: 'hearthbound', color: '#2f6f8f', res, stability: 55 });
  addPlayer(world, { id: ENEMY, name: 'Rustfang Reavers', faction: 'rustfang', color: '#8c3b2a', res: {}, stability: 100, ai: true });
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
  createBuildingEntity(world, { type: 'warhall', owner: ENEMY, x: ec.x, z: ec.z, rot: hallRot, state: 'active' });
  createBuildingEntity(world, { type: 'reavertower', owner: ENEMY, x: ec.x - 16, z: ec.z + 14, rot: hallRot, state: 'active' });
  createBuildingEntity(world, { type: 'reavertower', owner: ENEMY, x: ec.x + 14, z: ec.z + 18, rot: hallRot, state: 'active' });

  // Deposits — iron veins and rock outcrops first (hand-placed), then forests
  const placed = [];
  const clearOf = (x, z, r) => placed.every((p) => (p.x - x) ** 2 + (p.z - z) ** 2 >= r * r);
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
        spawn(world, { kind: 'deposit', type: 'rock', x, z, amount: 60, maxAmount: 60, variant: rng.int(0, 2), rot: rng.range(0, Math.PI * 2), reservedBy: null });
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

  // Settlers and hero at the Keep
  const door = { x: keep.x + Math.sin(keep.rot) * 9, z: keep.z + Math.cos(keep.rot) * 9 };
  for (let i = 0; i < 5; i++) spawnSettler(world, PLAYER, door.x + (i - 2) * 1.4, door.z + 1.5 + (i % 2));
  const maren = spawnUnit(world, 'maren', PLAYER, door.x + 2, door.z - 1.5);
  maren.order = { type: 'idle', ax: maren.x, az: maren.z };
  world.selection.ids = [maren.id];

  // Enemy garrison
  const hallDoor = { x: ec.x + Math.sin(hallRot) * 9, z: ec.z + Math.cos(hallRot) * 9 };
  const garrison = ['reaver', 'reaver', 'slinger', 'brute', 'reaver', 'slinger'];
  garrison.forEach((type, i) => {
    const u = spawnEnemy(world, type, hallDoor.x + (i % 3) * 2 - 2, hallDoor.z + Math.floor(i / 3) * 2);
    if (u) {
      const ang = (u.id * 2.399) % (Math.PI * 2), rr = 11 + (u.id % 3) * 2.5;
      u.order = { type: 'guard', ax: ec.x + Math.sin(ang) * rr, az: ec.z + Math.cos(ang) * rr, leash: 28 };
    }
  });
  const vharek = spawnEnemy(world, 'vharek', hallDoor.x, hallDoor.z + 1);
  if (vharek) vharek.order = { type: 'guard', ax: hallDoor.x, az: hallDoor.z + 1, leash: 30 };

  const cfg = aiSettings(world);
  world.ai.nextSpawnTick = cfg.spawnInterval * 20;
  world.ai.nextScoutTick = 240 * 20;
  world.mission.raidWarningTick = (scenario.raidWarningAt[world.meta.difficulty] || scenario.raidWarningAt.normal) * 20;
  return { keep, maren, deposits: all(world, 'deposit').length };
}
