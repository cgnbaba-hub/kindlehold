import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, byType, place, runUntil, grant, units, settlers, all } from '../helpers/sim.js';
import { computeDamage } from '../../src/combat/index.js';
import { spawnUnit } from '../../src/units/sim.js';
import { spawnEnemy } from '../../src/ai/index.js';
import { remove } from '../../src/world/world.js';
import { UNITS } from '../../src/units/defs.js';
import { ABILITIES } from '../../src/heroes/index.js';
import { researchBlocker } from '../../src/technology/index.js';

test('damage formula applies counters and percentage armour', () => {
  assert.equal(computeDamage({ base: 16, attackerCls: 'melee', defenderCls: 'ranged', armor: 0 }), 28);
  assert.equal(computeDamage({ base: 16, attackerCls: 'melee', defenderCls: 'defensive', armor: 5 }), 12);
  assert.equal(computeDamage({ base: 10, attackerCls: 'defensive', defenderCls: 'melee', armor: 2 }), 16);
  assert.equal(computeDamage({ base: 12, attackerCls: 'ranged', defenderCls: 'defensive', armor: 4 }), 19);
  assert.equal(computeDamage({ base: 1, attackerCls: 'melee', defenderCls: 'melee', armor: 20 }), 1, 'minimum 1');
  assert.equal(computeDamage({ base: 100, attackerCls: 'melee', defenderCls: 'melee', armor: 100 }), 25, 'armour caps at 75%');
});

function arena() {
  const sim = newSim();
  // clear everything but the keep, to isolate the fight
  for (const u of units(sim, 'p2').slice()) remove(sim.world, u.id);
  sim.world.ai.nextSpawnTick = 1e9; sim.world.ai.nextScoutTick = 1e9;
  sim.world.mission.raidWarningTick = 1e9;
  return sim;
}

test('melee combat: units acquire, close in, trade blows until one dies', () => {
  const sim = arena();
  const a = spawnUnit(sim.world, 'blade', 'p1', -20, 30);
  const e = spawnEnemy(sim.world, 'slinger', -12, 30);
  sim.issue({ type: 'attack', ids: [a.id], target: e.id });
  const t = runUntil(sim, () => !sim.world.entities[e.id], 20 * 30);
  assert.ok(t > 0, 'slinger killed');
  assert.ok(a.hp > 0 && a.hp <= UNITS.blade.hp);
  assert.equal(sim.world.stats.enemiesDefeated, 1);
});

test('ranged units fire projectiles that land after a flight time', () => {
  const sim = arena();
  const f = spawnUnit(sim.world, 'fletcher', 'p1', -20, 30);
  const e = spawnEnemy(sim.world, 'brute', -8, 30);
  e.order = { type: 'hold', ax: e.x, az: e.z };
  let shots = 0, hits = 0;
  sim.bus.on('combat:shot', () => shots++);
  sim.bus.on('combat:hit', (h) => { if (h.target === e.id) hits++; });
  sim.issue({ type: 'attack', ids: [f.id], target: e.id });
  for (let i = 0; i < 20 * 6; i++) sim.step();
  assert.ok(shots >= 2);
  assert.ok(hits >= 1 && hits <= shots);
  assert.ok(e.hp < e.maxHp);
});

test('counter triangle decides equal-cost duels', () => {
  function duel(pType, eType) {
    const sim = arena();
    const p = spawnUnit(sim.world, pType, 'p1', -20, 30);
    const e = spawnEnemy(sim.world, eType, -17, 30);
    sim.issue({ type: 'attack', ids: [p.id], target: e.id });
    runUntil(sim, () => !sim.world.entities[p.id] || !sim.world.entities[e.id], 20 * 60);
    return !!sim.world.entities[p.id];
  }
  assert.equal(duel('shield', 'reaver'), true, 'shieldbearer beats reaver (melee)');
  assert.equal(duel('blade', 'slinger'), true, 'bladesman beats slinger (ranged)');
});

test('move orders use formation slots and units arrive', () => {
  const sim = arena();
  const ids = [];
  for (let i = 0; i < 6; i++) ids.push(spawnUnit(sim.world, i < 3 ? 'shield' : 'fletcher', 'p1', -40 + i, 30).id);
  sim.issue({ type: 'move', ids, x: -20, z: 20 });
  sim.step();
  runUntil(sim, () => ids.every((id) => sim.world.entities[id].order.type === 'idle'), 20 * 30);
  const us = ids.map((id) => sim.world.entities[id]);
  for (const u of us) assert.ok(Math.hypot(u.x + 20, u.z - 20) < 8, 'near the destination');
  for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) assert.ok(Math.hypot(us[i].x - us[j].x, us[i].z - us[j].z) > 0.8, 'no stacking');
});

test('stop, hold and patrol orders', () => {
  const sim = arena();
  const u = spawnUnit(sim.world, 'blade', 'p1', -30, 30);
  sim.issue({ type: 'patrol', ids: [u.id], x: -20, z: 30 });
  let turned = false;
  for (let i = 0; i < 20 * 15; i++) { sim.step(); if (u.order.leg === 0) turned = true; }
  assert.ok(turned, 'patrol turned around');
  sim.issue({ type: 'stop', ids: [u.id] });
  sim.step();
  assert.equal(u.order.type, 'idle');
  sim.issue({ type: 'hold', ids: [u.id] });
  sim.step();
  const e = spawnEnemy(sim.world, 'slinger', u.x + 9, u.z);
  e.order = { type: 'hold', ax: e.x, az: e.z };
  const x0 = u.x;
  for (let i = 0; i < 40; i++) sim.step();
  assert.ok(Math.abs(u.x - x0) < 0.9, 'hold position does not chase');
});

