// Figure poses: natural gait, cross-fades, weapon-specific attacks, and the triangle budget.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePose, lerpPose, neutralPose, weaponClass, POSE_KEYS } from '../../src/units/poses.js';
import { buildParts } from '../../src/units/figures.js';

test('walking swings each arm against the leg on its own side', () => {
  for (const ph of [0.5, 1.2, 2.0, 4.0, 5.2]) {
    const P = computePose('walk', { walkPh: ph }, {});
    if (Math.abs(P.legA) < 0.05) continue;
    assert.ok(Math.sign(P.armR) === -Math.sign(P.legA), `right arm opposes right leg at phase ${ph}`);
    assert.ok(Math.sign(P.armL) === Math.sign(P.legA), `left arm opposes left leg at phase ${ph}`);
  }
  // the stride follows the distance walked: the same phase gives the same pose
  assert.deepEqual(computePose('walk', { walkPh: 2, t: 0 }, {}), computePose('walk', { walkPh: 2, t: 5 }, {}));
});

test('cross-fades pass smoothly between two animations', () => {
  const a = computePose('idle', { t: 1 }, {}), b = computePose('carryIdle', { t: 1 }, {});
  const mid = lerpPose(a, b, 0.5, {});
  for (const k of POSE_KEYS) assert.ok(Math.abs(mid[k] - (a[k] + b[k]) / 2) < 1e-9, k);
  assert.deepEqual(Object.keys(neutralPose()).sort(), [...POSE_KEYS].sort());
});

test('each weapon strikes in its own way', () => {
  assert.equal(weaponClass('sword', 'shieldKite'), 'slash');
  assert.equal(weaponClass('spear', 'shieldKite'), 'thrust');
  assert.equal(weaponClass('maul', null), 'heavy');
  assert.equal(weaponClass(null, 'bow'), 'bow');
  assert.equal(weaponClass('crossbow', null), 'crossbow');
  const pose = (weapon, since, until) => computePose('attack', { weapon, attack: { since, until, wind: 0.4 } }, {});
  // wind-up raises the sword, the blow brings it down and across
  assert.ok(pose('slash', 1, 0.05).armR < pose('slash', 0.02, 1).armR - 1);
  // a spear is levelled forward in the thrust, and the arm reaches out
  const thrust = pose('thrust', 0.02, 1);
  assert.ok(thrust.itemW === 1 && Math.abs(thrust.itemT - Math.PI / 2) < 0.1);
  assert.ok(thrust.armR < pose('thrust', 1, 0.05).armR);
  // heavy weapons go up over the head with both hands
  const wind = pose('heavy', 1, 0.02);
  assert.ok(wind.armR < -2.5 && wind.armL < -2.5);
});

test('a settler figure stays within its triangle budget', () => {
  const p = buildParts();
  const tris = (k) => (p[k].index ? p[k].index.count : p[k].attributes.position.count) / 3;
  const settler = 2 * tris('thigh') + 2 * tris('shin') + tris('torso') + tris('head') + tris('hairLong') + 2 * tris('arm') + 2 * tris('forearm') + 2 * tris('hand') + tris('axe');
  assert.ok(settler < 1400, `settler ${settler} triangles`);
});
