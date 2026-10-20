// Enemy raids march in their faction's formation at the pace of the slowest member, and from a
// difficulty-dependent wave on they roll siege engines out of the fort, which bombard the tower
// guarding the target from beyond its reach.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, place, grant, all } from '../helpers/sim.js';
import { AI_DIFFICULTY, ENGINE_RESERVE, aiSettings, spawnEnemy, warhallOf } from '../../src/ai/index.js';
import { UNITS } from '../../src/units/defs.js';
import { BUILDINGS, attackOf } from '../../src/buildings/defs.js';

const raiders = (sim) => sim.world.ai.raidIds.map((id) => sim.world.entities[id]).filter(Boolean);
const engines = (sim) => raiders(sim).filter((u) => UNITS[u.type].cls === 'siege');

function startRaid(sim, wave) {
  sim.world.mission.raidWarningTick = 1;
  for (let i = 0; i < 5; i++) sim.step();
  sim.world.ai.wave = wave;
  // a garrison big enough for this wave's raid
  const hall = warhallOf(sim.world), cfg = aiSettings(sim.world);
  const types = ['brute', 'reaver', 'slinger'];
  for (let i = 0; i < cfg.firstRaid + wave * cfg.growth; i++) {
    const u = spawnEnemy(sim.world, types[i % 3], hall.x + (i % 5) * 1.5 - 3, hall.z + 10 + Math.floor(i / 5) * 1.5);
    u.order = { type: 'guard', ax: u.x, az: u.z, leash: 28 };
  }
  sim.world.ai.raidTick = sim.world.tick + 1;
  for (let i = 0; i < 4; i++) sim.step();
}

test('engines join raids from the wave each difficulty sets, never on Story', () => {
  assert.equal(AI_DIFFICULTY.story.siegeFrom, null);
  assert.ok(AI_DIFFICULTY.hard.siegeFrom < AI_DIFFICULTY.normal.siegeFrom);
  for (const [difficulty, wave, want] of [['story', 6, 0], ['normal', 2, 0], ['normal', 3, 1], ['hard', 0, 0], ['hard', 1, 1], ['hard', 3, 2]]) {
    const sim = newSim({ difficulty });
    const before = sim.world.ai.spawned || 0;
    startRaid(sim, wave);
    assert.equal(sim.world.ai.state, 'gather', `${difficulty}: the raid gathers`);
    assert.equal(engines(sim).length, want, `${difficulty} wave ${wave + 1}: ${want} engine(s)`);
    if (want) assert.ok((sim.world.ai.spawned || 0) - before >= ENGINE_RESERVE * want, 'engines draw on the reserves');
  }
});

test('the raid forms up and marches together, then charges near the target', () => {
  const sim = newSim({ difficulty: 'hard' });
  startRaid(sim, 1);
  const k = keep(sim);
  // formed up: shields before archers and engines, as seen from the Keep
  for (let i = 0; i < 20 * 21 && sim.world.ai.state === 'gather'; i++) sim.step();
  assert.equal(sim.world.ai.state, 'raid');
  const rs = raiders(sim);
  const pace = Math.min(...rs.map((u) => UNITS[u.type].speed));
  assert.ok(rs.every((u) => u.order.type === 'attackMove' && u.order.pace === pace), 'everyone keeps the slowest pace');
  const front = rs.filter((u) => UNITS[u.type].cls === 'defensive' || UNITS[u.type].cls === 'melee');
  const back = rs.filter((u) => UNITS[u.type].cls === 'ranged' || UNITS[u.type].cls === 'siege');
  const dist = (u) => Math.hypot(u.order.x - k.x, u.order.z - k.z);
  if (front.length && back.length) {
    const avg = (us) => us.reduce((s, u) => s + dist(u), 0) / us.length;
    assert.ok(avg(front.filter((u) => !UNITS[u.type].engine)) < avg(back), 'the front rows lead');
  }
  // the column stays together on the road
  let spread = 0;
  const target = sim.world.entities[sim.world.ai.raidTarget];
  for (let i = 0; i < 20 * 30 && !sim.world.ai.charged; i++) {
    sim.step();
    const troops = raiders(sim).filter((u) => !u.target && UNITS[u.type].cls !== 'siege');
    if (troops.length < 2) continue;
    let cx = 0, cz = 0;
    for (const u of troops) { cx += u.x; cz += u.z; }
    cx /= troops.length; cz /= troops.length;
    spread = Math.max(spread, ...troops.map((u) => Math.hypot(u.x - cx, u.z - cz)));
  }
  assert.ok(spread < 14, `the column holds together (spread ${spread.toFixed(1)} m)`);
  for (let i = 0; i < 20 * 120 && !sim.world.ai.charged && sim.world.ai.state === 'raid'; i++) sim.step();
  assert.ok(sim.world.ai.charged, `the raid charges near the ${target.type}`);
  assert.ok(raiders(sim).filter((u) => UNITS[u.type].cls !== 'siege').every((u) => !u.order.pace), 'no pace limit in the charge');
});

test('an engine bombards the tower guarding the target from beyond its reach', () => {
  const sim = newSim({ difficulty: 'hard' });
  sim.issue({ type: 'rekindle' });
  sim.world.players.p1.techs.charter = true;
  grant(sim, { timber: 999, stone: 999, iron: 99 });
  const k = keep(sim), hall = warhallOf(sim.world);
  // a watchtower on the side of the Keep that faces the fort
  const dx = hall.x - k.x, dz = hall.z - k.z, len = Math.hypot(dx, dz);
  const tower = place(sim, 'tower', k.x + (dx / len) * 14, k.z + (dz / len) * 14);
  tower.state = 'active'; tower.hp = tower.maxHp;
  startRaid(sim, 1);
  for (let i = 0; i < 20 * 21 && sim.world.ai.state === 'gather'; i++) sim.step();
  const [engine] = engines(sim);
  assert.ok(engine, 'an engine marches with the raid');
  assert.equal(sim.world.ai.siegeTarget, tower.id, 'it aims at the tower');
  const hp0 = tower.hp, range = attackOf(tower).range;
  let closest = Infinity, shots = 0;
  sim.bus.on('combat:shot', (e) => { if (e.from === engine.id) shots++; });
  for (let i = 0; i < 20 * 200 && tower.state !== 'destroyed' && engine.hp > 0; i++) {
    sim.step();
    if (engine.target === tower.id) closest = Math.min(closest, Math.hypot(engine.x - tower.x, engine.z - tower.z));
  }
  assert.ok(shots > 0 && tower.hp < hp0, `the tower took boulders (${shots} shots)`);
  assert.ok(closest > range + BUILDINGS.tower.radius, `it shot from beyond the tower's ${range} m (closest ${closest.toFixed(1)} m)`);
});

test('chapter modifiers move the first siege raid', () => {
  const sim = newSim({ difficulty: 'normal' });
  sim.world.ai.mods = { siegeFrom: -2 };
  assert.equal(aiSettings(sim.world).siegeFrom, AI_DIFFICULTY.normal.siegeFrom - 2);
  sim.world.meta.difficulty = 'story';
  assert.equal(aiSettings(sim.world).siegeFrom, null, 'Story stays without engines');
  assert.ok(all(sim.world, 'unit').length > 0);
});
