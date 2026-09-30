// The longer production chains: grain -> Windmill -> flour -> Bakery -> bread, and
// iron -> Smithy -> tools -> the third level of the workshops.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, place, runUntil, grant } from '../helpers/sim.js';
import { UPGRADES, workSpeedOf, nextUpgrade } from '../../src/buildings/defs.js';
import { BREAD_PORTIONS } from '../../src/population/index.js';

function started(extra = {}) {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, { timber: 400, stone: 300, iron: 60, taler: 300, provisions: 200, ...extra });
  return sim;
}

test('the Windmill grinds grain into flour and the Bakery bakes it into bread', () => {
  const sim = started();
  const mill = place(sim, 'mill', -60, 52);
  const bakery = place(sim, 'bakery', -48, 60);
  const p = sim.world.players.p1;
  const t = runUntil(sim, () => p.res.bread >= 4, 20 * 480);
  assert.ok(t > 0, `bread reached the Keep (flour ${p.res.flour}, bread ${p.res.bread}, mill ${mill.stall}, bakery ${bakery.stall})`);
  assert.ok(sim.world.stats.produced.flour > 0, 'flour was ground');
  assert.ok(sim.world.stats.consumed.flour > 0, 'flour was baked');
  assert.ok(sim.world.stats.consumed.timber > 0, 'the oven burned timber');
  assert.ok(sim.world.entities[mill.id].workers.length === 1 && sim.world.entities[bakery.id].workers.length === 1);
});

test('the Windmill leaves the grain the next meal needs', () => {
  const sim = started();
  const mill = place(sim, 'mill', -60, 52);
  runUntil(sim, () => mill.state === 'active', 20 * 150);
  const p = sim.world.players.p1;
  p.res.provisions = Math.max(0, p.pop - 1);
  mill.stock.in.provisions = 0;
  for (let i = 0; i < 20 * 20; i++) { p.res.provisions = Math.max(0, p.pop - 1); sim.step(); }
  assert.equal(mill.stock.in.provisions || 0, 0, 'no grain went to the mill while stores were short');
  assert.equal(mill.stall, 'noInput');
});

test('bread feeds two per loaf at mealtime and lifts stability', () => {
  const sim = started({ provisions: 0 });
  const p = sim.world.players.p1;
  for (let i = 0; i < 40; i++) sim.step();
  p.res.provisions = 0;
  p.res.bread = 100;
  p.nextMealTick = sim.world.tick + 1;
  const need = p.pop;
  sim.step(); sim.step();
  assert.ok(100 - p.res.bread <= Math.ceil(need / BREAD_PORTIONS), `ate ${100 - p.res.bread} loaves for ${need} people`);
  assert.equal(p.lastMealFed, 1, 'everyone was fed from bread alone');
  assert.ok(p.breadMeals > 0.99);
  for (let i = 0; i < 40; i++) sim.step();
  const withBread = p.stabilityTarget;
  p.breadMeals = 0;
  for (let i = 0; i < 40; i++) sim.step();
  assert.ok(p.stabilityTarget < withBread, `bread raises the stability target (${withBread} vs ${p.stabilityTarget})`);
});

test('the Smithy forges tools, and tools open the third workshop level', () => {
  const sim = started();
  const smithy = place(sim, 'smithy', -60, 52);
  const lodge = place(sim, 'lodge', -66, 40);
  const p = sim.world.players.p1;
  const t = runUntil(sim, () => p.res.tools >= 4, 20 * 600);
  assert.ok(t > 0, `tools reached the Keep (tools ${p.res.tools}, smithy ${smithy.stall})`);
  assert.ok(sim.world.stats.consumed.iron >= 8, 'iron was forged');
  // level 2 needs no tools, level 3 does
  runUntil(sim, () => lodge.state === 'active', 20 * 60);
  assert.equal(UPGRADES.lodge[2].cost.tools, undefined);
  assert.equal(UPGRADES.lodge[3].cost.tools, 4);
  lodge.level = 2;
  const toolsBefore = p.res.tools;
  sim.issue({ type: 'upgrade', id: lodge.id });
  sim.step();
  assert.ok(lodge.upgrade, 'the upgrade started');
  assert.equal(toolsBefore - p.res.tools, 4, 'four tools were spent');
  runUntil(sim, () => lodge.level === 3, 20 * 120);
  assert.equal(lodge.level, 3);
  assert.equal(nextUpgrade(lodge), null);
  assert.ok(Math.abs(workSpeedOf(lodge) - 1.2 * 1.25) < 1e-9, 'speed bonuses multiply');
});

test('without tools the third level is refused', () => {
  const sim = started({ tools: 0 });
  const lodge = place(sim, 'lodge', -66, 40);
  runUntil(sim, () => lodge.state === 'active', 20 * 150);
  lodge.level = 2;
  const rejected = [];
  sim.bus.on('command:rejected', (r) => rejected.push(r));
  sim.issue({ type: 'upgrade', id: lodge.id });
  sim.step();
  assert.equal(lodge.upgrade ?? null, null);
  assert.ok(rejected.length > 0, 'the command was rejected');
});
