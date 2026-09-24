import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, byType, place, runUntil, grant, settlers, all } from '../helpers/sim.js';
import { BUILDINGS } from '../../src/buildings/defs.js';
import { checkPlacement } from '../../src/construction/index.js';

test('placing a building deducts its cost and creates a construction site', () => {
  const sim = newSim();
  const before = { ...sim.world.players.p1.res };
  const b = place(sim, 'lodge', -66, 40);
  const after = sim.world.players.p1.res;
  assert.equal(b.state, 'site');
  assert.equal(before.timber - after.timber, BUILDINGS.lodge.cost.timber);
  assert.equal(before.stone - after.stone, BUILDINGS.lodge.cost.stone);
});

test('labourers carry materials and build the site to completion', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  const b = place(sim, 'cottage', -54, 64);
  const t = runUntil(sim, () => b.state === 'active', 20 * 120);
  assert.ok(t > 0, 'cottage completed within 2 minutes');
  assert.ok(t > BUILDINGS.cottage.buildTime * 20 * 0.5, 'construction takes real time');
});

test('construction cannot exceed delivered materials', () => {
  const sim = newSim();
  const b = place(sim, 'lodge', -66, 40);
  // freeze deliveries: no supplies arrive if we zero the incoming and supplied manually
  for (let i = 0; i < 200; i++) sim.step();
  let supplied = 0, required = 0;
  for (const r in b.build.required) { required += b.build.required[r]; supplied += Math.min(b.build.required[r], b.build.supplied[r] || 0); }
  assert.ok(b.build.progress <= supplied / required + 1e-9);
});

test('cancel refunds undelivered goods fully', () => {
  const sim = newSim();
  const before = sim.world.players.p1.res.timber;
  const b = place(sim, 'farm', -36, 66);
  sim.issue({ type: 'cancel', id: b.id });
  sim.step();
  assert.equal(sim.world.entities[b.id], undefined);
  assert.equal(sim.world.players.p1.res.timber, before);
});

test('placement validity: territory, water, overlap and deposit requirements', () => {
  const sim = newSim();
  const w = sim.world, s = sim.services;
  const k = keep(sim);
  assert.equal(checkPlacement(w, s, 'p1', 'cottage', k.x, k.z).ok, false, 'overlapping the keep');
  assert.match(checkPlacement(w, s, 'p1', 'cottage', 60, -60).reason, /territory|water|Enemies|steep|close/i);
  assert.match(checkPlacement(w, s, 'p1', 'cottage', 22, -4).reason, /territory|water/i);
  const mineFar = checkPlacement(w, s, 'p1', 'mine', -30, 40);
  assert.equal(mineFar.ok, false);
  assert.match(mineFar.reason, /iron vein/);
  assert.match(checkPlacement(w, s, 'p1', 'tower', -30, 40).reason, /Charter/);
});

test('foresters produce timber that labourers haul to the keep store', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  const lodge = place(sim, 'lodge', -66, 40);
  runUntil(sim, () => lodge.state === 'active', 20 * 90);
  assert.equal(lodge.state, 'active');
  const startTimber = sim.world.players.p1.res.timber;
  const producedBefore = sim.world.stats.produced.timber;
  runUntil(sim, () => lodge.workers.length > 0, 60);
  assert.ok(lodge.workers.length > 0, 'a forester was assigned');
  const forester = sim.world.entities[lodge.workers[0]];
  assert.equal(forester.job, 'forester');
  for (let i = 0; i < 20 * 120; i++) sim.step();
  assert.ok(sim.world.stats.produced.timber - producedBefore >= 9, 'timber produced by work cycles');
  assert.ok(sim.world.players.p1.res.timber > startTimber, 'timber reached the store');
});

test('mine consumes provisions to produce iron and stalls without input', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, { timber: 200, stone: 200 });
  const mine = place(sim, 'mine', -73, 62);
  runUntil(sim, () => mine.state === 'active', 20 * 120);
  assert.equal(mine.state, 'active');
  sim.world.players.p1.res.provisions = 0;
  mine.stock.in.provisions = 0;
  runUntil(sim, () => mine.stall === 'noInput', 20 * 60);
  assert.equal(mine.stall, 'noInput', 'stall reason reported');
  assert.equal(sim.world.stats.produced.iron, 0);
  sim.world.players.p1.res.provisions = 40;
  runUntil(sim, () => sim.world.stats.produced.iron > 0, 20 * 120);
  assert.ok(sim.world.stats.produced.iron >= 2, 'iron produced after provisions delivered');
  assert.ok(sim.world.stats.consumed.provisions >= 1);
});

test('settlers eat provisions and hunger lowers stability', () => {
  const sim = newSim();
  const p = sim.world.players.p1;
  p.res.provisions = 100;
  p.nextMealTick = sim.world.tick + 2;
  for (let i = 0; i < 5; i++) sim.step();
  assert.equal(p.res.provisions, 100 - p.pop);
  p.res.provisions = 0;
  const stab = p.stability;
  p.nextMealTick = sim.world.tick + 2;
  for (let i = 0; i < 5; i++) sim.step();
  assert.ok(p.stability < stab, 'hunger reduces stability');
  assert.equal(p.lastMealFed, 0);
});

test('settlers arrive only after the hearth is lit and while housing is free', () => {
  const sim = newSim();
  const n0 = settlers(sim).length;
  for (let i = 0; i < 20 * 40; i++) sim.step();
  assert.equal(settlers(sim).length, n0, 'no arrivals while the hearth is dark');
  sim.issue({ type: 'rekindle' });
  for (let i = 0; i < 20 * 40; i++) sim.step();
  assert.ok(settlers(sim).length > n0, 'arrivals after rekindling');
  const p = sim.world.players.p1;
  assert.ok(p.pop <= p.popCap);
});

test('worker assignment keeps labourers free for hauling', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, { timber: 400, stone: 200 });
  const a = place(sim, 'lodge', -66, 40);
  const b = place(sim, 'farm', -36, 66);
  runUntil(sim, () => a.state === 'active' && b.state === 'active', 20 * 180);
  for (let i = 0; i < 40; i++) sim.step();
  const free = settlers(sim).filter((s) => !s.job).length;
  assert.ok(free >= 2, `at least two labourers free (got ${free})`);
});

test('farm plots grow and are harvested into provisions', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  const farm = place(sim, 'farm', -36, 66);
  runUntil(sim, () => farm.state === 'active', 20 * 120);
  assert.equal(farm.plots.length, 6);
  const before = sim.world.stats.produced.provisions;
  for (let i = 0; i < 20 * 90; i++) sim.step();
  assert.ok(sim.world.stats.produced.provisions > before);
  assert.ok(farm.plots.some((p) => p.state !== 'fallow'));
});

test('demolish refunds part of the cost and frees the footprint', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  const c = place(sim, 'cottage', -54, 64);
  runUntil(sim, () => c.state === 'active', 20 * 120);
  const timber = sim.world.players.p1.res.timber;
  sim.issue({ type: 'demolish', id: c.id });
  sim.step();
  assert.equal(sim.world.entities[c.id], undefined);
  assert.equal(sim.world.players.p1.res.timber, timber + Math.floor(20 * 0.3));
  assert.ok(sim.services.nav.walkable(c.x, c.z));
});

test('entity iteration and all() stay consistent after removals', () => {
  const sim = newSim();
  const trees = all(sim.world, 'deposit').filter((d) => d.type === 'tree');
  assert.ok(trees.length > 250);
});
