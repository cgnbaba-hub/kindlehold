// Loads the deployed build through nginx (with its real CSP headers) in headless Chromium
// and fails on CSP violations, page errors or failed requests. Usage: node csp-smoke.mjs <url>
import { launch, instrument, waitReady } from '../verification/lib/browser.mjs';
const url = process.argv[2];
const browser = await launch();
let ok = false;
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const diag = instrument(page);
  const csp = [];
  page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); });
  await page.goto(new URL('?verify=1&quality=low', url).toString(), { waitUntil: 'load', timeout: 120000 });
  await waitReady(page, 300000);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('.main-menu', { timeout: 60000 });
  const problems = [...csp, ...diag.pageErrors, ...diag.consoleErrors, ...diag.failedRequests.map((r) => `failed ${r.url}`)];
  if (problems.length) console.error('CSP SMOKE FAIL:\n' + problems.join('\n'));
  else { ok = true; console.log('CSP SMOKE OK: game and menu load under the nginx CSP without violations'); }
} finally { await browser.close(); }
process.exit(ok ? 0 : 1);
