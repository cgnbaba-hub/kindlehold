#!/usr/bin/env node
// End-to-end tests through the real UI in headless Chromium (production build via vite preview).
// Usage: node scripts/verification/e2e.mjs [--url=...] [--dev]
import fs from 'node:fs';
import path from 'node:path';
import { inRepo, ensureDir, runId } from './lib/paths.mjs';
import { ensureServer } from './lib/server.mjs';
import { launch, instrument, waitReady } from './lib/browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? 'true'] : [a, 'true']; }));
const run = `e2e-${runId()}`;
const shotDir = ensureDir(inRepo('docs', 'screenshots', run));
const reportDir = ensureDir(inRepo('docs', 'reports', run));
const server = args.dev ? await ensureServer(args.url || 'http://127.0.0.1:5180/') : await ensureServer(args.url || 'http://127.0.0.1:5181/', { command: ['npx', 'vite', 'preview', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], build: !args.nobuild });
const browser = await launch();
const results = [];

async function test(name, fn, { viewport = { width: 1600, height: 900 }, init = null } = {}) {
  if (args.only && !args.only.split(',').includes(name)) return;
  const context = await browser.newContext({ viewport });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const diag = instrument(page);
  const t0 = Date.now();
  let error = null;
  try { await fn(page, diag); } catch (err) { error = String(err && (err.stack || err.message)); }
  try { await page.screenshot({ path: path.join(shotDir, `${name}.png`), timeout: 60000 }); } catch { /* ignore */ }
  const pass = !error && diag.pageErrors.length === 0 && diag.consoleErrors.filter((e) => !/forced failure|WebGL 2|Web Audio/.test(e)).length === 0;
  results.push({ name, pass, ms: Date.now() - t0, error, pageErrors: diag.pageErrors, consoleErrors: diag.consoleErrors, failedRequests: diag.failedRequests });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)${error ? '\n   ' + error.split('\n')[0] : ''}${diag.pageErrors.length ? '\n   pageErrors: ' + diag.pageErrors[0].split('\n')[0] : ''}${diag.consoleErrors.length ? '\n   console: ' + diag.consoleErrors[0].split('\n')[0] : ''}`);
  await context.close();
}

const assert = (c, m) => { if (!c) throw new Error(m); };
const url = (q = '') => new URL(q, server.url).toString();
const game = (page, fn, arg) => page.evaluate(fn, arg);

try {
  await test('main-menu', async (page) => {
    await page.goto(url(), { waitUntil: 'load' });
    await page.waitForSelector('.main-menu .title', { timeout: 30000 });
    for (const label of ['New Game', 'Continue', 'Load Game', 'Settings', 'How to Play', 'Credits & Licences']) {
      assert(await page.getByRole('button', { name: label }).count() === 1, `missing menu button ${label}`);
    }
    await page.getByRole('button', { name: 'How to Play' }).click();
    await page.waitForSelector('.howto');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.main-menu');
  });

  await test('new-game-tutorial-flow', async (page) => {
    await page.goto(url('?debug=1&quality=low'), { waitUntil: 'load' });
    await page.getByRole('button', { name: 'New Game' }).click();
    await page.getByRole('radio', { name: /Normal/ }).click();
    await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 120000 });
    await page.waitForSelector('.hud .objectives .obj-title');
    const first = await page.textContent('.objectives .obj-list');
    assert(/Rekindle the hearth/.test(first), 'first objective shown');
    // select the Keep by clicking it on screen
    const keepId = (await game(page, () => window.__GAME__.find('building', 'keep')))[0];
    const pos = await game(page, (id) => { const k = window.__GAME__.world().entities[id]; return window.__GAME__.project(k.x, k.z, 4); }, keepId);
    await page.mouse.click(pos.x, pos.y);
    await page.waitForFunction((id) => window.__GAME__.world().selection.ids.includes(id), keepId, { timeout: 10000 });
    await page.getByRole('button', { name: 'Rekindle the Hearth' }).click();
    await page.waitForFunction(() => window.__GAME__.world().mission.flags.keepLit === true, null, { timeout: 20000 });
    await page.waitForFunction(() => /Timber and bread/.test(document.querySelector('.objectives').textContent), null, { timeout: 20000 });
    // build a lodge through the build menu: open with B, pick, click a valid spot
    await page.keyboard.press('KeyB');
    await page.getByRole('button', { name: "Woodcutter's Lodge" }).click();
    // try a few valid spots: the click is snapped to 0.5 m, so a spot right on the edge of
    // the valid area can be rejected; a player just sees a red ghost and moves on
    let spot = null;
    for (const [cx, cz] of [[-64, 40], [-68, 44], [-60, 48]]) {
      if (spot) { await page.keyboard.press('KeyB'); await page.getByRole('button', { name: "Woodcutter's Lodge" }).click(); }
      spot = await game(page, ([x, z]) => {
        const g = window.__GAME__;
        const s = g.findSpot('lodge', x, z);
        g.session.rc.rts.jumpTo(s.x, s.z, 0.6, 50);
        g.renderNow();
        return g.project(s.x, s.z, null);
      }, [cx, cz]);
      await page.mouse.move(spot.x, spot.y);
      await page.waitForTimeout(400);
      await page.mouse.click(spot.x, spot.y);
      try {
        await page.waitForFunction(() => window.__GAME__.find('building', 'lodge').length === 1, null, { timeout: 15000 });
        return;
      } catch { /* next spot */ }
    }
    throw new Error('lodge could not be placed through the UI');
  });

  await test('interactive-tutorial-and-grab-pan', async (page) => {
    await page.goto(url('?debug=1&start=1&quality=low'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 120000 });
    await page.waitForSelector('.tutorial .tut-title', { timeout: 30000 });
    assert(/Move the map/.test(await page.textContent('.tut-title')), 'tutorial starts with map movement');
    const before = await game(page, () => ({ x: window.__GAME__.session.rc.rts.state.x, z: window.__GAME__.session.rc.rts.state.z }));
    // right-drag: grab the map
    await page.mouse.move(700, 450);
    await page.mouse.down({ button: 'right' });
    for (let i = 1; i <= 10; i++) await page.mouse.move(700 - i * 30, 450 - i * 12);
    await page.mouse.up({ button: 'right' });
    const after = await game(page, () => ({ x: window.__GAME__.session.rc.rts.state.x, z: window.__GAME__.session.rc.rts.state.z }));
    assert(Math.hypot(after.x - before.x, after.z - before.z) > 8, `right-drag moved the camera (${JSON.stringify(before)} -> ${JSON.stringify(after)})`);
    await page.waitForFunction(() => /Zoom/.test(document.querySelector('.tut-title').textContent), null, { timeout: 30000 });
    for (let i = 0; i < 6; i++) { await page.mouse.move(700, 400); await page.mouse.wheel(0, -120); await page.waitForTimeout(150); }
    await page.waitForFunction(() => /Select the Keep/.test(document.querySelector('.tut-title').textContent), null, { timeout: 30000 });
    const keepId = (await game(page, () => window.__GAME__.find('building', 'keep')))[0];
    await game(page, (id) => { const k = window.__GAME__.world().entities[id]; window.__GAME__.session.rc.rts.jumpTo(k.x, k.z, 0.6, 50); window.__GAME__.renderNow(); }, keepId);
    const pos = await game(page, (id) => { const k = window.__GAME__.world().entities[id]; return window.__GAME__.project(k.x, k.z, 4); }, keepId);
    await page.mouse.click(pos.x, pos.y);
    await page.waitForFunction(() => /Light the hearth/.test(document.querySelector('.tut-title').textContent), null, { timeout: 30000 });
    await page.getByRole('button', { name: 'Rekindle the Hearth' }).click();
    await page.waitForFunction(() => /Woodcutter/.test(document.querySelector('.tut-title').textContent), null, { timeout: 30000 });
    // a short right-click (no drag) must still be the context command, not a pan
    await page.getByRole('button', { name: 'Skip tutorial' }).click();
    assert(await page.locator('.tutorial').count() === 0, 'tutorial can be skipped');
  });

  await test('save-load-roundtrip', async (page) => {
    await page.goto(url('?debug=1&start=1&quality=low'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 120000 });
    await game(page, () => { const g = window.__GAME__; g.issue({ type: 'rekindle' }); g.runTicks(400); });
    const before = await game(page, () => ({ tick: window.__GAME__.world().tick, hash: window.__GAME__.getWorldHash(), n: Object.keys(window.__GAME__.world().entities).length }));
    await page.keyboard.press('F5');
    await page.waitForFunction(() => /Quick-saved/.test(document.querySelector('.toasts').textContent), null, { timeout: 10000 });
    await game(page, () => window.__GAME__.runTicks(300));
    await page.keyboard.press('F9');
    await page.waitForFunction((t) => window.__GAME_READY__ && window.__GAME__ && window.__GAME__.world().tick < t + 100, before.tick, { timeout: 120000 });
    await page.waitForTimeout(500);
    const after = await game(page, () => ({ tick: window.__GAME__.world().tick, n: Object.keys(window.__GAME__.world().entities).length, lit: window.__GAME__.world().mission.flags.keepLit }));
    assert(after.lit === true, 'loaded world keeps the rekindled hearth');
    assert(Math.abs(after.tick - before.tick) < 200, `loaded tick ${after.tick} near saved ${before.tick}`);
  });

  await test('pause-settings-persist', async (page) => {
    await page.goto(url('?debug=1&start=1&quality=low'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 120000 });
    await page.locator('.game-canvas').click({ position: { x: 800, y: 300 } });
    await page.keyboard.press('Escape');
    await page.waitForSelector('.pause .menu-card');
    const t1 = await game(page, () => window.__GAME__.world().tick);
    await page.waitForTimeout(600);
    const t2 = await game(page, () => window.__GAME__.world().tick);
    assert(t1 === t2, 'simulation paused');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: 'Audio' }).click();
    await page.locator('#set-musicVolume').fill('0.2');
    await page.getByRole('tab', { name: 'Accessibility' }).click();
    await page.locator('#set-reducedMotion').check();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Resume' }).click();
    await page.goto(url('?debug=1'), { waitUntil: 'load', timeout: 120000 });
    await page.waitForSelector('.main-menu', { timeout: 120000 });
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: 'Audio' }).click();
    assert(Math.abs(Number(await page.locator('#set-musicVolume').inputValue()) - 0.2) < 1e-6, 'settings screen shows persisted value after reload');
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('kindlehold.settings.v1')));
    assert(Math.abs(s.musicVolume - 0.2) < 1e-6 && s.reducedMotion === true, 'settings persisted');
  });

  await test('error-screen-on-critical-failure', async (page) => {
    await page.goto(url('?debug=1&start=1&quality=low'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 120000 });
    await game(page, () => window.__GAME__.forceCriticalFailure());
    await page.waitForSelector('#error-overlay', { timeout: 10000 });
    assert(await page.getByRole('button', { name: 'Main menu' }).count() === 1, 'recovery action offered');
    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.waitForSelector('.main-menu');
  });

  await test('no-webgl-fallback', async (page) => {
    await page.goto(url(), { waitUntil: 'load' });
    await page.waitForSelector('#error-overlay', { timeout: 20000 });
    assert(/WebGL 2 is not available/.test(await page.textContent('#error-overlay')), 'explains missing WebGL');
  }, { init: () => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { if (t === 'webgl2') return null; return orig.call(this, t, ...a); }; } });

  await test('audio-unavailable-degrades-gracefully', async (page) => {
    await page.goto(url('?debug=1&start=1&quality=low'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 120000 });
    await page.locator('.game-canvas').click({ position: { x: 800, y: 300 } });
    await page.waitForTimeout(300);
    const h = await game(page, () => window.__GAME__.getHealth().find((m) => m.id === 'audio'));
    assert(h && h.status === 'degraded', `audio health is ${h && h.status}`);
    const t1 = await game(page, () => window.__GAME__.world().tick);
    await page.waitForFunction((t) => window.__GAME__.world().tick > t + 5, t1, { timeout: 60000 });
  }, { init: () => { delete window.AudioContext; delete window.webkitAudioContext; } });

  await test('victory-screen', async (page) => {
    await page.goto(url('?debug=1&start=1&quality=low'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 120000 });
    await game(page, () => { const g = window.__GAME__; const id = g.find('building', 'warhall')[0]; const b = g.world().entities[id]; b.hp = 0; b.state = 'destroyed'; g.runTicks(15); });
    await page.waitForSelector('.end.victory', { timeout: 15000 });
    assert(/The Toll Is Broken/.test(await page.textContent('.end')), 'victory text');
  });

  await test('ui-1280x720-no-overlap', async (page) => {
    await page.goto(url('?debug=1&start=1&quality=low'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 120000 });
    await page.waitForTimeout(600);
    const boxes = await page.evaluate(() => ['.ribbon', '.topbar', '.objectives', '.minimap', '.selection', '.commands'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { s, l: r.left, t: r.top, r: r.right, b: r.bottom }; }));
    for (const b of boxes) assert(b.l >= 0 && b.t >= 0 && b.r <= 1280 && b.b <= 720, `${b.s} outside viewport`);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], c = boxes[j];
      const overlap = a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b;
      assert(!overlap, `${a.s} overlaps ${c.s}`);
    }
  }, { viewport: { width: 1280, height: 720 } });
} finally {
  await browser.close();
  await server.stop();
}

const summary = { run, finishedAt: new Date().toISOString(), pass: results.every((r) => r.pass), results };
fs.writeFileSync(path.join(reportDir, 'e2e.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(inRepo('docs', 'reports', 'latest-e2e.json'), JSON.stringify(summary, null, 2));
console.log(`\n${summary.pass ? 'E2E PASSED' : 'E2E FAILED'} (${results.filter((r) => r.pass).length}/${results.length}) — docs/reports/${run}/e2e.json`);
process.exit(summary.pass ? 0 : 1);
