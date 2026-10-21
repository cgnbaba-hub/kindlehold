// Stone roads: laid in stretches inside the territory for stone (more on harder difficulties),
// routes follow them, everyone walks faster on them, and they survive a save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, keep, grant, byType } from '../helpers/sim.js';
import { findSpot } from '../../src/demo/bot.js';
import { ROADS, roadStone } from '../../src/transport/defs.js';
import { checkStretch } from '../../src/transport/roads.js';
import { walkTo } from '../../src/navigation/agent.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';

function lit(opts) {
  const sim = newSim(opts);
  sim.issue({ type: 'rekindle' });
  sim.step();
  grant(sim, { stone: 500, taler: 500 });
  return sim;
}

/** An open stretch beside the Keep that the territory covers. */
function openStretch(sim, len = 20) {
  const k = keep(sim);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (const off of [10, 12, 14, 16]) {
      // across the way, centred on the Keep's axis
      const ax = k.x + dx * off + dz * (len / 2), az = k.z + dz * off - dx * (len / 2);
      const bx = ax - dz * len, bz = az + dx * len;
      const chk = checkStretch(sim.world, sim.services, 'p1', ax, az, bx, bz);
      if (chk.ok) return { ax, az, bx, bz, chk };
    }
  }
  throw new Error('no open stretch near the Keep');
}

test('a stretch of road costs stone (and Taler) per cell, more on harder difficulties', () => {
  assert.ok(ROADS.stone.story < ROADS.stone.normal && ROADS.stone.normal < ROADS.stone.hard);
  assert.ok(ROADS.taler.story <= ROADS.taler.normal && ROADS.taler.normal <= ROADS.taler.hard);
  for (const difficulty of ['story', 'normal', 'hard']) {
    const sim = lit({ difficulty });
    const s = openStretch(sim);
    const stone0 = sim.world.players.p1.res.stone, taler0 = sim.world.players.p1.res.taler;
    sim.issue({ type: 'buildRoad', ...s, chk: undefined });
    sim.step();
    const cells = sim.world.roads.cells.length;
    assert.ok(cells >= 10, `${difficulty}: the stretch is laid (${cells} cells)`);
    assert.equal(stone0 - sim.world.players.p1.res.stone, cells * roadStone(sim.world), `${difficulty}: stone per cell`);
    assert.equal(taler0 - sim.world.players.p1.res.taler, cells * ROADS.taler[difficulty], `${difficulty}: Taler per cell`);
    const [x, z] = sim.services.nav.grid().cellCentre(sim.world.roads.cells[3]);
    assert.ok(sim.services.nav.grid().isRoad(x, z));
  }
});

test('roads stay inside the territory and off blocked ground, and need the stone', () => {
  const sim = lit();
  const k = keep(sim);
  const far = checkStretch(sim.world, sim.services, 'p1', k.x + 90, k.z, k.x + 100, k.z);
  assert.equal(far.ok, false);
  const s = openStretch(sim);
  sim.world.players.p1.res.stone = 3;
  assert.match(checkStretch(sim.world, sim.services, 'p1', s.ax, s.az, s.bx, s.bz).reason, /Needs \d+ stone/);
  const tooLong = checkStretch(sim.world, sim.services, 'p1', k.x - 60, k.z, k.x + 60, k.z);
  assert.equal(tooLong.ok, false);
  sim.issue({ type: 'buildRoad', ax: s.ax, az: s.az, bx: s.bx, bz: s.bz });
  sim.step();
  assert.ok(!sim.world.roads || !sim.world.roads.cells.length, 'nothing laid without the stone');
});

test('settlers walk faster on a road, and routes keep to it', () => {
  const sim = lit();
  const s = openStretch(sim, 40);
  const nav = sim.services.nav;
  const walker = (x, z) => ({ id: 9999, kind: 'settler', x, z });
  const time = () => {
    const e = walker(s.ax, s.az);
    let t = 0;
    while (t < 400 && walkTo(nav, e, s.bx, s.bz, 3.9, 0.05, 0.6) !== 'arrived') { t++; nav.update(); }
    return t;
  };
  const before = time();
  sim.issue({ type: 'buildRoad', ax: s.ax, az: s.az, bx: s.bx, bz: s.bz });
  sim.step();
  const after = time();
  assert.ok(after < before * 0.75, `faster on the road: ${before} → ${after} ticks`);
  // a route from beside the road's start to beside its end joins the road
  const grid = nav.grid();
  const dx = s.bx - s.ax, dz = s.bz - s.az, len = Math.hypot(dx, dz);
  const ox = (-dz / len) * 6, oz = (dx / len) * 6;
  const r = grid.findPath(s.ax + ox, s.az + oz, s.bx + ox, s.bz + oz);
  assert.ok(r && r.points.length >= 2);
  let onRoad = 0, steps = 0;
  let [px, pz] = [s.ax + ox, s.az + oz];
  for (const [qx, qz] of r.points) {
    const d = Math.hypot(qx - px, qz - pz), n = Math.ceil(d / 0.5);
    for (let i = 1; i <= n; i++) { steps++; if (grid.isRoad(px + ((qx - px) * i) / n, pz + ((qz - pz) * i) / n)) onRoad++; }
    px = qx; pz = qz;
  }
  assert.ok(onRoad / steps > 0.5, `most of the route is on the road (${Math.round((100 * onRoad) / steps)}%)`);
});

test('a building on a road takes its cells; lifting a road refunds nothing', () => {
  const sim = lit();
  grant(sim, { timber: 500 });
  const k = keep(sim);
  const spot = findSpot(sim.world, sim.services, 'cottage', k.x + 14, k.z);
  const s = { ax: spot.x, az: spot.z - 10, bx: spot.x, bz: spot.z + 10 };
  sim.issue({ type: 'buildRoad', ...s });
  sim.step();
  const n0 = sim.world.roads.cells.length;
  assert.ok(n0 >= 8, 'the road is laid');
  sim.issue({ type: 'place', buildingType: 'cottage', x: spot.x, z: spot.z });
  sim.step();
  assert.ok(byType(sim, 'cottage').length === 1, 'the cottage may stand on a road');
  assert.ok(sim.world.roads.cells.length < n0, 'the cottage takes the road cells under it');
  const grid = sim.services.nav.grid();
  assert.ok(sim.world.roads.cells.every((c) => grid.roadable(c)));
  const stone = sim.world.players.p1.res.stone;
  sim.issue({ type: 'removeRoad', ...s });
  sim.step();
  assert.equal(sim.world.roads.cells.length, 0);
  assert.equal(sim.world.players.p1.res.stone, stone);
});

test('roads survive a save and the game continues identically', () => {
  const a = lit();
  const s = openStretch(a, 30);
  a.issue({ type: 'buildRoad', ax: s.ax, az: s.az, bx: s.bx, bz: s.bz });
  for (let i = 0; i < 20 * 20; i++) a.step();
  const { world } = deserializeWorld(serializeWorld(a.world, 'roads'));
  const b = newSim();
  b.replaceWorld(world);
  const [x, z] = b.services.nav.grid().cellCentre(world.roads.cells[2]);
  assert.ok(b.services.nav.grid().isRoad(x, z), 'the loaded grid knows the road');
  assert.equal(b.hash(), a.hash());
  for (let i = 0; i < 20 * 30; i++) { a.step(); b.step(); }
  assert.equal(b.hash(), a.hash(), 'identical 30 s later');
});
