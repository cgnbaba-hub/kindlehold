// Level 2.8: the wider valley, the Greyfen brigands, diplomacy and a market with moving prices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, units, all, grant } from '../helpers/sim.js';
import { BRIGANDS, stance, relation, hostile, GIFT, TRUCE, ALLY_AT } from '../../src/diplomacy/index.js';
import { dealDamage } from '../../src/combat/index.js';
import { createBuildingEntity } from '../../src/construction/index.js';
import { emit } from '../../src/world/world.js';
import { EV } from '../../src/core/contracts.js';
import { TRADES, priceOf, ensureMarket } from '../../src/pois/index.js';
import { reveal } from '../../src/exploration/index.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';

const hall = (sim) => all(sim.world, 'building').find((b) => b.type === 'brigandhall');

test('the valley is wider and the Greyfen hold its northern fens', () => {
  const sim = newSim();
  sim.step();
  assert.equal(sim.terrain.half, 192);
  assert.ok(sim.world.players[BRIGANDS], 'brigand faction exists');
  const h = hall(sim);
  assert.ok(h && h.owner === BRIGANDS && h.state === 'active');
  assert.equal(all(sim.world, 'building').filter((b) => b.type === 'brigandtower').length, 2);
  assert.ok(units(sim, BRIGANDS).some((u) => u.type === 'morwen'), 'Morwen leads them');
  assert.equal(stance(sim.world, 'p1', BRIGANDS), 'neutral');
  assert.equal(stance(sim.world, 'p1', 'p2'), 'war');
  assert.equal(stance(sim.world, 'p2', BRIGANDS), 'war', 'the brigands feud with the Rustfang');
  assert.equal(hostile(sim.world, 'p1', BRIGANDS), false);
});

test('gifts win the brigands over; allies ride out against Rustfang raids', () => {
  const sim = newSim();
  sim.step();
  grant(sim, { taler: 999 });
  const r0 = relation(sim.world, 'p1', BRIGANDS);
  sim.issue({ type: 'gift', to: BRIGANDS });
  sim.step();
  assert.equal(relation(sim.world, 'p1', BRIGANDS), r0 + GIFT.gain);
  const paid = 999 - sim.world.players.p1.res.taler;
  sim.issue({ type: 'gift', to: BRIGANDS });
  sim.step();
  assert.equal(relation(sim.world, 'p1', BRIGANDS), r0 + GIFT.gain, 'cooldown blocks a second gift');
  assert.equal(999 - sim.world.players.p1.res.taler, paid, 'nothing paid for the refused gift');
  while (stance(sim.world, 'p1', BRIGANDS) !== 'allied') {
    sim.run(GIFT.cooldown);
    sim.issue({ type: 'gift', to: BRIGANDS });
    sim.step();
    assert.ok(sim.world.tick < 20 * 60 * 10, 'alliance reached');
  }
  assert.ok(relation(sim.world, 'p1', BRIGANDS) >= ALLY_AT);
  const k = all(sim.world, 'building').find((b) => b.type === 'keep');
  emit(sim.world, EV.AI_WAVE, { wave: 1, size: 5, target: k.id, x: k.x, z: k.z });
  assert.ok(sim.world.brigands.helpIds.length >= 3, 'allies send help');
  const helper = sim.world.entities[sim.world.brigands.helpIds[0]];
  assert.equal(helper.order.type, 'attackMove');
});

test('striking a neutral faction means war; blood money buys peace', () => {
  const sim = newSim();
  sim.step();
  grant(sim, { taler: 999 });
  const mine = units(sim, 'p1')[0];
  const theirs = units(sim, BRIGANDS).find((u) => !u.commander);
  dealDamage(sim.world, mine, theirs, 1);
  assert.equal(stance(sim.world, 'p1', BRIGANDS), 'war');
  assert.equal(hostile(sim.world, BRIGANDS, 'p1'), true);
  sim.issue({ type: 'peace', to: 'p2' });
  sim.step();
  assert.equal(stance(sim.world, 'p1', 'p2'), 'war', 'Vharek does not make peace');
  sim.issue({ type: 'peace', to: BRIGANDS });
  sim.step();
  assert.equal(stance(sim.world, 'p1', BRIGANDS), 'neutral');
});

