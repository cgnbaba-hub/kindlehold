// Renderer, scene and camera ownership (critical view module).
import * as THREE from 'three';
import { createRtsCamera } from '../camera/rts-camera.js';

export const QUALITY = {
  low: { pixelRatio: 0.75, shadows: false, shadowSize: 0, antialias: false, particles: 300, grass: 0.25 },
  medium: { pixelRatio: 1, shadows: true, shadowSize: 1024, antialias: true, particles: 700, grass: 0.6 },
  high: { pixelRatio: 1.5, shadows: true, shadowSize: 2048, antialias: true, particles: 1500, grass: 1 },
};

export function createRenderContext({ container, terrain, quality = 'high', verify = false }) {
  const q = QUALITY[quality] || QUALITY.high;
  const renderer = new THREE.WebGLRenderer({ antialias: q.antialias, powerPreference: 'high-performance', preserveDrawingBuffer: verify });
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
  const lastInfo = { calls: 0, triangles: 0, points: 0, lines: 0 };
  let contextLost = false;

  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); contextLost = true; });
  renderer.domElement.addEventListener('webglcontextrestored', () => { contextLost = false; });

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    rts.setAspect(w / Math.max(1, h));
  }
  window.addEventListener('resize', resize);

  return {
    id: 'renderer',
    kind: 'view',
    critical: true,
    renderer, scene, rts, quality: q, qualityName: quality,
    get camera() { return rts.camera; },
    draw() {
      if (contextLost) return;
      renderer.info.reset();
      renderer.render(scene, rts.camera);
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
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
