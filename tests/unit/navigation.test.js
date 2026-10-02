import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNavGrid } from '../../src/navigation/nav-grid.js';
import { createTerrainData } from '../../src/world/terrain-data.js';
import { HARROWMERE_MAP } from '../../src/world/maps/harrowmere.js';
import { WHITEHART_MAP } from '../../src/world/maps/whitehart.js';
import { formationSlots } from '../../src/navigation/index.js';

const terrain = createTerrainData(HARROWMERE_MAP);

function pathLength(start, pts) {
  let len = 0, x = start[0], z = start[1];
  for (const [px, pz] of pts) { len += Math.hypot(px - x, pz - z); x = px; z = pz; }
  return len;
}

test('path around a blocked obstacle never crosses it', () => {
  const nav = createNavGrid(terrain);
  nav.block(-30, 40, 8); // big round obstacle
  const r = nav.findPath(-45, 40, -15, 40);
  assert.ok(r && !r.partial);
  let x = -45, z = 40;
  for (const [px, pz] of r.points) {
    assert.ok(nav.lineWalkable(x, z, px, pz), 'segment is walkable');
    x = px; z = pz;
  }
  assert.ok(pathLength([-45, 40], r.points) > 30, 'detour is longer than the straight line');
  nav.unblock(-30, 40, 8);
  const r2 = nav.findPath(-45, 40, -15, 40);
  assert.ok(pathLength([-45, 40], r2.points) < 31);
});

test('river is only crossable at the fords', () => {
  const nav = createNavGrid(terrain);
  assert.equal(nav.walkable(-18, -12), false, 'deep river channel is blocked');
  assert.equal(nav.walkable(22, -4), true, 'Tollford is walkable');
  const r = nav.findPath(-40, 20, -40, -50);
  assert.ok(r && !r.partial, 'a route across the valley exists');
  const crossesFord = r.points.some(([x, z]) => Math.hypot(x - 22, z + 4) < 16 || Math.hypot(x + 100, z + 20) < 14);
  assert.ok(crossesFord, 'route uses a ford');
});

test('unreachable targets return partial paths within the expansion budget', () => {
  const nav = createNavGrid(terrain, { maxExpansions: 500 });
  const r = nav.findPath(-45, 40, 90, -90);
  assert.ok(r);
  assert.equal(r.partial, true);
  // one direct search, then at most one retry through a ford (two more searches)
  assert.ok(nav.stats.expansions <= 3 * 520, `bounded (${nav.stats.expansions})`);
});

test('a search that runs out of budget at a river is retried through a ford', () => {
  const nav = createNavGrid(createTerrainData(WHITEHART_MAP), { maxExpansions: 1500 });
  // from the western camp to the chapterhouse: too far for one budget-limited search
  const r = nav.findPath(-100, 30, 119, -32);
  assert.ok(r && !r.partial, 'the route reaches the far bank');
  assert.equal(nav.stats.partial, 1, 'the direct search alone came up short');
  const end = r.points[r.points.length - 1];
  assert.ok(Math.hypot(end[0] - 119, end[1] + 32) < 3);
  assert.ok(nav.stats.expansions <= 3 * 1500 + 20, 'still bounded');
});

test('formation slots are distinct and centred on the target', () => {
  const slots = formationSlots(9, 0, 0, -10, 0);
  assert.equal(slots.length, 9);
  const keys = new Set(slots.map(([x, z]) => `${x.toFixed(2)},${z.toFixed(2)}`));
  assert.equal(keys.size, 9);
  const front = slots.slice(0, 3);
  assert.ok(front.every(([x]) => Math.abs(x) < 0.01), 'first row at the target line');
});

test('formations: a line is one wide rank, a wedge has a tip, a ring keeps archers inside', () => {
  const distinct = (slots) => new Set(slots.map(([x, z]) => `${x.toFixed(2)},${z.toFixed(2)}`)).size;
  // marching east (+x): ranks run north-south (z)
  const line = formationSlots(8, 0, 0, -10, 0, 1.9, 'line');
  assert.equal(distinct(line), 8);
  assert.ok(line.every(([x]) => Math.abs(x) < 0.01), 'everyone in the front rank');
  const wedge = formationSlots(6, 0, 0, -10, 0, 1.9, 'wedge');
  assert.equal(distinct(wedge), 6);
  assert.ok(wedge.slice(1).every(([x]) => x < wedge[0][0] - 0.5), 'the first stands ahead of all others');
  const ring = formationSlots(10, 0, 0, -10, 0, 1.9, 'ring', 3);
  assert.equal(distinct(ring), 10);
  const r = (p) => Math.hypot(p[0], p[1]);
  assert.ok(Math.max(...ring.slice(7).map(r)) < Math.min(...ring.slice(0, 7).map(r)), 'the last three stand inside the ring');
  // re-forming in place: target and origin coincide, the shape still spreads out
  assert.equal(distinct(formationSlots(6, 5, 5, 5, 5, 1.9, 'block')), 6);
});