test('at war the brigands raid Kindlehold', () => {
  const sim = newSim();
  sim.step();
  sim.issue({ type: 'declareWar', to: BRIGANDS });
  sim.step();
  assert.equal(stance(sim.world, 'p1', BRIGANDS), 'war');
  let raided = null;
  sim.bus.on('brigands:raid', (e) => { raided = e; });
  for (let i = 0; i < 20 * 150 && !raided; i++) sim.step();
  assert.ok(raided, 'a raid set out');
  assert.ok(raided.size >= 3);
  const raider = sim.world.entities[sim.world.brigands.raidIds[0]];
  assert.equal(raider.order.type, 'attackMove');
});

test('building on Greyfen land sours the relation', () => {
  const sim = newSim();
  sim.step();
  const h = hall(sim);
  const r0 = relation(sim.world, 'p1', BRIGANDS);
  createBuildingEntity(sim.world, { type: 'cottage', owner: 'p1', x: h.x + 36, z: h.z + 20, rot: 0, state: 'active' });
  sim.run(60);
  assert.ok(relation(sim.world, 'p1', BRIGANDS) <= r0 - 30);
  sim.run(200);
  assert.ok(relation(sim.world, 'p1', BRIGANDS) >= r0 - 31, 'each building counts once');
});

test('a toll buys a truce from the Rustfang', () => {
  const sim = newSim();
  sim.step();
  grant(sim, { taler: 500 });
  sim.issue({ type: 'truce', to: 'p2' });
  sim.step();
  assert.equal(stance(sim.world, 'p1', 'p2'), 'truce');
  assert.equal(hostile(sim.world, 'p1', 'p2'), false);
  assert.equal(sim.world.players.p1.res.taler, 500 - TRUCE.cost.taler);
  assert.ok(sim.world.ai.raidTick == null || sim.world.ai.raidTick > sim.world.tick + TRUCE.duration);
  sim.run(TRUCE.duration + 20);
  assert.equal(stance(sim.world, 'p1', 'p2'), 'war', 'the truce runs out');
});

test('market prices follow supply and demand and relax again', () => {
  const sim = newSim();
  sim.step();
  grant(sim, { taler: 999, iron: 200 });
  const trader = all(sim.world, 'poi').find((p) => p.type === 'trader' && p.mapIndex === 0) || all(sim.world, 'poi').find((p) => p.type === 'trader');
  reveal(sim.world, sim.terrain.half, trader.x, trader.z, 8);
  sim.run(20);
  const buy = TRADES.find((t) => t.id === 'buyIron'), sell = TRADES.find((t) => t.id === 'sellIron');
  const p0 = priceOf(sim.world, sim.terrain.map, trader, buy).give.taler;
  sim.issue({ type: 'trade', id: trader.id, deal: 'buyIron' }); sim.step();
  sim.issue({ type: 'trade', id: trader.id, deal: 'buyIron' }); sim.step();
  const p1 = priceOf(sim.world, sim.terrain.map, trader, buy).give.taler;
  assert.ok(p1 > p0, `buying makes iron dearer (${p0} -> ${p1})`);
  const s1 = priceOf(sim.world, sim.terrain.map, trader, sell).get.taler;
  sim.run(20 * 120);
  assert.ok(ensureMarket(sim.world).iron < 1.25 && priceOf(sim.world, sim.terrain.map, trader, buy).give.taler < p1, 'prices relax over time');
  assert.ok(s1 > sell.get.taler, 'selling pays more while iron is scarce');
  const market = all(sim.world, 'poi').filter((p) => p.type === 'trader');
  assert.ok(market.length >= 2, 'a second market at Saltbridge');
});

test('diplomacy, brigands and prices survive save and load', () => {
  const sim = newSim();
  sim.step();
  grant(sim, { taler: 999 });
  sim.issue({ type: 'gift', to: BRIGANDS });
  sim.issue({ type: 'truce', to: 'p2' });
  sim.run(40);
  ensureMarket(sim.world).stone = 1.4;
  const json = serializeWorld(sim.world);
  const sim2 = newSim();
  sim2.replaceWorld(deserializeWorld(json).world);
  assert.equal(relation(sim2.world, 'p1', BRIGANDS), relation(sim.world, 'p1', BRIGANDS));
  assert.equal(stance(sim2.world, 'p1', 'p2'), 'truce');
  assert.equal(sim2.world.market.stone, 1.4);
  assert.equal(all(sim2.world, 'building').filter((b) => b.owner === BRIGANDS).length, 3, 'no second camp after loading');
});
