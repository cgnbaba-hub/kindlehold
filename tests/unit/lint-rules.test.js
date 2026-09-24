// Repository rules enforced as tests: no Math.random / wall clock in simulation,
// no eval/new Function anywhere, innerHTML only in allowed UI files, sim code has no three/DOM imports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}
const SRC = walk(path.join(ROOT, 'src'));
const SIM_DIRS = ['core', 'world', 'navigation', 'economy', 'population', 'construction', 'production', 'technology', 'heroes', 'combat', 'ai', 'missions', 'save'];
const SIM_FILES = [...SIM_DIRS.flatMap((d) => walk(path.join(ROOT, 'src', d))), path.join(ROOT, 'src/app/simulation.js'), ...walk(path.join(ROOT, 'src/units')).filter((f) => f.includes('sim')), ...walk(path.join(ROOT, 'src/buildings')).filter((f) => f.endsWith('defs.js'))];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('Math.random is not used anywhere in src/', () => {
  const bad = SRC.filter((f) => /Math\.random\s*\(/.test(strip(fs.readFileSync(f, 'utf8'))));
  assert.deepEqual(bad.map((f) => path.relative(ROOT, f)), []);
});

test('simulation code does not read wall-clock time or import three/DOM', () => {
  const bad = [];
  for (const f of SIM_FILES) {
    if (!fs.existsSync(f)) continue;
    const s = strip(fs.readFileSync(f, 'utf8'));
    if (/Date\.now|performance\.now|new Date\(/.test(s)) bad.push(`${path.relative(ROOT, f)}: wall clock`);
    if (/from ['"]three/.test(s)) bad.push(`${path.relative(ROOT, f)}: imports three`);
    if (/\b(document|window)\./.test(s)) bad.push(`${path.relative(ROOT, f)}: DOM access`);
  }
  assert.deepEqual(bad, []);
});

test('no eval / new Function', () => {
  const bad = SRC.filter((f) => /\beval\s*\(|new\s+Function\s*\(/.test(strip(fs.readFileSync(f, 'utf8'))));
  assert.deepEqual(bad.map((f) => path.relative(ROOT, f)), []);
});

test('innerHTML only in allowed files with static content', () => {
  const allowed = new Set(['src/ui/icons.js', 'src/ui/dom.js']);
  const bad = SRC.filter((f) => /\.innerHTML\s*=|insertAdjacentHTML/.test(strip(fs.readFileSync(f, 'utf8'))) && !allowed.has(path.relative(ROOT, f)));
  assert.deepEqual(bad.map((f) => path.relative(ROOT, f)), []);
});
