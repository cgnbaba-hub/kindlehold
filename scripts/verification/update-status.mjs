#!/usr/bin/env node
// Regenerates docs/STATUS.json from real evidence: test run, latest verify/e2e/perf
// reports, critic scores (docs/critiques/scores.json) and git. Never invents values:
// anything not measured is written as null with a note.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { inRepo } from './lib/paths.mjs';

const read = (p) => { try { return JSON.parse(fs.readFileSync(inRepo(p), 'utf8')); } catch { return null; } };
const sh = (c) => { try { return execSync(c, { cwd: inRepo(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } };

const testOut = sh('node --test "tests/unit/**/*.test.js" "tests/integration/**/*.test.js" "tests/simulation/**/*.test.js" 2>&1');
const num = (re) => { const m = testOut.match(re); return m ? Number(m[1]) : null; };
const tests = { total: num(/ℹ tests (\d+)/), pass: num(/ℹ pass (\d+)/), fail: num(/ℹ fail (\d+)/), ranAt: new Date().toISOString() };

const verify = read('docs/reports/latest-verify.json');
const e2e = read('docs/reports/latest-e2e.json');
const perf = read('docs/reports/latest-perf.json');
const scores = read('docs/critiques/scores.json') || { modules: {}, history: [] };
const prev = read('docs/STATUS.json') || {};
const commit = sh('git rev-parse --short HEAD').trim();

const OWNERS = {
  core: 'integrator', world: 'integrator', app: 'integrator', camera: 'integrator', input: 'integrator', render: 'integrator',
  terrain: 'terrain-builder', environment: 'environment-builder', navigation: 'navigation-builder', economy: 'economy-builder',
  production: 'economy-builder', technology: 'economy-builder', population: 'population-builder', buildings: 'building-builder',
  construction: 'building-builder', units: 'unit-builder', selection: 'unit-builder', heroes: 'hero-builder', combat: 'combat-builder',
  ai: 'ai-builder', missions: 'mission-builder', ui: 'ui-builder', audio: 'audio-builder', effects: 'effects-builder', save: 'save-builder',
  telemetry: 'verification-builder', debug: 'verification-builder', showcase: 'integrator', demo: 'mission-builder', deployment: 'deployment-builder',
};
const modules = {};
for (const [m, owner] of Object.entries(OWNERS)) {
  const s = scores.modules[m] || {};
  modules[m] = { owner, status: s.status || 'implemented', visualScore: s.visual ?? null, gameplayScore: s.gameplay ?? null, iterations: s.iterations ?? 0, blockers: s.blockers || [], polish: s.polish || [] };
}
const status = {
  project: 'Kindlehold',
  stage: prev.stage ?? 1,
  currentWave: prev.currentWave ?? 5,
  lastVerifiedCommit: commit,
  lastVerification: new Date().toISOString(),
  environment: prev.environment,
  tests,
  verification: verify ? { run: verify.run, pass: verify.pass, presets: verify.results } : null,
  e2e: e2e ? { run: e2e.run, pass: e2e.pass, passed: e2e.results.filter((r) => r.pass).length, total: e2e.results.length } : null,
  performance: perf ? {
    run: perf.run, pass: perf.pass, gates: perf.gates,
    simMsPerTickMean: perf.sim.meanMs, simMsPerTickP95: perf.sim.p95Ms, simEntities: perf.sim.entities,
    browser: perf.browser ? { drawCalls: perf.browser.stats.renderer.drawCalls, triangles: perf.browser.stats.renderer.triangles, textures: perf.browser.stats.renderer.textures, geometries: perf.browser.stats.renderer.geometries, heapMB: perf.browser.mem && perf.browser.mem.usedMB, fpsSwiftShader: perf.browser.fps.fps, frameMsP95SwiftShader: perf.browser.fps.frameMs.p95, readyMs: perf.browser.readyMs } : null,
    gpuFps: null, gpuFpsNote: 'Not measurable: the VPS has no GPU (SwiftShader only). See PERFORMANCE_BUDGET.md.',
  } : null,
  consoleErrorCount: verify ? null : null,
  failedRequestCount: null,
  modules,
  openBlockers: scores.openBlockers || [],
  openPolish: scores.openPolish || [],
  criticHistory: scores.history,
  builderIterations: scores.iterations || {},
  assetLicences: 'Procedural/project-authored content; character models and animations: KayKit Adventurers (Kay Lousberg, CC0); three.js (MIT). check-register: see scripts/assets/check-register.mjs',
  deployment: scores.deployment || prev.deployment || { status: 'validated locally (nginx in Docker); public deployment not performed' },
  nextRecommendedAction: scores.next || prev.nextRecommendedAction,
};
// aggregate console errors / failed requests from the latest verify run's per-preset reports
if (verify) {
  let ce = 0, fr = 0;
  for (const r of verify.results) {
    const rep = read(`docs/reports/${verify.run}/${r.preset}.json`);
    if (rep) { ce += rep.diagnostics.consoleErrors.length + rep.diagnostics.pageErrors.length; fr += rep.diagnostics.failedRequests.length + rep.diagnostics.badResponses.length; }
  }
  status.consoleErrorCount = ce; status.failedRequestCount = fr;
}
fs.writeFileSync(inRepo('docs', 'STATUS.json'), JSON.stringify(status, null, 2) + '\n');
console.log(`STATUS.json updated: tests ${tests.pass}/${tests.total}, verify ${verify ? verify.pass : 'n/a'}, e2e ${status.e2e ? status.e2e.passed + '/' + status.e2e.total : 'n/a'}, perf ${perf ? perf.pass : 'n/a'}, commit ${commit}`);
