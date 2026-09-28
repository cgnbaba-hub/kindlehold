// Chapter 6: the Iron March, House Morrow, and Wren Fenmore as a second playable hero.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../../src/app/simulation.js';
import { all } from '../helpers/sim.js';
import { enemyFaction } from '../../src/ai/factions.js';
import { dealDamage } from '../../src/combat/index.js';
import { spawnEnemy } from '../../src/ai/index.js';
import { ABILITIES, heroAbilities } from '../../src/heroes/index.js';
import { isExplored } from '../../src/exploration/index.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';
import { log } from '../../src/core/logger.js';

log.setConsoleLevel('error');
const chapter6 = () => createSimulation({ seed: 6, difficulty: 'normal', scenarioId: 'irondebt' });
const wrenOf = (w) => all(w, 'unit').find((u) => u.type === 'wren');

test('chapter six is played in the Iron March against House Morrow, with Wren at Maren\'s side', () => {
  const sim = chapter6();
  sim.step();
  const w = sim.world;
  assert.equal(sim.terrain.map.id, 'ironmarch');
  assert.equal(enemyFaction(w).id, 'morrow');
  assert.equal(w.players.p2.name, 'House Morrow');
  assert.ok(all(w, 'building').some((b) => b.type === 'morrowhold'));
  assert.ok(!all(w, 'unit').some((u) => u.type === 'ismay'), 'Lady Ismay stays inside until her host is broken');
  const heroes = all(w, 'unit').filter((u) => u.owner === 'p1' && u.hero).map((u) => u.type).sort();
  assert.deepEqual(heroes, ['maren', 'wren']);
  assert.deepEqual(heroAbilities(wrenOf(w)).map((a) => a.id), ['volley', 'mark']);
  assert.equal(all(w, 'poi').filter((p) => p.type === 'cairn').length, 3, 'three border beacons');
  assert.ok(all(w, 'building').some((b) => b.type === 'barracks' && b.owner === 'p1' && b.level === 2), 'the Drill Yard came along');
  assert.ok(all(w, 'unit').some((u) => u.owner === 'p1' && u.type === 'sapper'));
});

test('Wren\'s Arrow Storm lands after the arrows fly, and only on enemies in the circle', () => {
  const sim = chapter6();
  sim.step();
  const w = sim.world;
  const wren = wrenOf(w);
  const near = spawnEnemy(w, 'ironguard', wren.x + 12, wren.z);
  const far = spawnEnemy(w, 'ironguard', wren.x + 12, wren.z + 12);
  for (const e of [near, far]) { e.cd = 1e9; e.order = { type: 'hold', ax: e.x, az: e.z }; }
  const hp0 = near.hp, far0 = far.hp;
  sim.issue({ type: 'ability', heroId: wren.id, ability: 'volley', x: near.x, z: near.z });
  sim.step();
  assert.equal(near.hp, hp0, 'no damage before the arrows arrive');
  sim.run(20);
  assert.ok(near.hp <= hp0 - ABILITIES.volley.damage * 0.9, `the storm struck (${hp0} -> ${near.hp})`);
  assert.ok(far.hp >= far0 - 40, 'outside the circle only Wren\'s own shots can land');
  sim.issue({ type: 'ability', heroId: wren.id, ability: 'volley', x: near.x, z: near.z });
  sim.step();
  assert.ok(wren.abilityCd.volley > w.tick, 'on cooldown');
});

test('Hunter\'s Mark makes enemies take more damage and reveals the land', () => {
  const sim = chapter6();
  sim.step();
  const w = sim.world;
  const wren = wrenOf(w);
  const a = spawnEnemy(w, 'delver', wren.x + 14, wren.z - 6);
  const b = spawnEnemy(w, 'delver', wren.x - 60, wren.z - 60);
  for (const e of [a, b]) { e.cd = 1e9; e.order = { type: 'hold', ax: e.x, az: e.z }; }
  sim.issue({ type: 'ability', heroId: wren.id, ability: 'mark', x: a.x, z: a.z });
  sim.step();
  assert.ok(a.markedUntil > w.tick);
  const ha = a.hp, hb = b.hp;
  dealDamage(w, null, a, 20, 'flare');
  dealDamage(w, null, b, 20, 'flare');
  assert.equal(ha - a.hp, 26, 'marked: +30%');
  assert.equal(hb - b.hp, 20);
  assert.ok(isExplored(w, sim.terrain.half, a.x + 20, a.z));
  // Maren cannot use Wren's abilities, nor Wren Maren's
  const maren = all(w, 'unit').find((u) => u.type === 'maren');
  let rejected = null;
  sim.bus.on('command:rejected', (e) => { rejected = e; });
  sim.issue({ type: 'ability', heroId: maren.id, ability: 'volley', x: a.x, z: a.z });
  sim.step();
  assert.ok(rejected, 'refused');
});

test('Delvers tear down buildings; the hold opens and Lady Ismay takes the field when the host is broken', () => {
  const sim = chapter6();
  sim.step();
  const w = sim.world;
  const cottage = all(w, 'building').find((b) => b.type === 'cottage' && b.owner === 'p1');
  const delver = spawnEnemy(w, 'delver', cottage.x + 3, cottage.z);
  const guard = spawnEnemy(w, 'ironguard', cottage.x - 3, cottage.z);
  const h0 = cottage.hp;
  dealDamage(w, guard, cottage, 12, 'melee');
  const byGuard = h0 - cottage.hp;
  const h1 = cottage.hp;
  dealDamage(w, delver, cottage, 14 * 3, 'siege');
  assert.ok(h1 - cottage.hp >= byGuard * 5, 'a Delver\'s pick outdoes a spear on walls');
  // break the household host
  w.mission.flags.raidWarned = true;
  w.ai.wave = 2;
  sim.run(40);
  assert.ok(!w.mission.flags.hallBarred, 'the gates open');
  assert.ok(all(w, 'unit').some((u) => u.type === 'ismay' && u.commander), 'Lady Ismay stands at her gate');
  assert.equal((w.mission.objectives.find((o) => o.id === 'hold') || {}).state, 'pending', 'Delvholm must still be freed');
});

test('chapter six saves and loads with both heroes', () => {
  const sim = chapter6();
  sim.run(40);
  const wren = wrenOf(sim.world);
  wren.abilityCd = { mark: 999 };
  const json = serializeWorld(sim.world);
  const doc = deserializeWorld(json);
  assert.equal(doc.world.meta.scenarioId, 'irondebt');
  assert.equal(doc.world.ai.faction, 'morrow');
  const sim2 = createSimulation({ seed: 6, difficulty: 'normal', scenarioId: 'irondebt' });
  sim2.replaceWorld(doc.world);
  sim2.run(20);
  assert.equal(sim2.terrain.map.id, 'ironmarch');
  assert.equal(wrenOf(sim2.world).abilityCd.mark, 999);
  assert.equal(all(sim2.world, 'unit').filter((u) => u.hero).length, 2);
});
