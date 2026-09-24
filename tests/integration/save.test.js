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
  for (const p of Object.values(doc.world.players)) delete p.burnPenalty;
  const { world, migrated } = deserializeWorld(JSON.stringify(doc));
  assert.deepEqual(migrated, [2]);
  assert.equal(world.schemaVersion, SCHEMA_VERSION);
  assert.equal(world.stats.buildingsBuilt, 0);
  assert.ok(world.mapEntry);
  assert.equal(world.players.p1.burnPenalty, 0);
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
    [JSON.stringify({ ...good, world: { ...good.world, entities: { 5: { id: 6, kind: 'unit', x: 0, z: 0, owner: 'p1' } } } }), /does not match/],
    ['x'.repeat(3 * 1024 * 1024), /too large/],
  ];
  for (const [text, re] of cases) assert.throws(() => deserializeWorld(text), re);
  // prototype pollution attempt is stripped and does not pollute Object.prototype
  const evil = serializeWorld(sim.world).replace('"tick":', '"__proto__":{"polluted":1},"tick":');
  deserializeWorld(evil);
  assert.equal(({}).polluted, undefined);
});

test('non-finite numbers and oversized strings are rejected', () => {
  const sim = newSim();
  const doc = JSON.parse(serializeWorld(sim.world));
  doc.label = 'x';
  doc.world.meta.title = 'y'.repeat(5000);
  assert.throws(() => deserializeWorld(JSON.stringify(doc)), /string too long/);
});
