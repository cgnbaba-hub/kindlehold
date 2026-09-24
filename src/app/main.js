// Composition root entry. Routes to the game or a subsystem showcase and installs
// global error handling so the page always shows a recoverable screen.
import '../ui/styles.css';
import { log } from '../core/logger.js';
import { showErrorOverlay } from './error-overlay.js';

const params = new URLSearchParams(location.search);

window.addEventListener('error', (ev) => {
  log.error('window', ev.message || 'uncaught error', ev.error);
});
window.addEventListener('unhandledrejection', (ev) => {
  const reason = ev.reason;
  log.error('window', `unhandled rejection: ${reason && reason.message ? reason.message : String(reason)}`);
});

function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

async function boot() {
  if (!hasWebGL2()) {
    showErrorOverlay({
      title: 'WebGL 2 is not available',
      message: 'Kindlehold needs a browser with WebGL 2 enabled (current Chrome, Edge, Firefox or Safari). Check that hardware acceleration is switched on.',
      actions: [{ label: 'Try again', primary: true, run: () => location.reload() }],
    });
    return;
  }
  const showcase = params.get('showcase');
  try {
    if (showcase) {
      const mod = await import('../showcase/index.js');
      await mod.runShowcase(showcase, params);
    } else {
      const mod = await import('./game-app.js');
      await mod.startApp(params);
    }
  } catch (err) {
    log.error('boot', `boot failed: ${err && err.message}`, err);
    showErrorOverlay({
      title: 'Kindlehold could not start',
      message: 'A required part of the game failed to load. Reloading usually fixes this; if it keeps happening, please report the details below.',
      detail: err && (err.stack || err.message),
    });
  }
}

boot();
