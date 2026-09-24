// Renders the main-menu backdrop with the game's own engine (project-authored image).
// node scripts/assets/render-menu-art.mjs  -> src/ui/assets/menu-backdrop.jpg
import { ensureServer } from '../verification/lib/server.mjs';
import { launch, waitReady } from '../verification/lib/browser.mjs';
import { inRepo } from '../verification/lib/paths.mjs';
const server = await ensureServer('http://127.0.0.1:5181/', { command: ['npx', 'vite', 'preview', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], build: true });
const browser = await launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await page.goto(new URL('?verify=1&seed=1337&demo=midgame&quality=high', server.url).toString(), { waitUntil: 'load' });
  await waitReady(page, 300000);
  await page.evaluate(() => {
    const g = window.__GAME__;
    g.freeze(true);
    g.session.selectionView.setVisible(false);
    g.session.rc.rts.jumpTo(-30, 44, 0.95, 48);
    g.world().selection.ids = [];
    g.setTimeOfDay(16.9);
    g.renderNow(); g.renderNow();
  });
  await page.screenshot({ path: inRepo('src', 'ui', 'assets', 'menu-backdrop.jpg'), type: 'jpeg', quality: 80, timeout: 300000 });
  console.log('menu backdrop rendered');
} finally { await browser.close(); await server.stop(); }
