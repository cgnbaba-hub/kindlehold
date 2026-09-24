// Application flow: in verify mode starts a session directly; otherwise shows the menu.
import { createSession } from './session.js';
import { installVerifyApi, markReady } from '../debug/verify-api.js';
import { showErrorOverlay } from './error-overlay.js';

export async function startApp(params) {
  const container = document.getElementById('app');
  const boot = document.getElementById('boot-screen');
  const seed = params.get('seed') || '1337';
  const quality = params.get('quality') || 'high';
  const verify = params.get('verify') === '1';
  const session = await createSession({
    container, seed, quality, verify,
    onCritical: (id, err) => showErrorOverlay({
      title: 'The game stopped unexpectedly',
      message: `A core system (${id}) failed. You can reload, or return to the menu.`,
      detail: err && (err.stack || err.message),
    }),
  });
  if (verify || import.meta.env.DEV) installVerifyApi(session);
  const preset = params.get('camera');
  if (preset) session.setCameraPreset(preset);
  const hour = params.get('hour');
  if (hour !== null) session.setTimeOfDay(Number(hour));
  session.start();
  if (boot) boot.remove();
  await session.firstFrame;
  markReady();
}
