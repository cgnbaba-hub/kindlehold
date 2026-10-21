// Every building the player can raise is in exactly one tab of the build menu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILD_TABS, buildTabOf } from '../../src/ui/build-tabs.js';
import { PLAYER_BUILD_ORDER } from '../../src/buildings/defs.js';

test('the build tabs hold every player building once', () => {
  const listed = BUILD_TABS.flatMap((t) => t.types).filter((t) => t !== 'road');
  assert.deepEqual([...listed].sort(), [...PLAYER_BUILD_ORDER].sort());
  assert.equal(new Set(listed).size, listed.length);
  assert.equal(buildTabOf('lodge'), 'goods');
  assert.equal(buildTabOf('road'), 'town');
  assert.ok(BUILD_TABS.every((t) => t.types.length <= 7), 'a tab fits the panel');
});
