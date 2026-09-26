// Headless Chromium with software WebGL (SwiftShader) and full diagnostics capture.
import { chromium } from 'playwright';

export const CHROMIUM_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--disable-gpu-sandbox',
  '--autoplay-policy=no-user-gesture-required',
];

export async function launch() {
  // CHROMIUM_PATH lets environments with a preinstalled browser (e.g. cloud sessions) skip the download
  return chromium.launch({ headless: true, args: CHROMIUM_ARGS, executablePath: process.env.CHROMIUM_PATH || undefined });
}

/** Attach listeners that record console messages, page errors and failed requests. */
export function instrument(page) {
  const diag = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (msg) => {
    const t = msg.type();
    const text = msg.text();
    if (t === 'error') diag.consoleErrors.push(text);
    else if (t === 'warning') {
      // Chromium/SwiftShader driver chatter is not a game warning, record separately
      if (/GPU stall|swiftshader|GroupMarkerNotSet|ReadPixels/i.test(text)) (diag.driverNotes ||= []).push(text);
      else diag.consoleWarnings.push(text);
    }
  });
  page.on('pageerror', (err) => diag.pageErrors.push(String(err && (err.stack || err.message))));
  page.on('requestfailed', (req) => diag.failedRequests.push({ url: req.url(), error: req.failure() && req.failure().errorText }));
  page.on('response', (res) => { if (res.status() >= 400) diag.badResponses.push({ url: res.url(), status: res.status() }); });
  return diag;
}

export async function waitReady(page, timeout = 60000) {
  await page.waitForFunction(() => window.__GAME_READY__ === true || !!window.__GAME_ERROR__, null, { timeout });
  const err = await page.evaluate(() => window.__GAME_ERROR__ || null);
  if (err) throw new Error(`game showed error overlay: ${JSON.stringify(err)}`);
}

/** Sample real frame times via requestAnimationFrame for `ms` milliseconds. */
export async function sampleFps(page, ms = 2500) {
  return page.evaluate(async (duration) => {
    const times = [];
    let last = performance.now();
    const end = last + duration;
    await new Promise((resolve) => {
      function f(now) {
        times.push(now - last); last = now;
        if (now < end) requestAnimationFrame(f); else resolve();
      }
      requestAnimationFrame(f);
    });
    times.shift();
    const sorted = [...times].sort((a, b) => a - b);
    const pct = (p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.round(p / 100 * (sorted.length - 1)))] : 0;
    const mean = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
    return { frames: times.length, fps: mean ? 1000 / mean : 0, frameMs: { mean, p50: pct(50), p95: pct(95), p99: pct(99) } };
  }, ms);
}
