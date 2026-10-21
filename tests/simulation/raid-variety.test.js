// More varied raids: plunder parties between the great raids (Storehouses lose goods, stables a
// donkey), a flank that strikes a second target from the side, and dusk raids on Hard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, place, grant } from '../helpers/sim.js';
import { RAID_VARIETY, aiSettings, spawnEnemy, warhallOf, ticksUntilHour } from '../../src/ai/index.js';
import { completeBuilding } from '../../src/construction/index.js';
import { all } from '../../src/world/world.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';

function armed(sim, n) {
  const hall = warhallOf(sim.world);
  const types = ['brute', 'reaver', 'slinger'];
  for (let i = 0; i < n; i++) {
    const u = spawnEnemy(sim.world, types[i % 3], hall.x + (i % 5) * 1.5 - 3, hall.z + 10 + Math.floor(i / 5) * 1.5);
    u.order = { type: 'guard', ax: u.x, az: u.z, leash: 28 };
  }
}

test('Story keeps the plain raids; Normal and Hard vary them', () => {
  assert.equal(RAID_VARIETY.story.flankFrom, null);
  assert.equal(RAID_VARIETY.story.laterHarass, null);
  assert.ok(RAID_VARIETY.hard.flankFrom < RAID_VARIETY.normal.flankFrom);
  assert.ok(RAID_VARIETY.hard.plunder > RAID_VARIETY.normal.plunder);
});

test('plunderers between raids carry goods off from a Storehouse', () => {
  const sim = newSim({ difficulty: 'hard' });
  sim.issue({ type: 'rekindle' });
  grant(sim, { timber: 500, stone: 500, provisions: 900 });
  sim.step();
  const k = keep(sim), hall = warhallOf(sim.world);
  // a Storehouse towards the fort, nothing else to plunder
  const dx = hall.x - k.x, dz = hall.z - k.z, len = Math.hypot(dx, dz);
  const st = place(sim, 'storehouse', k.x + (dx / len) * 18, k.z + (dz / len) * 18);
  completeBuilding(sim.world, st);
  for (const b of all(sim.world, 'building')) if (b.owner === 'p1' && b.type !== 'keep' && b.type !== 'storehouse') b.owner = 'none';
  armed(sim, 24);
  const ai = sim.world.ai;
  ai.wave = 1; ai.state = 'build'; ai.raidTick = sim.world.tick + 20 * 600; ai.nextHarassTick = sim.world.tick + 1;
  const before = sim.world.players.p1.res.provisions;
  let plundered = null;
  sim.bus.on('ai:plunder', (e) => { plundered = e; });
  for (let i = 0; i < 20 * 90 && !plundered; i++) sim.step();
  assert.ok(plundered, 'the party reached the Storehouse');
  assert.equal(plundered.res, 'provisions');
  assert.ok(before - sim.world.players.p1.res.provisions >= RAID_VARIETY.hard.plunder - 5, 'goods are gone');
});

test('from the set wave on, a flank strikes a second target from the side', () => {
  const sim = newSim({ difficulty: 'hard' });
  sim.issue({ type: 'rekindle' });
  sim.world.players.p1.techs.charter = true;
  grant(sim, { timber: 900, stone: 900 });
  sim.step();
  const k = keep(sim);
  place(sim, 'lodge', k.x - 20, k.z + 8);
  place(sim, 'farm', k.x + 22, k.z + 10);
  for (const b of all(sim.world, 'building')) if (b.state === 'site') completeBuilding(sim.world, b);
  sim.world.mission.raidWarningTick = 1;
  for (let i = 0; i < 5; i++) sim.step();
  const ai = sim.world.ai;
  ai.wave = RAID_VARIETY.hard.flankFrom;
  armed(sim, aiSettings(sim.world).firstRaid + ai.wave * aiSettings(sim.world).growth);
  ai.raidTick = sim.world.tick + 1;
  for (let i = 0; i < 20 * 25 && ai.state !== 'raid'; i++) sim.step();
  assert.equal(ai.state, 'raid');
  assert.ok(ai.flankIds.length >= 2, 'a flank broke away');
  assert.notEqual(ai.flankTarget, ai.raidTarget);
  const t1 = sim.world.entities[ai.raidTarget], t2 = sim.world.entities[ai.flankTarget];
  assert.ok(Math.hypot(t1.x - t2.x, t1.z - t2.z) >= 25, 'two targets apart');
  assert.ok(ai.flankIds.every((id) => !ai.raidIds.includes(id)));
  // the save keeps the flank
  const { world } = deserializeWorld(serializeWorld(sim.world, 'flank'));
  assert.deepEqual(world.ai.flankIds, ai.flankIds);
  // the flank swings round and then strikes
  for (let i = 0; i < 20 * 60 && ai.flankStage === 'swing'; i++) sim.step();
  assert.equal(ai.flankStage, 'strike');
});

test('dusk is found on the clock, and Hard plans some raids for it', () => {
  const sim = newSim({ difficulty: 'hard' });
  sim.world.time.hour = 12;
  const D = sim.world.time.dayLengthTicks;
  // eight daylight hours, then 0.2 dark hours at six times the pace
  const t = ticksUntilHour(sim.world, 20.2);
  assert.ok(Math.abs(t - ((8 / 24) * D + (0.2 / 24) * D / 6)) <= 40, `${t} ticks`);
  sim.world.time.hour = 23;
  const t2 = ticksUntilHour(sim.world, 20.2);
  const want = ((1 / 24) * D) / 6 + (6 / 24) * D / 6 + (14 / 24) * D + (0.2 / 24) * D / 6;
  assert.ok(Math.abs(t2 - want) <= 60, `after midnight and the day: ${t2} vs ${Math.round(want)}`);
  assert.ok(RAID_VARIETY.hard.nightFrom != null && RAID_VARIETY.normal.nightFrom == null);
});
