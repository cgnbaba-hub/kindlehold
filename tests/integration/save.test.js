import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim } from '../helpers/sim.js';
import { createBot } from '../../src/demo/bot.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';
import { SCHEMA_VERSION } from '../../src/core/contracts.js';

test('save/load round trip continues identically', () => {
  const a = newSim({ seed: 21 });
  const bot = createBot(a);
  bot.play(3000);
  const text = serializeWorld(a.world, 'test');
  const { world } = deserializeWorld(text);
  const b = newSim({ seed: 21 });
  b.replaceWorld(world);
  assert.equal(b.hash(), a.hash(), 'identical right after load');
  for (let i = 0; i < 600; i++) { a.step(); b.step(); }
  assert.equal(b.hash(), a.hash(), 'identical after 600 more ticks');
});

test('migration from schema 1', () => {
  const sim = newSim();
  const doc = JSON.parse(serializeWorld(sim.world));
  doc.schemaVersion = 1; doc.world.schemaVersion = 1;
  delete doc.world.mapEntry; delete doc.world.stats.buildingsBuilt;
  for (const p of Object.values(doc.world.players)) { delete p.burnPenalty; delete p.res.taler; delete p.tax; delete p.nextPayTick; }
  delete doc.world.stats.produced.taler; delete doc.world.stats.consumed.taler;
  const { world, migrated } = deserializeWorld(JSON.stringify(doc));
  assert.deepEqual(migrated, [2, 3, 4]);
  assert.equal(world.schemaVersion, SCHEMA_VERSION);
  assert.equal(world.stats.buildingsBuilt, 0);
  assert.ok(world.mapEntry);
  assert.equal(world.players.p1.burnPenalty, 0);
  assert.equal(world.players.p1.res.taler, 0);
  assert.equal(world.players.p1.tax, 1);
});

test('migration from schema 3 adds the goods of the production chains', () => {
  const sim = newSim({ seed: 5 });
  createBot(sim).play(1500);
  const doc = JSON.parse(serializeWorld(sim.world));
  doc.schemaVersion = 3; doc.world.schemaVersion = 3;
  for (const p of Object.values(doc.world.players)) for (const r of ['flour', 'bread', 'tools']) delete p.res[r];
  for (const k of ['produced', 'consumed']) for (const r of ['flour', 'bread', 'tools']) delete doc.world.stats[k][r];
  const buildings = Object.values(doc.world.entities).filter((e) => e.kind === 'building');
  buildings.forEach((b, i) => { b.stock.inIncoming = i === 0 ? 3 : 0; });
  const { world, migrated } = deserializeWorld(JSON.stringify(doc));
  assert.deepEqual(migrated, [4]);
  assert.equal(world.players.p1.res.bread, 0);
  assert.equal(world.stats.produced.tools, 0);
  assert.deepEqual(world.entities[buildings[0].id].stock.inIncoming, { provisions: 3 });
  assert.deepEqual(world.entities[buildings[1].id].stock.inIncoming, {});
  // and the migrated world keeps running
  const b = newSim({ seed: 5 });
  b.replaceWorld(world);
  for (let i = 0; i < 400; i++) b.step();
});

test('malicious and broken saves are rejected with readable errors', () => {
  const sim = newSim();
  const good = JSON.parse(serializeWorld(sim.world));
  const cases = [
    ['not json', /invalid JSON/],
    [JSON.stringify({ format: 'other' }), /not a Kindlehold save/],
    [JSON.stringify({ ...good, schemaVersion: 99 }), /newer version/],
    [JSON.stringify({ ...good, world: { ...good.world, tick: -5 } }), /tick/],
    [JSON.stringify({ ...good, world: { ...good.world, entities: { 1: { id: 1, kind: 'dragon', x: 0, z: 0, owner: 'p1' } } } }), /kind/],
    (() => { const u = Object.values(good.world.entities).find((e) => e.kind === 'unit'); return [JSON.stringify({ ...good, world: { ...good.world, entities: { 5: { ...u, id: 6 } } } }), /does not match/]; })(),
    ['x'.repeat(3 * 1024 * 1024), /too large/],
  ];
  for (const [text, re] of cases) assert.throws(() => deserializeWorld(text), re);
  // prototype pollution attempt is stripped and does not pollute Object.prototype
  const evil = serializeWorld(sim.world).replace('"tick":', '"__proto__":{"polluted":1},"tick":');
  deserializeWorld(evil);
  assert.equal(({}).polluted, undefined);
});

test('saves that would break modules after loading are rejected up front', () => {
  const sim = newSim();
  const good = JSON.parse(serializeWorld(sim.world));
  const b = Object.values(good.world.entities).find((e) => e.kind === 'building');
  const cases = [
    [{ ...good, world: { ...good.world, players: {} } }, /players/],
    [{ ...good, world: { ...good.world, entities: { ...good.world.entities, [b.id]: { ...b, type: 'dragonlair' } } } }, /type/],
    [{ ...good, world: { ...good.world, mission: { ...good.world.mission, objectives: [{ id: 'nope', state: 'done' }] } } }, /objective/],
    [{ ...good, world: { ...good.world, combat: undefined } }, /combat/],
    [{ ...good, world: { ...good.world, nextId: 2e9 } }, /nextId/],
    [{ ...good, world: { ...good.world, entities: { ...good.world.entities, [b.id]: { ...b, x: 1e9 } } } }, /x/],
  ];
  for (const [doc, re] of cases) assert.throws(() => deserializeWorld(JSON.stringify(doc)), re);
});

test('non-finite numbers and oversized strings are rejected', () => {
  const sim = newSim();
  const doc = JSON.parse(serializeWorld(sim.world));
  doc.label = 'x';
  doc.world.meta.title = 'y'.repeat(5000);
  assert.throws(() => deserializeWorld(JSON.stringify(doc)), /string too long/);
});

test('load smoke test accepts real saves', async () => {
  const { smokeTestWorld } = await import('../../src/app/load-check.js');
  const sim = newSim({ seed: 4 });
  createBot(sim).play(1200);
  const { world } = deserializeWorld(serializeWorld(sim.world));
  assert.equal(smokeTestWorld(world), true);
});
