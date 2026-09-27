#!/usr/bin/env node
// Soak test: the scripted bot plays a real, rendered game with the HUD for N game minutes.
// Every game minute it records GPU resources, DOM size, JS heap, frame and HUD timings, so
// slow leaks (geometries, textures, DOM nodes, listeners) show up as growing numbers.
// Usage: npm run test:soak -- [--minutes=16] [--speed=4] [--nobuild]
import fs from 'node:fs';
import path from 'node:path';
import { launch, instrument } from './lib/browser.mjs';
import { ensureServer } from './lib/server.mjs';
import { inRepo } from './lib/paths.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? 'true'] : [a, 'true']; }));
const MINUTES = Number(args.minutes || 16);
const server = await ensureServer('http://127.0.0.1:5182/', { command: ['npx', 'vite', 'preview', '--host', '127.0.0.1', '--port', '5182', '--strictPort'], build: !args.nobuild });
const browser = await launch();
const rows = [];
let diag = null;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  diag = instrument(page);
  await page.goto(new URL(`?debug=1&start=1&quality=${args.quality || 'high'}`, server.url).toString(), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 120000 });
  await page.evaluate(() => { const g = window.__GAME__; g.autoplay(); g.setCameraPreset('settlement'); });
  for (let m = 1; m <= MINUTES; m++) {
    const row = await page.evaluate(async () => {
      const g = window.__GAME__;
      const frames = [];
      let hudMs = 0;
      // one game minute: 12 x (5 s of simulation, then two real frames incl. HUD update)
      for (let i = 0; i < 12; i++) {
        g.runTicks(100);
        const t0 = performance.now();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        frames.push(performance.now() - t0);
      }
      const s = g.getStats();
      const w = g.world();
      const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
      return {
        tick: w.tick, frameMs: Math.round(frames.reduce((a, b) => a + b, 0) / frames.length), frameMax: Math.round(Math.max(...frames)),
        geometries: s.renderer.geometries, textures: s.renderer.textures, programs: s.renderer.programs, drawCalls: s.renderer.drawCalls, triangles: s.renderer.triangles,
        dom: document.getElementsByTagName('*').length, heapMB: mem, hudMs,
        entities: Object.keys(w.entities).length, pop: w.players.p1.pop, ai: w.ai.state,
      };
    });
    row.minute = m;
    rows.push(row);
    console.log(`min ${String(m).padStart(2)} frame ${row.frameMs}ms (max ${row.frameMax}) geo ${row.geometries} tex ${row.textures} prog ${row.programs} draws ${row.drawCalls} tris ${row.triangles} dom ${row.dom} heap ${row.heapMB}MB ents ${row.entities} pop ${row.pop} ai ${row.ai}`);
  }
} finally {
  await browser.close();
  await server.stop();
}
const out = inRepo('docs', 'reports', 'latest-soak.json');
fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), minutes: MINUTES, rows, errors: diag && [...diag.pageErrors, ...diag.consoleErrors] }, null, 2));
const first = rows[1] || rows[0], last = rows[rows.length - 1];
const grew = (k, tol) => last[k] - first[k] > tol;
const problems = [];
if (grew('geometries', 60)) problems.push(`geometries grew ${first.geometries} -> ${last.geometries}`);
if (grew('textures', 10)) problems.push(`textures grew ${first.textures} -> ${last.textures}`);
if (grew('programs', 12)) problems.push(`shader programs grew ${first.programs} -> ${last.programs}`);
if (grew('dom', 1500)) problems.push(`DOM grew ${first.dom} -> ${last.dom}`);
if (diag && diag.pageErrors.length) problems.push(`${diag.pageErrors.length} page errors: ${diag.pageErrors[0].slice(0, 200)}`);
console.log(problems.length ? `SOAK FAILED\n- ${problems.join('\n- ')}` : 'SOAK OK');
console.log(`report: ${path.relative(inRepo(), out)}`);
process.exit(problems.length ? 1 : 0);
