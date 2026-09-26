import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, settlers } from '../helpers/sim.js';
import { PAY_INTERVAL, TAX_LEVELS, HIRE_COST, paydayForecast } from '../../src/population/index.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';

test('payday: settlers pay taxes into the treasury every two minutes', () => {
  const sim = newSim();
  sim.issue({ type: 'rekindle' });
  sim.step();
  const p = sim.world.players.p1;
  const before = p.res.taler;
  sim.world.tick = p.nextPayTick - 1;
  const f = paydayForecast(sim.world, 'p1');
  sim.run(2);
  assert.ok(f.taxes > 0);
  assert.equal(p.res.taler, before + f.taxes - f.pay);
  assert.ok(p.nextPayTick > sim.world.tick + PAY_INTERVAL - 5);
});

test('tax level trades income against stability', () => {
  const run = (level) => {
    const sim = newSim();
    sim.issue({ type: 'rekindle' });
    sim.issue({ type: 'setTax', level });
    sim.run(20 * 60);
    return { sim, p: sim.world.players.p1 };
  };
  const low = run(0), high = run(2);
  assert.equal(low.p.tax, 0);
  assert.equal(high.p.tax, 2);
  assert.ok(low.p.stabilityTarget > high.p.stabilityTarget, `${low.p.stabilityTarget} > ${high.p.stabilityTarget}`);
  assert.ok(TAX_LEVELS[2].perSettler > TAX_LEVELS[0].perSettler);
  // invalid levels are ignored
  high.sim.issue({ type: 'setTax', level: 7 });
  high.sim.step();
  assert.equal(high.p.tax, 2);
});

test('hiring a labourer costs Taler and needs free housing', () => {
  const sim = newSim();
  const p = sim.world.players.p1;
  sim.issue({ type: 'hireSettler' });
  sim.step();
  const n0 = settlers(sim).length;
  sim.issue({ type: 'rekindle' });
  sim.step();
  p.res.taler = HIRE_COST + 5;
  sim.issue({ type: 'hireSettler' });
  sim.step();
  assert.equal(settlers(sim).length, n0 + 1, 'one labourer hired');
  assert.equal(Math.round(p.res.taler), 5);
  sim.issue({ type: 'hireSettler' });
  sim.step();
  assert.equal(settlers(sim).length, n0 + 1, 'not enough Taler for another');
  assert.ok(keep(sim));
  const loaded = deserializeWorld(serializeWorld(sim.world)).world;
  assert.equal(loaded.players.p1.tax, 1);
});
