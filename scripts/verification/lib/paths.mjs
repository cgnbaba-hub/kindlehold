// Path helpers that keep tooling output inside the repository.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const SAFE = /^[a-z0-9][a-z0-9._-]{0,80}$/i;

export function safeName(name) {
  if (!SAFE.test(name) || name.includes('..')) throw new Error(`unsafe name: ${JSON.stringify(name)}`);
  return name;
}

/** Resolve a path under ROOT; throws if it escapes the repository. */
export function inRepo(...parts) {
  const p = path.resolve(ROOT, ...parts);
  if (p !== ROOT && !p.startsWith(ROOT + path.sep)) throw new Error(`path escapes repository: ${p}`);
  return p;
}

export function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); return p; }

export function runId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}
