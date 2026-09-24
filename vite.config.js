import { defineConfig } from 'vite';

// Base path is configurable for subpath hosting (e.g. /kindlehold/): KINDLEHOLD_BASE=/kindlehold/ npm run build
const base = process.env.KINDLEHOLD_BASE || '/';

export default defineConfig({
  base,
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
