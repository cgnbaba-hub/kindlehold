#!/usr/bin/env node
// Balance over many seeds: runs scripts/balance.mjs once per seed, several at a time, and prints
// wins and the mean minutes to victory per difficulty (an unfinished match counts as 40). Single
// seeds swing by ±5 minutes, so compare variants on these means, not on one run.
// Usage: node scripts/balance-seeds.mjs [difficulty | chapter:difficulty] [seed,seed,...]
//   node scripts/balance-seeds.mjs                    (chapter one: 3 Story, 8 Normal, 10 Hard seeds)
//   node scripts/balance-seeds.mjs hard
//   node scripts/balance-seeds.mjs greyfen:normal 7,42,3,11
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [filter, seedArg] = process.argv.slice(2);
const SEEDS = { story: [42, 3, 11], normal: [1337, 7, 42, 99, 3, 11, 23, 5], hard: [7, 42, 99, 3, 11, 23, 5, 1337, 64, 2] };
const [chapter, only] = filter && filter.includes(':') ? filter.split(':') : ['harrowmere', filter];
const runs = [];
for (const d of Object.keys(SEEDS)) {
  if (only && d !== only) continue;
  for (const s of seedArg ? seedArg.split(',') : SEEDS[d]) runs.push([d, s]);
}
const par = Math.max(1, availableParallelism());
const results = [];
let next = 0;
async function worker() {
  while (next < runs.length) {
    const [d, s] = runs[next++];
    const line = await new Promise((ok) => {
      const p = spawn(process.execPath, ['scripts/balance.mjs', `${chapter}:${d}:${s}`], { cwd: repo });
      let out = '';
      p.stdout.on('data', (b) => { out += b; });
      p.on('close', () => ok(out.split('\n')[0] || ''));
    });
    const m = line.match(/(victory|unfinished|defeat)\s+([\d.]+) min/);
    results.push({ d, s, res: m ? m[1] : '?', min: m && m[1] === 'victory' ? Number(m[2]) : 40 });
  }
}
await Promise.all(Array.from({ length: par }, worker));
for (const d of Object.keys(SEEDS)) {
  const a = results.filter((r) => r.d === d).sort((x, y) => Number(x.s) - Number(y.s));
  if (!a.length) continue;
  const wins = a.filter((r) => r.res === 'victory').length;
  const mean = a.reduce((t, r) => t + r.min, 0) / a.length;
  console.log(`${chapter} ${d.padEnd(6)} won ${wins}/${a.length}  mean ${mean.toFixed(1)} min  ` + a.map((r) => `${r.s}:${r.res === 'victory' ? r.min : r.res[0]}`).join(' '));
}
