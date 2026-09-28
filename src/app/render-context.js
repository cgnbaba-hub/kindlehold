// Renderer, scene and camera ownership (critical view module).
import * as THREE from 'three';
import { createRtsCamera } from '../camera/rts-camera.js';
import { createPost, gfxFlags } from '../render/post.js';

// post: multisampling of the HDR scene buffer, bloom and the miniature focus (see render/post.js)
export const QUALITY = {
  low: { pixelRatio: 0.75, shadows: false, shadowSize: 0, antialias: false, particles: 300, grass: 0.25, post: null },
  medium: { pixelRatio: 1, shadows: true, shadowSize: 1024, antialias: true, particles: 700, grass: 0.6, post: { samples: 2, bloom: true, tilt: false } },
  high: { pixelRatio: 1.5, shadows: true, shadowSize: 2048, antialias: true, particles: 1500, grass: 1, post: { samples: 4, bloom: true, tilt: true, ao: true } },
};

export function createRenderContext({ container, terrain, quality = 'high', verify = false }) {
  const base = Object.hasOwn(QUALITY, quality) ? QUALITY[quality] : QUALITY.high;
  // ?post=off switches the post-processing off (comparisons, troubleshooting)
  const postOff = typeof location !== 'undefined' && new URLSearchParams(location.search).get('post') === 'off';
  const fx = gfxFlags();
  const q = postOff ? { ...base, post: null } : base.post ? { ...base, post: { ...base.post, ao: base.post.ao && !fx.has('noao'), bloom: base.post.bloom && !fx.has('nobloom'), tilt: base.post.tilt && !fx.has('notilt') }, ibl: !fx.has('noibl'), clouds: !fx.has('noclouds') } : base;
  // with post-processing the canvas itself needs no multisampling (the scene buffer has it)
  const renderer = new THREE.WebGLRenderer({ antialias: q.antialias && !q.post, powerPreference: 'high-performance', preserveDrawingBuffer: verify });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
  renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = q.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  renderer.domElement.className = 'game-canvas';
  renderer.domElement.setAttribute('aria-label', 'Game view');
  renderer.domElement.tabIndex = 0;
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const rts = createRtsCamera({ aspect: renderer.domElement.width / Math.max(1, renderer.domElement.height), terrain });
  // supersampled (pixel ratio > 1.25) screens need no extra multisampling
  const post = q.post ? createPost({ renderer, scene, getCamera: () => rts.camera, cfg: { ...q.post, samples: renderer.getPixelRatio() > 1.25 ? 0 : q.post.samples } }) : null;
  const lastInfo = { calls: 0, triangles: 0, points: 0, lines: 0 };
  let contextLost = false;
  const listeners = { lost: [], restored: [], scaled: [] };
  const fire = (k, d) => { for (const f of listeners[k]) { try { f(d); } catch { /* ui only */ } } };

  // Resolution governor: when the graphics card cannot keep up (long frames for a few
  // seconds), render at a lower resolution instead of stalling the whole browser; creep back
  // up once frames are quick again. A graphics driver reset also drops a step.
  const maxRatio = Math.min(window.devicePixelRatio || 1, q.pixelRatio);
  const minRatio = Math.min(maxRatio, 0.6);
  let ratio = maxRatio, slowFor = 0, fastFor = 0, cooldown = 0, ema = 16;
  function setRatio(r, reason) {
    const next = Math.max(minRatio, Math.min(maxRatio, Math.round(r * 100) / 100));
    if (next === ratio) return false;
    ratio = next;
    renderer.setPixelRatio(ratio);
    resize();
    fire('scaled', { ratio, max: maxRatio, reason });
    return true;
  }

  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); contextLost = true; fire('lost'); });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    setRatio(ratio - 0.25, 'reset');
    fire('restored', { ratio });
  });

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    rts.setAspect(w / Math.max(1, h));
    if (post) post.setSize();
  }
  window.addEventListener('resize', resize);

  return {
    id: 'renderer',
    kind: 'view',
    critical: true,
    renderer, scene, rts, quality: q, qualityName: quality, post,
    /** Look of the post-processing for this frame (no-op without post). */
    setLook(look) { if (post) post.setLook(look); },
    get camera() { return rts.camera; },
    on(kind, fn) { listeners[kind].push(fn); return () => { listeners[kind] = listeners[kind].filter((f) => f !== fn); }; },
    /** Feed the real duration of each frame (ms); adapts the render resolution. */
    govern(frameMs) {
      if (verify || contextLost || !(frameMs > 0)) return;
      ema += (Math.min(frameMs, 250) - ema) * 0.1;
      const s = frameMs / 1000;
      cooldown = Math.max(0, cooldown - s);
      if (ema > 45) { slowFor += s; fastFor = 0; } else if (ema < 22) { fastFor += s; slowFor = 0; } else { slowFor = 0; fastFor = 0; }
      if (slowFor > 2.5 && cooldown <= 0) { if (setRatio(ratio - 0.15, 'slow')) cooldown = 4; slowFor = 0; }
      else if (fastFor > 20 && ratio < maxRatio && cooldown <= 0) { if (setRatio(ratio + 0.1, 'fast')) cooldown = 8; fastFor = 0; }
    },
    get contextLost() { return contextLost; },
    draw() {
      if (contextLost) return;
      renderer.info.reset();
      if (post) post.render(); else renderer.render(scene, rts.camera);
      const r = renderer.info.render;
      lastInfo.calls = r.calls; lastInfo.triangles = r.triangles; lastInfo.points = r.points; lastInfo.lines = r.lines;
    },
    info() {
      return {
        drawCalls: lastInfo.calls,
        triangles: lastInfo.triangles,
        points: lastInfo.points,
        lines: lastInfo.lines,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
        programs: renderer.info.programs ? renderer.info.programs.length : 0,
        pixelRatio: renderer.getPixelRatio(),
        width: renderer.domElement.width,
        height: renderer.domElement.height,
      };
    },
    /** Mean luminance and variance of the current frame (blank-screen detection). */
    sampleFrame() {
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      renderer.render(scene, rts.camera);
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const n = 64;
      let sum = 0, sum2 = 0;
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const k = (Math.floor((j + 0.5) * h / n) * w + Math.floor((i + 0.5) * w / n)) * 4;
          const l = 0.2126 * buf[k] + 0.7152 * buf[k + 1] + 0.0722 * buf[k + 2];
          sum += l; sum2 += l * l;
        }
      }
      const cnt = n * n, mean = sum / cnt;
      return { mean, variance: sum2 / cnt - mean * mean };
    },
    getHealthStatus() { return contextLost ? { status: 'degraded', detail: 'WebGL context lost' } : { status: 'ok' }; },
    dispose() {
      window.removeEventListener('resize', resize);
      if (post) post.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
