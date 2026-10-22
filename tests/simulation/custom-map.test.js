// Custom maps from the map editor: the format keeps only what a map may hold, a game is played on
// one like on any other map, and the map travels with the save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSim, all } from '../helpers/sim.js';
import { serializeWorld, deserializeWorld } from '../../src/save/index.js';
import { blankMap, mapFrom, normalizeMap, validateMap, mapProblems, LIMITS } from '../../src/editor/map-format.js';
import { HARROWMERE_MAP } from '../../src/world/maps/harrowmere.js';
import { rawHeight } from '../../src/world/terrain-data.js';

test('a blank valley and copies of the built-in maps are valid, and normalizing twice changes nothing', () => {
  const m = blankMap();
  validateMap(m);
  assert.deepEqual(normalizeMap(m), m);
  assert.deepEqual(mapProblems(m, (x, z) => rawHeight(m, x, z)).errors, []);
  const h = mapFrom(HARROWMERE_MAP, 'My Harrowmere');
  validateMap(h);
  assert.equal(h.name, 'My Harrowmere');
  assert.equal(h.flats.length, HARROWMERE_MAP.flats.length, 'no seat flat twice');
  assert.deepEqual(normalizeMap(h), h);
});

test('untrusted maps are cut down to size; anything else fails the strict check', () => {
  const evil = normalizeMap({
    name: '<script>alert(1)</script> Vale', noiseSeed: 'x', baseHeight: 1e9,
    hills: Array.from({ length: 500 }, () => ({ x: 1e6, z: -1e6, h: NaN, r: -5 })),
    pois: [{ type: 'dragon', x: 0, z: 0 }, { type: 'ruin', x: 0, z: 0, reward: { taler: 1e9 } }],
    river: { points: [[0, 0]] }, __proto__: { polluted: true },
  });
  validateMap(evil);
  assert.ok(!/[<>()]/.test(evil.name), `name cleaned (${evil.name})`);
  assert.equal(evil.hills.length, LIMITS.hills);
  assert.ok(evil.hills.every((hl) => Math.abs(hl.x) <= 160 && hl.r >= 8 && Number.isFinite(hl.h)));
  assert.deepEqual(evil.pois.map((p) => p.type), ['ruin']);
  assert.equal(evil.pois[0].reward.taler, 200, 'a ruin pays what every ruin pays');
  assert.ok(evil.river.points.length >= 2, 'a river is always there');
  assert.throws(() => validateMap({ ...blankMap(), extra: 1 }));
  assert.throws(() => validateMap({ ...blankMap(), hills: [{ x: 0, z: 0, h: 99, r: 20 }] }));
});

test('problems: a seat in the river or two seats side by side cannot be played', () => {
  const m = blankMap();
  const wet = normalizeMap({ ...m, playerStart: { x: 0, z: 6 } });
  const p1 = mapProblems(wet, (x, z) => rawHeight(wet, x, z));
  assert.ok(p1.errors.some((e) => /water|riverbank/.test(e)));
  const close = normalizeMap({ ...m, playerStart: { x: 40, z: -60 } });
  assert.ok(mapProblems(close, (x, z) => rawHeight(close, x, z)).errors.some((e) => /apart/.test(e)));
});

test('a game on a custom map: the seats stand where the map puts them, and the map travels with the save', () => {
  const map = blankMap('Test vale');
  const a = newSim({ scenarioId: 'free-custom', customMap: map, seed: 5 });
  const keep = all(a.world, 'building').find((b) => b.type === 'keep' && b.owner === 'p1');
  assert.ok(Math.hypot(keep.x - map.playerStart.x, keep.z - map.playerStart.z) < 1);
  assert.ok(all(a.world, 'building').some((b) => b.owner === 'p2'), 'the enemy seat stands');
  assert.equal(a.world.meta.title, 'Free Play: Test vale');
  // (bit-identical continuation is not checked: walkers mid-path ask again after a load, see
  // docs/KNOWN_ISSUES.md; the same holds on every free map)
  for (let i = 0; i < 20 * 60 * 2; i++) a.step();
  const { world } = deserializeWorld(serializeWorld(a.world, 'custom'));
  assert.deepEqual(world.meta.customMap, a.world.meta.customMap);
  // (as a load does: the simulation, and so the terrain, is built from the saved world)
  const b = newSim({ world });
  assert.equal(b.hash(), a.hash());
  for (const [x, z] of [[0, 0], [-100, 90], [100, -90], [0, 6], [-150, 150]]) assert.equal(b.terrain.height(x, z), a.terrain.height(x, z), `terrain at ${x},${z}`);
  for (let i = 0; i < 20 * 30; i++) b.step();
  assert.ok(!b.world.mission.result, 'the loaded game goes on');
});

test('a rival town can be faced on a custom map too', () => {
  const sim = newSim({ scenarioId: 'free-custom-rival', customMap: blankMap(), seed: 5 });
  assert.ok(all(sim.world, 'building').some((b) => b.type === 'keep' && b.owner === 'p4'));
});
