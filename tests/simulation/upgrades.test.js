import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, place, runUntil, grant, units, all } from '../helpers/sim.js';
import { UPGRADES, levelOf, slotsOf, BUILDINGS } from '../../src/buildings/defs.js';
import { housingCap, paydayForecast } from '../../src/population/index.js';
import { territorySources } from '../../src/world/territory.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';
import { spawnUnit } from '../../src/units/sim.js';
import { UNITS } from '../../src/units/defs.js';

const RICH = { timber: 999, stone: 999, iron: 999, provisions: 999, taler: 999 };

test('upgrading the Keep costs resources, takes time and widens territory, housing and taxes', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  sim.step();
  const k = keep(sim);
  const terr0 = territorySources(sim.world).find((s) => s.id === k.id).r;
  const cap0 = housingCap(sim.world, 'p1');
  grant(sim, RICH);
  const stone0 = sim.world.players.p1.res.stone;
  sim.issue({ type: 'upgrade', id: k.id });
  sim.step();
  assert.ok(k.upgrade, 'upgrade started');
  assert.equal(stone0 - sim.world.players.p1.res.stone, UPGRADES.keep[2].cost.stone);
  sim.issue({ type: 'upgrade', id: k.id }); // a second order while upgrading is refused
  sim.step();
  assert.equal(stone0 - sim.world.players.p1.res.stone, UPGRADES.keep[2].cost.stone);
  const t = runUntil(sim, () => levelOf(k) === 2, 20 * 200);
  assert.ok(t > 20 * 30, `takes real time (${t} ticks)`);
  assert.equal(territorySources(sim.world).find((s) => s.id === k.id).r, terr0 + UPGRADES.keep[2].territory);
  assert.equal(housingCap(sim.world, 'p1'), cap0 + UPGRADES.keep[2].housing);
  assert.equal(k.maxHp, BUILDINGS.keep.hp + UPGRADES.keep[2].hp);
  // level 3 needs the March Charter
  sim.issue({ type: 'upgrade', id: k.id });
  sim.step();
  assert.ok(!k.upgrade, 'fortress refused without the charter');
  const loaded = deserializeWorld(serializeWorld(sim.world)).world;
  assert.equal(loaded.entities[k.id].level, 2);
  const f = paydayForecast(sim.world, 'p1');
  assert.ok(f.taxes >= f.settlers * 2, 'castle raises taxes');
});

test('cottages grow into stone houses; townhouses need the castle', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, RICH);
  const c = place(sim, 'cottage', -54, 64);
  runUntil(sim, () => c.state === 'active', 20 * 120);
  const cap = housingCap(sim.world, 'p1');
  sim.issue({ type: 'upgrade', id: c.id });
  runUntil(sim, () => levelOf(c) === 2, 20 * 60);
  assert.equal(housingCap(sim.world, 'p1'), cap + UPGRADES.cottage[2].housing);
  sim.issue({ type: 'upgrade', id: c.id });
  sim.step();
  assert.ok(!c.upgrade, 'townhouse refused before the castle');
});

test('workshop level 2 adds a worker slot', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, RICH);
  const l = place(sim, 'lodge', -66, 40);
  runUntil(sim, () => l.state === 'active', 20 * 120);
  assert.equal(slotsOf(l), BUILDINGS.lodge.slots);
  sim.issue({ type: 'upgrade', id: l.id });
  runUntil(sim, () => levelOf(l) === 2, 20 * 60);
  assert.equal(slotsOf(l), BUILDINGS.lodge.slots + 1);
});

test('Steel Mail toughens soldiers; Veteran Drill needs the castle', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  grant(sim, RICH);
  const b = place(sim, 'barracks', -30, 38);
  runUntil(sim, () => b.state === 'active', 20 * 200);
  const u = spawnUnit(sim.world, 'shield', 'p1', -40, 40);
  sim.world.players.p1.techs.blades = true;
  sim.issue({ type: 'research', techId: 'mail' });
  runUntil(sim, () => sim.world.players.p1.techs.mail, 20 * 120);
  assert.equal(u.maxHp, Math.round(UNITS.shield.hp * 1.2));
  const fresh = spawnUnit(sim.world, 'blade', 'p1', -40, 42);
  assert.equal(fresh.maxHp, Math.round(UNITS.blade.hp * 1.2));
  sim.issue({ type: 'research', techId: 'drill' });
  sim.step();
  assert.ok(!sim.world.players.p1.research, 'drill refused without the castle');
  assert.ok(units(sim).length > 0 && all(sim.world, 'building').length > 0);
});
