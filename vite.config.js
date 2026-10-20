import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

// The commit a build was made from, shown under Credits so a player can see which version is live.
function buildId() {
  if (process.env.KINDLEHOLD_BUILD) return process.env.KINDLEHOLD_BUILD;
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev'; } catch { return 'dev'; }
}

// Base path is configurable for subpath hosting (e.g. /kindlehold/): KINDLEHOLD_BASE=/kindlehold/ npm run build
const base = process.env.KINDLEHOLD_BASE || '/';

export default defineConfig({
  base,
  define: { __KH_BUILD__: JSON.stringify(buildId()), __KH_BUILT_AT__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  build: {
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
  server: { host: '127.0.0.1', port: 5180, strictPort: true },
  preview: { host: '127.0.0.1', port: 5181, strictPort: true },
});
