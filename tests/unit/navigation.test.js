import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNavGrid } from '../../src/navigation/nav-grid.js';
import { createTerrainData } from '../../src/world/terrain-data.js';
import { HARROWMERE_MAP } from '../../src/world/maps/harrowmere.js';
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
  assert.ok(nav.stats.expansions <= 520);
});

test('formation slots are distinct and centred on the target', () => {
  const slots = formationSlots(9, 0, 0, -10, 0);
  assert.equal(slots.length, 9);
  const keys = new Set(slots.map(([x, z]) => `${x.toFixed(2)},${z.toFixed(2)}`));
  assert.equal(keys.size, 9);
  const front = slots.slice(0, 3);
  assert.ok(front.every(([x]) => Math.abs(x) < 0.01), 'first row at the target line');
});
