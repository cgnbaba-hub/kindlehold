// The Quaternius animals: the baked data holds every clip the wildlife view plays, and every
// buffer the view reads lies inside the file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const meta = JSON.parse(fs.readFileSync(new URL('../../public/animals/quaternius.json', import.meta.url), 'utf8'));
const size = fs.statSync(new URL('../../public/animals/quaternius.bin', import.meta.url)).size;

test('deer and stag carry every clip the wildlife view plays, inside the file', () => {
  for (const name of ['deer', 'stag']) {
    const sp = meta.species[name];
    assert.ok(sp && sp.bones > 0 && sp.bones <= 64, `${name} bones`);
    const n = sp.vertexCount;
    for (const [key, bytes] of [['position', n * 12], ['normal', n * 12], ['color', n * 3], ['joints', n * 4], ['weights', n * 4], ['index', sp.indexCount * (sp.index32 ? 4 : 2)]]) {
      assert.ok(sp[key] >= 0 && sp[key] + bytes <= size, `${name}.${key}`);
    }
    for (const clip of ['Walk', 'Gallop', 'Idle', 'Idle_2', 'Eating', 'Idle_Headlow']) {
      const c = sp.clips[clip];
      assert.ok(c && c.frames > 1, `${name}: ${clip}`);
      assert.ok(c.offset % 4 === 0 && c.offset + c.frames * sp.bones * 48 <= size, `${name}: ${clip} data`);
    }
  }
  assert.ok(meta.fps > 0);
  assert.ok(size < 3 * 1024 * 1024, `animal data ${Math.round(size / 1024)} KB`);
});
