// Start or connect to the Vite dev server (or any URL) for browser verification.
import { spawn } from 'node:child_process';
import { ROOT } from './paths.mjs';

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

export async function ensureServer(url = 'http://127.0.0.1:5180/', { command = ['npx', 'vite', '--host', '127.0.0.1', '--port', '5180', '--strictPort'] } = {}) {
  if (await reachable(url)) return { url, stop: async () => {}, started: false };
  const child = spawn(command[0], command.slice(1), { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, BROWSER: 'none' } });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (await reachable(url)) {
      return { url, started: true, stop: async () => { child.kill('SIGTERM'); } };
    }
    if (child.exitCode !== null) throw new Error(`server exited early:\n${output}`);
    await new Promise((r) => setTimeout(r, 400));
  }
  child.kill('SIGTERM');
  throw new Error(`server did not become reachable at ${url}:\n${output}`);
}
