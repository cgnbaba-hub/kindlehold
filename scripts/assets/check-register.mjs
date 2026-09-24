#!/usr/bin/env node
// Fails if any file under public/assets/ (or public/) is not listed in ASSET_REGISTER.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const register = fs.readFileSync(path.join(ROOT, 'ASSET_REGISTER.md'), 'utf8');
function walk(d) {
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const files = walk(path.join(ROOT, 'public')).filter((f) => !f.endsWith('.gitkeep'));
const missing = files.filter((f) => !register.includes(path.basename(f)));
console.log(`asset files: ${files.length}, unregistered: ${missing.length}`);
for (const m of missing) console.log(`  UNREGISTERED ${path.relative(ROOT, m)}`);
process.exit(missing.length ? 1 : 0);
