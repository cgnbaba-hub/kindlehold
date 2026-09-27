#!/usr/bin/env node
// Diagnostics: count WebGL resource creation/deletion and upload volume per rendered frame.
// A healthy frame creates no buffers/textures and uploads only small dynamic data.
// Usage: node scripts/verification/gl-leaks.mjs [--demo=battle] [--frames=20]
import { launch, instrument } from './lib/browser.mjs';
import { ensureServer } from './lib/server.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? 'true'] : [a, 'true']; }));
const server = await ensureServer('http://127.0.0.1:5184/', { command: ['npx', 'vite', 'preview', '--host', '127.0.0.1', '--port', '5184', '--strictPort'], build: false });

const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  instrument(page);
  await page.addInitScript(() => {
    const c = window.__GLC__ = { trace: false, stacks: {}, createBuffer: 0, deleteBuffer: 0, createTexture: 0, deleteTexture: 0, bufferData: 0, bufferDataBytes: 0, bufferSubData: 0, subBytes: 0, texImage: 0, texBytes: 0, createProgram: 0, createVertexArray: 0, deleteVertexArray: 0, drawCalls: 0 };
    const P = WebGL2RenderingContext.prototype;
    const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { fn(a); return o.apply(this, a); }; };
    wrap('createBuffer', () => { c.createBuffer++; if (c.trace) { const st = new Error().stack.split('\n').slice(3, 9).map((l) => l.trim().replace(/https?:\/\/[^/]+\//, '')).join(' < '); c.stacks[st] = (c.stacks[st] || 0) + 1; } }); wrap('deleteBuffer', () => c.deleteBuffer++);
    wrap('createTexture', () => c.createTexture++); wrap('deleteTexture', () => c.deleteTexture++);
    wrap('createProgram', () => c.createProgram++);
    wrap('createVertexArray', () => c.createVertexArray++); wrap('deleteVertexArray', () => c.deleteVertexArray++);
    wrap('bufferData', (a) => { c.bufferData++; c.bufferDataBytes += (a[1] && a[1].byteLength) || (typeof a[1] === 'number' ? a[1] : 0); });
    wrap('bufferSubData', (a) => { c.bufferSubData++; const n = (a.length >= 5 && a[4]) ? a[4] * (a[2].BYTES_PER_ELEMENT || 1) : ((a[2] && a[2].byteLength) || 0); c.subBytes += n; (c.sizes ||= {})[n] = (c.sizes[n] || 0) + 1; });
    wrap('texImage2D', (a) => { c.texImage++; }); wrap('texSubImage2D', () => { c.texImage++; });
    wrap('drawElementsInstanced', () => c.drawCalls++); wrap('drawArraysInstanced', () => c.drawCalls++); wrap('drawElements', () => c.drawCalls++); wrap('drawArrays', () => c.drawCalls++);
  });
  const q = args.demo ? `?debug=1&verify=1&ui=1&demo=${args.demo}&quality=high` : '?debug=1&start=1&quality=high';
  await page.goto(new URL(q, server.url).toString(), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 300000 });
  const res = await page.evaluate(async ({ n, autoplay, camera }) => {
    const g = window.__GAME__;
    if (autoplay) g.autoplay();
    g.setCameraPreset(camera || 'settlement');
    g.freeze(false);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const snap = () => ({ ...window.__GLC__, sizes: undefined, stacks: undefined, trace: undefined });
    window.__GLC__.sizes = {}; window.__GLC__.trace = true; window.__GLC__.stacks = {};
    const a = snap();
    for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
    const b = snap();
    const d = {};
    for (const k in a) if (!['sizes', 'stacks', 'trace'].includes(k)) d[k] = +((b[k] - a[k]) / n).toFixed(2);
    d.sizes = Object.entries(window.__GLC__.sizes).sort((x, y) => y[0] * y[1] - x[0] * x[1]).slice(0, 12).map(([k, v]) => `${k}B x${(v / n).toFixed(1)}`).join(', ');
    d.stacks = Object.entries(window.__GLC__.stacks).sort((x, y) => y[1] - x[1]).slice(0, 6);
    return d;
  }, { n: Number(args.frames || 20), autoplay: !!args.autoplay, camera: args.camera });
  const { stacks, ...rest } = res; console.log('per frame:', JSON.stringify(rest)); for (const [st, n] of stacks || []) console.log(n, st);
} finally { await browser.close(); await server.stop(); }
