#!/usr/bin/env node
// Visual verification loop: screenshots + JSON reports per preset; non-zero exit on gate failure.
// Usage: node scripts/verification/verify.mjs [--url=http://127.0.0.1:5180/] [--presets=a,b] [--run=name] [--seed=1337] [--quality=high]
import fs from 'node:fs';
import path from 'node:path';
import { PRESETS, DEFAULT_VIEWPORT } from './presets.mjs';
import { inRepo, ensureDir, safeName, runId } from './lib/paths.mjs';
import { ensureServer } from './lib/server.mjs';
import { launch, instrument, waitReady, sampleFps } from './lib/browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
}));

const BUDGET = { drawCalls: 1500, triangles: 1_500_000, minVariance: 25 };
const run = safeName(args.run || runId());
const seed = safeName(args.seed || '1337');
const quality = safeName(args.quality || 'high');
const wanted = args.presets ? args.presets.split(',').map((s) => safeName(s.trim())) : null;
const presets = wanted ? PRESETS.filter((p) => wanted.includes(p.name)) : PRESETS;
if (wanted && presets.length !== wanted.length) {
  console.error(`unknown preset(s): ${wanted.filter((w) => !PRESETS.some((p) => p.name === w)).join(', ')}`);
  process.exit(2);
}

const shotDir = ensureDir(inRepo('docs', 'screenshots', run));
const reportDir = ensureDir(inRepo('docs', 'reports', run));

// --prod: verify the production build via `vite preview` (no HMR reloads while files change)
const server = args.prod
  ? await ensureServer(args.url || 'http://127.0.0.1:5181/', { command: ['npx', 'vite', 'preview', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], build: true })
  : await ensureServer(args.url || 'http://127.0.0.1:5180/');
const browser = await launch();
const results = [];
let failed = false;

try {
  for (const preset of presets) {
    const vp = preset.viewport || DEFAULT_VIEWPORT;
    const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const diag = instrument(page);
    const q = new URLSearchParams({ verify: '1', seed, quality, demo: preset.demo || '', ui: preset.ui ? '1' : '0' });
    const url = new URL(`?${q}`, server.url).toString();
    const report = { preset: preset.name, url, run, viewport: vp, seed, quality, startedAt: new Date().toISOString(), gates: {}, pass: false };
    const t0 = Date.now();
    const phase = {};
    const mark = (k) => { phase[k] = Date.now() - t0; };
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await waitReady(page, 120000);
      report.readyMs = Date.now() - t0; mark('ready');
      report.setup = await page.evaluate(async (p) => {
        const g = window.__GAME__;
        g.setCameraPreset(p.camera);
        g.setTimeOfDay(p.hour);
        const sim = g.runTicks(p.ticks || 0);
        g.setTimeOfDay(p.hour);
        g.setCameraPreset(p.camera);
        return { sim, hash: g.getWorldHash() };
      }, preset);
      mark('setup');
      // let the renderer settle for a few frames (interpolation, particles)
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
      mark('settled');
      report.fps = args.nofps ? null : await sampleFps(page, preset.perf ? 5000 : 2000);
      mark('fps');
      if (preset.action) await page.evaluate((a) => { window.__PRESET_ACTION__ = a; }, preset.action);
      // freeze the loop and render exactly one frame for a deterministic, fast screenshot
      const snap = await page.evaluate(() => {
        const g = window.__GAME__;
        g.freeze(true);
        if (window.__PRESET_ACTION__) g.action(window.__PRESET_ACTION__);
        g.setCameraPreset(g.session.lastPreset || 'settlement');
        g.renderNow();
        const frame = g.sampleFrame();
        g.renderNow();
        return { stats: g.getStats(), health: g.getHealth(), frame };
      });
      Object.assign(report, snap);
      mark('snapshot');
      const shot = path.join(shotDir, `${preset.name}.png`);
      await page.screenshot({ path: shot, type: 'png', timeout: 120000 });
      report.screenshot = path.relative(inRepo(), shot);
      mark('screenshot');
    } catch (err) {
      report.error = String(err && (err.stack || err.message));
      try { await page.screenshot({ path: path.join(shotDir, `${preset.name}-error.png`) }); } catch { /* ignore */ }
    }
    report.diagnostics = diag;
    report.phaseMs = phase;
    const r = report.stats && report.stats.renderer;
    const failedModules = (report.health || []).filter((h) => h.status === 'failed').map((h) => h.id);
    report.gates = {
      loaded: !report.error,
      noPageErrors: diag.pageErrors.length === 0,
      noConsoleErrors: diag.consoleErrors.length === 0,
      noFailedRequests: diag.failedRequests.length === 0 && diag.badResponses.length === 0,
      noFailedModules: failedModules.length === 0,
      drawCallsWithinBudget: !!r && r.drawCalls <= BUDGET.drawCalls,
      trianglesWithinBudget: !!r && r.triangles <= BUDGET.triangles,
      notBlank: !!report.frame && report.frame.variance >= BUDGET.minVariance,
    };
    report.failedModules = failedModules;
    report.pass = Object.values(report.gates).every(Boolean);
    if (!report.pass) failed = true;
    fs.writeFileSync(path.join(reportDir, `${preset.name}.json`), JSON.stringify(report, null, 2));
    const fps = report.fps ? report.fps.fps.toFixed(1) : '-';
    const dc = r ? r.drawCalls : '-';
    const tri = r ? r.triangles : '-';
    console.log(`${report.pass ? 'PASS' : 'FAIL'} ${preset.name.padEnd(22)} fps=${fps} draws=${dc} tris=${tri} var=${report.frame ? report.frame.variance.toFixed(0) : '-'} errors=${diag.consoleErrors.length + diag.pageErrors.length}${report.pass ? '' : ' gates=' + JSON.stringify(Object.entries(report.gates).filter(([, v]) => !v).map(([k]) => k))}`);
    if (report.error) console.log(`   error: ${report.error.split('\n')[0]}`);
    for (const e of [...diag.pageErrors, ...diag.consoleErrors].slice(0, 5)) console.log(`   ${e.split('\n')[0]}`);
    results.push({ preset: preset.name, pass: report.pass, fps: report.fps && report.fps.fps, drawCalls: dc, triangles: tri });
    await context.close();
  }
} finally {
  await browser.close();
  await server.stop();
}

const summary = { run, finishedAt: new Date().toISOString(), pass: !failed, results };
fs.writeFileSync(path.join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(inRepo('docs', 'reports', 'latest-verify.json'), JSON.stringify(summary, null, 2));
console.log(`\n${failed ? 'VERIFY FAILED' : 'VERIFY PASSED'} — reports in docs/reports/${run}/, screenshots in docs/screenshots/${run}/`);
process.exit(failed ? 1 : 0);
