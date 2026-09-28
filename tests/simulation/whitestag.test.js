// Chapter 5: the Whitehart vale, the Order of the White Stag, occupied villages and Sappers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../../src/app/simulation.js';
import { all } from '../helpers/sim.js';
import { enemyFaction } from '../../src/ai/factions.js';
import { dealDamage } from '../../src/combat/index.js';
import { spawnUnit } from '../../src/units/sim.js';
import { occupiedBy } from '../../src/pois/index.js';
import { evaluate } from '../../src/missions/conditions.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';
import { log } from '../../src/core/logger.js';

log.setConsoleLevel('error');
const chapter5 = () => createSimulation({ seed: 5, difficulty: 'normal', scenarioId: 'whitestag' });
const hamlets = (w) => all(w, 'poi').filter((p) => p.type === 'hamlet');

test('chapter five is played in Whitehart against the Order of the White Stag', () => {
  const sim = chapter5();
  sim.step();
  const w = sim.world;
  assert.equal(sim.terrain.map.id, 'whitehart');
  assert.ok(sim.terrain.waterDepth(22, -50) > 0.5, 'the Varrow is deep between the fords');
  assert.ok(sim.terrain.waterDepth(14, 30) < 0.5, 'the King\'s ford can be crossed');
  assert.equal(enemyFaction(w).id, 'stag');
  assert.equal(w.players.p2.name, 'Order of the White Stag');
  assert.ok(all(w, 'building').some((b) => b.type === 'staghall'));
  assert.ok(all(w, 'unit').some((u) => u.type === 'vane' && u.commander));
  // three villages, each held by an outpost with a tower and a standing guard
  assert.equal(hamlets(w).length, 3);
  for (const h of hamlets(w)) assert.ok(occupiedBy(w, h), 'every village starts occupied');
  const guards = all(w, 'unit').filter((u) => u.owner === 'p2' && u.sentinel);
  assert.ok(guards.length >= 19, `village guards and garrison stand watch (${guards.length})`);
  assert.equal(all(w, 'building').filter((b) => b.type === 'stagtower').length, 9);
  // the company arrives with its veterans, a lit keep and a barracks
  assert.ok(all(w, 'building').find((b) => b.type === 'keep').lit);
  assert.ok(all(w, 'building').some((b) => b.type === 'barracks' && b.owner === 'p1'));
  assert.ok(w.players.p1.popCap > w.players.p1.pop, 'room for the camp to grow');
});

test('an occupied village will not join until its outpost is broken', () => {
  const sim = chapter5();
  sim.step();
  const w = sim.world;
  const ashby = hamlets(w).find((h) => h.x < 0);
  ashby.state = 'found';
  const maren = all(w, 'unit').find((u) => u.type === 'maren');
  maren.x = ashby.x; maren.z = ashby.z + 1;
  maren.order = { type: 'hold', ax: maren.x, az: maren.z };
  for (const u of all(w, 'unit')) if (u.owner === 'p2' && u.sentinel) u.cd = 1e9; // keep the guard from fighting in the test
  sim.run(20);
  assert.equal(ashby.state, 'found', 'the outpost still holds Ashby');
  // clear the outpost: guards and tower
  for (const u of all(w, 'unit')) if (u.owner === 'p2' && Math.hypot(u.x - ashby.x, u.z - ashby.z) < 30) dealDamage(w, null, u, 9999, 'flare');
  for (const b of all(w, 'building')) if (b.owner === 'p2' && Math.hypot(b.x - ashby.x, b.z - ashby.z) < 30) dealDamage(w, null, b, 99999, 'siege');
  sim.run(40);
  maren.x = ashby.x; maren.z = ashby.z + 1;
  sim.run(20);
  assert.equal(ashby.state, 'done', 'Ashby stands with the Warden');
  assert.ok(evaluate(w, { poiDone: 'hamlet' }));
  assert.ok(!evaluate(w, { poiDone: 'hamlet', count: 3 }), 'two villages still to free');
});

test('Sappers break stone walls that shrug off swords', () => {
  const sim = chapter5();
  sim.step();
  const w = sim.world;
  const tower = all(w, 'building').find((b) => b.type === 'stagtower');
  const blade = spawnUnit(w, 'blade', 'p1', tower.x, tower.z + 4);
  const sapper = spawnUnit(w, 'sapper', 'p1', tower.x, tower.z + 4);
  assert.ok(evaluate(w, { units: 'sapper' }));
  assert.ok(!evaluate(w, { units: 'sapper', count: 4 }));
  // one swing each, the way the combat module deals them
  const hp0 = tower.hp;
  dealDamage(w, blade, tower, 16, 'melee');
  const byBlade = hp0 - tower.hp;
  dealDamage(w, sapper, tower, 12 * 4, 'siege');
  const bySapper = hp0 - byBlade - tower.hp;
  assert.ok(bySapper >= byBlade * 10, `a sapper's maul (${bySapper}) far outdoes a sword (${byBlade}) on stone`);
  // in the running simulation a sapper next to the tower wears it down quickly
  const before = tower.hp;
  sapper.order = { type: 'attack', target: tower.id };
  sapper.target = tower.id;
  sim.run(20 * 6);
  assert.ok(tower.hp < before - 60 || tower.state === 'destroyed', `the tower crumbles (${before} -> ${tower.hp})`);
});

test('the Drill Yard trains Sappers', () => {
  const sim = chapter5();
  sim.step();
  const w = sim.world;
  const bk = all(w, 'building').find((b) => b.type === 'barracks' && b.owner === 'p1');
  Object.assign(w.players.p1.res, { timber: 999, stone: 999, iron: 999, taler: 999, provisions: 999 });
  sim.issue({ type: 'recruit', building: bk.id, unitType: 'sapper' });
  sim.step();
  assert.equal(bk.queue.length, 0, 'a plain barracks cannot train Sappers');
  bk.level = 2;
  sim.issue({ type: 'recruit', building: bk.id, unitType: 'sapper' });
  sim.step();
  assert.equal(bk.queue.length, 1);
  sim.run(20 * 40);
  assert.ok(all(w, 'unit').some((u) => u.owner === 'p1' && u.type === 'sapper'), 'a Sapper marches out');
});

test('chapter five saves and loads onto the right map', () => {
  const sim = chapter5();
  sim.run(40);
  const json = serializeWorld(sim.world);
  const doc = deserializeWorld(json);
  assert.equal(doc.world.meta.scenarioId, 'whitestag');
  assert.equal(doc.world.ai.faction, 'stag');
  const sim2 = createSimulation({ seed: 5, difficulty: 'normal', scenarioId: 'whitestag' });
  sim2.replaceWorld(doc.world);
  sim2.run(20);
  assert.equal(sim2.terrain.map.id, 'whitehart');
  assert.equal(hamlets(sim2.world).length, 3);
  assert.equal(all(sim2.world, 'building').filter((b) => b.type === 'stagtower').length, 9, 'no second set of outposts after loading');
});
