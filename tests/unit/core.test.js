import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, hashSeed } from '../../src/core/rng.js';
import { createFixedLoop } from '../../src/core/loop.js';
import { createModuleHost } from '../../src/core/module-host.js';
import { createEventBus } from '../../src/core/events.js';
import { DT } from '../../src/core/contracts.js';
import { log } from '../../src/core/logger.js';

log.setConsoleLevel('error');

test('rng: same seed gives same sequence; state round-trips', () => {
  const a = createRng(42), b = createRng(42);
  const sa = Array.from({ length: 50 }, () => a.next());
  const sb = Array.from({ length: 50 }, () => b.next());
  assert.deepEqual(sa, sb);
  const st = a.getState();
  const x = [a.next(), a.next()];
  const c = createRng(1); c.setState(st);
  assert.deepEqual([c.next(), c.next()], x);
  assert.notDeepEqual(sa.slice(0, 5), Array.from({ length: 5 }, () => createRng(43).next()));
  assert.equal(hashSeed('abc'), hashSeed('abc'));
  for (let i = 0; i < 1000; i++) { const v = a.int(3, 7); assert.ok(v >= 3 && v <= 7); }
});

test('fixed loop: tick count depends only on elapsed time, not frame rate', () => {
  function run(frameMs, totalMs) {
    let ticks = 0;
    const loop = createFixedLoop({ step: () => ticks++, render: () => {} });
    for (let t = 0; t < totalMs; t += frameMs) loop.advance(frameMs / 1000);
    return ticks;
  }
  const expected = Math.floor(2 / DT);
  for (const fm of [8, 16.6667, 33.3333, 50]) {
    const n = run(fm, 2000);
    assert.ok(Math.abs(n - expected) <= 1, `frame ${fm}ms produced ${n} ticks, expected ~${expected}`);
  }
});

test('fixed loop: pause stops ticks, speed scales them, huge gaps are clamped', () => {
  let ticks = 0;
  const loop = createFixedLoop({ step: () => ticks++, render: () => {} });
  loop.pause(); loop.advance(1); assert.equal(ticks, 0);
  loop.resume(); loop.setSpeed(2); for (let i = 0; i < 10; i++) loop.advance(0.05);
  assert.ok(ticks >= 19 && ticks <= 20);
  ticks = 0; loop.setSpeed(1); loop.advance(10);
  assert.ok(ticks <= 5, 'catch-up capped per frame');
});

test('module host: a throwing non-critical module is isolated and eventually disabled', () => {
  const bus = createEventBus();
  let t = 0;
  const host = createModuleHost({ bus, now: () => t });
  let goodUpdates = 0;
  host.register({ id: 'bad', kind: 'sim', update() { throw new Error('boom'); } });
  host.register({ id: 'good', kind: 'sim', update() { goodUpdates++; } });
  host.initAll({});
  for (let i = 0; i < 5; i++) { t += 100; host.update({ tick: i }); }
  assert.equal(goodUpdates, 5);
  const h = Object.fromEntries(host.health().map((r) => [r.id, r]));
  assert.equal(h.bad.status, 'failed');
  assert.equal(h.good.status, 'ok');
  assert.equal(h.bad.errors, 3);
});

test('module host: critical failure invokes onCritical', () => {
  let called = null;
  const host = createModuleHost({ onCritical: (id) => { called = id; } });
  host.register({ id: 'core', kind: 'view', critical: true, render() { throw new Error('x'); } });
  host.initAll({});
  host.render(0, {});
  assert.equal(called, 'core');
});

test('event bus: unsubscribe works and a throwing listener does not break others', () => {
  const bus = createEventBus();
  let n = 0;
  const off = bus.on('x', () => n++);
  bus.on('x', () => { throw new Error('listener'); });
  bus.on('x', () => n++);
  bus.emit('x');
  assert.equal(n, 2);
  off();
  bus.emit('x');
  assert.equal(n, 3);
});
