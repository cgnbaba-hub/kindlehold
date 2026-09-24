#!/usr/bin/env node
// Performance measurement for the reference scenario (PERFORMANCE_BUDGET.md).
//  1. Node: simulation cost per tick in the raid reference state (real measurement).
//  2. Browser (headless Chromium, SwiftShader): draw calls, triangles, textures, geometries,
//     JS heap, frame times. GPU-dependent FPS is informational on this machine (no GPU).
// Exits non-zero when a GPU-independent budget fails.
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { inRepo, ensureDir, runId } from './lib/paths.mjs';
import { ensureServer } from './lib/server.mjs';
import { launch, instrument, waitReady, sampleFps } from './lib/browser.mjs';
import { createSimulation } from '../../src/app/simulation.js';
import { applyDemoState } from '../../src/demo/states.js';
import { log } from '../../src/core/logger.js';

log.setConsoleLevel('error');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? 'true'] : [a, 'true']; }));
const BUDGET = { simMeanMs: 4, simP95Ms: 8, drawCalls: 1500, triangles: 1_500_000, textures: 96, geometries: 400, heapMB: 250, readyMs: 15000 };
const run = `perf-${runId()}`;
const reportDir = ensureDir(inRepo('docs', 'reports', run));

// ---- 1. simulation cost ------------------------------------------------------------
const sim = createSimulation({ seed: 1337 });
applyDemoState(sim, 'raid');
const entities = Object.keys(sim.world.entities).length;
const times = [];
for (let i = 0; i < 1200; i++) { const t0 = performance.now(); sim.step(); times.push(performance.now() - t0); }
times.sort((a, b) => a - b);
const simReport = {
  entities, ticks: times.length,
  meanMs: times.reduce((a, b) => a + b, 0) / times.length,
  p95Ms: times[Math.floor(times.length * 0.95)], maxMs: times[times.length - 1],
  pathRequests: sim.services.nav.grid().stats.requests,
};
console.log(`sim: ${entities} entities, mean ${simReport.meanMs.toFixed(3)} ms/tick, p95 ${simReport.p95Ms.toFixed(3)} ms, max ${simReport.maxMs.toFixed(2)} ms`);

// ---- 2. browser ------------------------------------------------------------------------
let browserReport = null;
if (!args.simonly) {
  const server = await ensureServer(args.url || 'http://127.0.0.1:5181/', { command: ['npx', 'vite', 'preview', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], build: !args.nobuild });
  const browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    const diag = instrument(page);
    const t0 = Date.now();
    await page.goto(new URL('?verify=1&seed=1337&demo=raid&quality=high', server.url).toString(), { waitUntil: 'load' });
    await waitReady(page, 180000);
    const readyMs = Date.now() - t0;
    await page.evaluate(() => { const g = window.__GAME__; g.setCameraPreset('raid'); g.setTimeOfDay(11); });
    const fps = await sampleFps(page, Number(args.seconds || 8) * 1000);
    const snap = await page.evaluate(() => {
      const g = window.__GAME__;
      const st = g.getStats();
      const mem = performance.memory ? { usedMB: performance.memory.usedJSHeapSize / 1048576, totalMB: performance.memory.totalJSHeapSize / 1048576 } : null;
      return { stats: st, mem, health: g.getHealth(), particles: g.session.effects.particleCount(), listeners: g.session.sim.bus.totalListeners() };
    });
    // heap growth over a further sampling window
    await page.waitForTimeout(Number(args.growth || 10) * 1000);
    const mem2 = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null));
    browserReport = { readyMs, fps, ...snap, heapAfterMB: mem2, diagnostics: diag };
    console.log(`browser: ready ${readyMs} ms, fps ${fps.fps.toFixed(1)} (SwiftShader), draws ${snap.stats.renderer.drawCalls}, tris ${snap.stats.renderer.triangles}, textures ${snap.stats.renderer.textures}, geometries ${snap.stats.renderer.geometries}, heap ${snap.mem ? snap.mem.usedMB.toFixed(0) : '?'}→${mem2 ? mem2.toFixed(0) : '?'} MB, particles ${snap.particles}, listeners ${snap.listeners}`);
    await context.close();
  } finally {
    await browser.close();
    await server.stop();
  }
}

const r = browserReport && browserReport.stats.renderer;
const gates = {
  simMean: simReport.meanMs <= BUDGET.simMeanMs,
  simP95: simReport.p95Ms <= BUDGET.simP95Ms,
  ...(r ? {
    drawCalls: r.drawCalls <= BUDGET.drawCalls,
    triangles: r.triangles <= BUDGET.triangles,
    textures: r.textures <= BUDGET.textures,
    geometries: r.geometries <= BUDGET.geometries,
    heap: !browserReport.mem || browserReport.mem.usedMB <= BUDGET.heapMB,
    noErrors: browserReport.diagnostics.pageErrors.length === 0 && browserReport.diagnostics.consoleErrors.length === 0,
  } : {}),
};
const report = {
  run, at: new Date().toISOString(), budget: BUDGET, sim: simReport, browser: browserReport, gates,
  pass: Object.values(gates).every(Boolean),
  environment: { note: 'Headless Chromium with SwiftShader (CPU rendering) on a 2-vCPU VPS without GPU. FPS/frame times are NOT representative of GPU hardware and are informational only.' },
};
fs.writeFileSync(path.join(reportDir, 'perf.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(inRepo('docs', 'reports', 'latest-perf.json'), JSON.stringify(report, null, 2));
console.log(`${report.pass ? 'PERF PASSED' : 'PERF FAILED'} ${JSON.stringify(gates)} — docs/reports/${run}/perf.json`);
process.exit(report.pass ? 0 : 1);
