// The KayKit cast: every unit style wears parts that exist in the baked figure data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { costume, TOOL, STYLES } from '../../src/units/cast.js';
import { UNITS } from '../../src/units/defs.js';
import { buildParts } from '../../src/units/figures.js';

const meta = JSON.parse(fs.readFileSync(new URL('../../public/figures/kaykit.json', import.meta.url), 'utf8'));
const own = buildParts();
const has = (name) => !!meta.parts[name] || !!own[name];

test('every unit type and every settler look is fully dressed from the baked parts', () => {
  for (const type of Object.keys(UNITS)) {
    if (UNITS[type].engine) continue; // siege engines are machines, not figures
    assert.ok(STYLES.includes(type), `${type} has a costume`);
    const c = costume(type);
    for (const p of ['Body', 'ArmLeft', 'ArmRight', 'LegLeft', 'LegRight']) assert.ok(meta.parts[`${c.body}_${p}`], `${type}: body ${c.body}_${p}`);
    assert.ok(meta.parts[c.head] && meta.parts[c.head].kind === 'skinned', `${type}: head ${c.head}`);
    for (const r of c.rigid) assert.ok(meta.parts[r], `${type}: ${r}`);
    if (c.right) assert.ok(has(c.right), `${type}: right hand ${c.right}`);
    if (c.left) assert.ok(has(c.left), `${type}: left hand ${c.left}`);
  }
  for (let i = 0; i < 20; i++) { const c = costume('settler', i); assert.ok(meta.parts[`${c.body}_Body`] && meta.parts[c.head]); }
  for (const tool of Object.values(TOOL)) assert.ok(own[tool], tool);
});

test('the baked animations cover what the game plays', () => {
  for (const clip of ['Idle', 'Unarmed_Idle', 'Walking_A', 'Running_A', 'Death_A', 'Death_B', 'Hit_A', 'Cheer', 'PickUp', 'Use_Item', '2H_Melee_Attack_Chop', '1H_Melee_Attack_Stab', '2H_Ranged_Shoot', 'Throw']) {
    const c = meta.clips[clip];
    assert.ok(c && c.frames > 0, clip);
  }
  assert.ok(meta.clips.Walking_A.stride > 0.5 && meta.clips.Running_A.stride > meta.clips.Walking_A.stride);
  assert.ok(meta.bones.includes('hand.r') && meta.attach.includes('handslot.r'));
  const size = fs.statSync(new URL('../../public/figures/kaykit.bin', import.meta.url)).size;
  assert.ok(size < 4 * 1024 * 1024, `figure data ${Math.round(size / 1024)} KB`);
});
