// Renderer, scene and camera ownership (critical view module).
import * as THREE from 'three';
import { createRtsCamera } from '../camera/rts-camera.js';
import { createPost, gfxFlags } from '../render/post.js';

// post: multisampling of the HDR scene buffer, bloom and the miniature focus (see render/post.js)
export const QUALITY = {
  low: { pixelRatio: 0.75, shadows: false, shadowSize: 0, antialias: false, particles: 300, grass: 0.25, post: null },
  medium: { pixelRatio: 1, shadows: true, shadowSize: 1024, antialias: true, particles: 700, grass: 0.6, post: { samples: 2, bloom: true, tilt: false } },
  high: { pixelRatio: 1.25, shadows: true, shadowSize: 2048, antialias: true, particles: 1500, grass: 1, post: { samples: 4, bloom: true, tilt: true, ao: true } },
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
  // supersampled (pixel ratio > 1.1) screens need no extra multisampling
  const post = q.post ? createPost({ renderer, scene, getCamera: () => rts.camera, cfg: { ...q.post, samples: renderer.getPixelRatio() > 1.1 ? 0 : q.post.samples } }) : null;
  const lastInfo = { calls: 0, triangles: 0, points: 0, lines: 0 };
  let contextLost = false;
  const listeners = { lost: [], restored: [], scaled: [] };
  const fire = (k, d) => { for (const f of listeners[k]) { try { f(d); } catch { /* ui only */ } } };

  // Load governor: when the graphics card cannot keep up (long frames for a few seconds), first
  // switch off the costliest effects (occlusion, then glow and miniature focus, then
  // multisampling), and only then render at a lower resolution — instead of stalling the whole
  // browser (a saturated card also makes the page's own text and icons flicker). Effects stay off
  // for the session and the resolution never climbs back to a level that was too slow, so the
  // governor cannot oscillate. A graphics driver reset also drops a step.
  const maxRatio = Math.min(window.devicePixelRatio || 1, q.pixelRatio);
  const minRatio = Math.min(maxRatio, 0.6);
  let ratio = maxRatio, ceiling = maxRatio, slowFor = 0, fastFor = 0, cooldown = 0, ema = 16, cpuEma = 4;
  const ladder = post ? [
    ['ao', () => post.effects().ao && (post.setEffects({ ao: false }), true)],
    ['glow', () => { const e = post.effects(); if (!e.bloom && !e.tilt) return false; post.setEffects({ bloom: false, tilt: false }); return true; }],
    ['msaa', () => post.effects().samples > 0 && (post.setEffects({ msaa: false }), true)],
  ] : [];
  const reduced = [];
  function setRatio(r, reason) {
    const next = Math.max(minRatio, Math.min(ceiling, Math.round(r * 100) / 100));
    if (next === ratio) return false;
    ratio = next;
    renderer.setPixelRatio(ratio);
    resize();
    fire('scaled', { ratio, max: maxRatio, reason, reduced: [...reduced] });
    return true;
  }
  function lighten() {
    while (ladder.length) {
      const [name, step] = ladder.shift();
      if (step()) { reduced.push(name); fire('scaled', { ratio, max: maxRatio, reason: 'slow', reduced: [...reduced] }); return true; }
    }
    ceiling = Math.max(minRatio, Math.round((ratio - 0.05) * 100) / 100); // never back to the slow level
    return setRatio(ratio - 0.15, 'slow');
  }

  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); contextLost = true; fire('lost'); });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    ceiling = Math.max(minRatio, Math.round((ratio - 0.25) * 100) / 100);
    setRatio(ratio - 0.25, 'reset');
    fire('restored', { ratio });
  });

  function gpuName() {
    try {
      const gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    } catch { return ''; }
  }

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
    /**
     * Feed the real duration of each frame and the script time spent in it (ms); adapts effects
     * and resolution. Frames slowed by the simulation and the HUD (script time outside draw()) are not the graphics
     * card's fault: cutting effects would not help there.
     */
    govern(frameMs, cpuMs = 0) {
      if (verify || contextLost || !(frameMs > 0)) return;
      ema += (Math.min(frameMs, 250) - ema) * 0.1;
      cpuEma += (Math.min(cpuMs, 250) - cpuEma) * 0.1;
      if (cpuEma > ema * 0.8) { slowFor = 0; fastFor = 0; return; }
      const s = frameMs / 1000;
      cooldown = Math.max(0, cooldown - s);
      if (ema > 45) { slowFor += s; fastFor = 0; } else if (ema < 22) { fastFor += s; slowFor = 0; } else { slowFor = 0; fastFor = 0; }
      if (slowFor > 2.5 && cooldown <= 0) { if (lighten()) cooldown = 4; slowFor = 0; }
      else if (fastFor > 30 && ratio < ceiling && cooldown <= 0) { if (setRatio(ratio + 0.05, 'fast')) cooldown = 10; fastFor = 0; }
    },
    get contextLost() { return contextLost; },
    /** What the governor has switched off so far (for the settings panel). */
    load() { return { ratio, max: maxRatio, reduced: [...reduced], gpu: gpuName() }; },
    /** Time spent in the last draw() (ms); it waits on the graphics card when that is saturated. */
    drawMs: 0,
    draw() {
      if (contextLost) return;
      const t0 = performance.now();
      renderer.info.reset();
      if (post) post.render(); else renderer.render(scene, rts.camera);
      this.drawMs = performance.now() - t0;
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
