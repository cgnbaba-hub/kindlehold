// Renders the main-menu backdrop with the game's own engine (project-authored image).
// node scripts/assets/render-menu-art.mjs  -> src/ui/assets/menu-backdrop.jpg
import { ensureServer } from '../verification/lib/server.mjs';
import { launch, waitReady } from '../verification/lib/browser.mjs';
import { inRepo } from '../verification/lib/paths.mjs';
const server = await ensureServer('http://127.0.0.1:5181/', { command: ['npx', 'vite', 'preview', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], build: true });
const browser = await launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await page.goto(new URL('?verify=1&seed=1337&demo=scouted&quality=high', server.url).toString(), { waitUntil: 'load' });
  await waitReady(page, 300000);
  await page.evaluate(() => {
    const g = window.__GAME__;
    g.freeze(true);
    g.session.setShroud(false); // the whole valley, without the fog of war
    g.session.selectionView.setVisible(false);
    // photo camera: over the settlement, up the valley towards the ford fort and the range
    g.session.rc.rts.setOverride({ pos: [-90, 30, 100], target: [20, 12, -20] });
    g.world().selection.ids = [];
    g.setTimeOfDay(15.6);
    g.advanceFrames(20, 1 / 30); g.renderNow(); g.renderNow(); // figures and animals in mid-stride
  });
  await page.screenshot({ path: inRepo('src', 'ui', 'assets', 'menu-backdrop.jpg'), type: 'jpeg', quality: 80, timeout: 300000 });
  console.log('menu backdrop rendered');
} finally { await browser.close(); await server.stop(); }