test('recruitment turns an idle settler into a soldier and costs resources', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, { timber: 300, stone: 300, iron: 60, provisions: 80 });
  const bar = place(sim, 'barracks', -34, 38);
  runUntil(sim, () => bar.state === 'active', 20 * 200);
  assert.equal(bar.state, 'active');
  const iron = sim.world.players.p1.res.iron;
  const settlersBefore = settlers(sim).length;
  sim.issue({ type: 'recruit', building: bar.id, unitType: 'shield' });
  sim.step();
  assert.equal(sim.world.players.p1.res.iron, iron - UNITS.shield.cost.iron);
  const t = runUntil(sim, () => units(sim).some((u) => u.type === 'shield'), 20 * 60);
  assert.ok(t > 0, 'soldier trained');
  assert.ok(settlers(sim).length <= settlersBefore, 'a settler was consumed');
  assert.equal(sim.world.stats.unitsRecruited, 1);
});

test('technology prerequisites and completion effects', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  sim.step();
  grant(sim, { timber: 500, stone: 500, iron: 200 });
  assert.match(researchBlocker(sim.world, 'p1', 'charter'), /Braced Timber/);
  assert.match(researchBlocker(sim.world, 'p1', 'blades'), /Barracks/);
  sim.issue({ type: 'research', techId: 'bracing' });
  sim.step();
  assert.equal(sim.world.players.p1.research.techId, 'bracing');
  assert.match(researchBlocker(sim.world, 'p1', 'axes'), /in progress/);
  runUntil(sim, () => sim.world.players.p1.techs.bracing, 20 * 50);
  assert.ok(sim.world.players.p1.techs.bracing);
  assert.equal(researchBlocker(sim.world, 'p1', 'charter'), null);
  const cap = sim.world.players.p1.popCap;
  sim.issue({ type: 'research', techId: 'charter' });
  runUntil(sim, () => sim.world.players.p1.techs.charter, 20 * 70);
  for (let i = 0; i < 5; i++) sim.step();
  assert.equal(sim.world.players.p1.popCap, cap + 6, 'charter adds housing');
});

test('hero abilities: range, effect and cooldown', () => {
  const sim = arena();
  const hero = units(sim).find((u) => u.hero);
  hero.x = hero.px = -20; hero.z = hero.pz = 30;
  const enemies = [0, 1, 2].map((i) => spawnEnemy(sim.world, 'reaver', -10 + i, 30));
  enemies.forEach((e) => { e.order = { type: 'hold', ax: e.x, az: e.z }; });
  const hp0 = enemies[0].hp;
  sim.issue({ type: 'ability', heroId: hero.id, ability: 'flare', x: -9, z: 30 });
  sim.step();
  assert.ok(enemies.every((e) => e.hp <= hp0 - (ABILITIES.flare.damage - 1)), 'all enemies in radius damaged');
  assert.ok(enemies[0].dazzleUntil > sim.world.tick);
  let rejected = null;
  sim.bus.on('command:rejected', (r) => { rejected = r.reason; });
  sim.issue({ type: 'ability', heroId: hero.id, ability: 'flare', x: -9, z: 30 });
  sim.step();
  assert.match(rejected, /not ready/);
  // cooldown elapses
  for (let i = 0; i < ABILITIES.flare.cooldown * 20; i++) sim.step();
  rejected = null;
  const k = spawnUnit(sim.world, 'shield', 'p1', hero.x + 2, hero.z);
  sim.issue({ type: 'ability', heroId: hero.id, ability: 'kindle' });
  sim.step();
  assert.equal(rejected, null);
  assert.equal(k.ward, ABILITIES.kindle.ward);
});

test('out-of-range ability makes the hero walk, then cast', () => {
  const sim = arena();
  const hero = units(sim).find((u) => u.hero);
  hero.x = hero.px = -30; hero.z = hero.pz = 30;
  let cast = 0;
  sim.bus.on('hero:ability', () => cast++);
  sim.issue({ type: 'ability', heroId: hero.id, ability: 'flare', x: 0, z: 30 });
  sim.step();
  assert.equal(cast, 0);
  runUntil(sim, () => cast > 0, 20 * 20);
  assert.equal(cast, 1);
});

test('fallen hero recovers at the keep after 40 s', () => {
  const sim = arena();
  const hero = units(sim).find((u) => u.hero);
  const e = spawnEnemy(sim.world, 'vharek', hero.x + 1, hero.z);
  hero.hp = 5;
  e.target = hero.id;
  runUntil(sim, () => hero.downed, 200);
  assert.ok(hero.downed);
  remove(sim.world, e.id);
  runUntil(sim, () => !hero.downed, 20 * 45);
  assert.equal(hero.downed, false);
  assert.equal(hero.hp, hero.maxHp);
});
