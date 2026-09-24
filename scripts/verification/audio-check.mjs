#!/usr/bin/env node
// Loudness safety check: plays every sound of the audio showcase plus 20 s of music/ambience
// in headless Chromium and fails if the post-limiter output peak ever exceeds the limit.
import { ensureServer } from './lib/server.mjs';
import { launch } from './lib/browser.mjs';
const LIMIT = Number(process.env.AUDIO_PEAK_LIMIT || 0.5); // linear full scale
const server = await ensureServer('http://127.0.0.1:5181/', { command: ['npx', 'vite', 'preview', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], build: !process.argv.includes('--nobuild') });
const browser = await launch();
let max = 0, ok = false;
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto(new URL('?showcase=audio&quality=low', server.url).toString(), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 300000 });
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => window.__GAME__.session.audio.running(), null, { timeout: 30000 });
  await page.evaluate(() => { window.__peak = 0; setInterval(() => { window.__peak = Math.max(window.__peak, window.__GAME__.session.audio.peak()); }, 20); });
  const buttons = await page.locator('.showcase-audio button').all();
  for (const b of buttons) { await b.click(); await page.waitForTimeout(700); }
  await page.waitForTimeout(20000); // music + ambience keep running
  max = await page.evaluate(() => window.__peak);
  ok = max > 0.001 && max <= LIMIT;
  console.log(`${ok ? 'AUDIO OK' : 'AUDIO FAIL'}: max output peak ${max.toFixed(3)} (limit ${LIMIT}, silence would be < 0.001)`);
} finally { await browser.close(); await server.stop(); }
process.exit(ok ? 0 : 1);
