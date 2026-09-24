#!/usr/bin/env node
// Scans tracked files for likely secrets (keys, tokens, private keys, passwords).
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const PATTERNS = [
  [/-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/, 'private key'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/sk-(ant-|proj-)?[A-Za-z0-9_-]{20,}/, 'API secret key'],
  [/ghp_[A-Za-z0-9]{36}/, 'GitHub token'],
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, 'JWT / tunnel token'],
  [/(password|passwd|secret|api[_-]?key)\s*[:=]\s*['"][^'"\s]{8,}['"]/i, 'hard-coded credential'],
];
const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter((f) => f && !f.endsWith('.png') && !f.startsWith('node_modules'));
const hits = [];
for (const f of files) {
  let text;
  try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
  for (const [re, what] of PATTERNS) if (re.test(text) && f !== 'scripts/verification/secret-scan.mjs') hits.push(`${f}: ${what}`);
}
console.log(`scanned ${files.length} tracked files, findings: ${hits.length}`);
hits.forEach((h) => console.log('  ' + h));
process.exit(hits.length ? 1 : 0);
