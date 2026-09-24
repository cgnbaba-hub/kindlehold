// RTS camera rig: orbit around a ground target with yaw + zoom; pitch follows zoom.
import * as THREE from 'three';

export const CAMERA_PRESETS = {
  'overview': { x: -10, z: 10, yaw: 0.55, zoom: 150 },
  'settlement': { x: -44, z: 50, yaw: 0.6, zoom: 60 },
  'settlement-close': { x: -44, z: 48, yaw: 0.9, zoom: 34 },
  'production': { x: -46, z: 66, yaw: 0.3, zoom: 46 },
  'construction': { x: -30, z: 40, yaw: 1.1, zoom: 30 },
  'combat': { x: -24, z: 24, yaw: 0.2, zoom: 52 },
  'hero': { x: -30, z: 30, yaw: 0.8, zoom: 30 },
  'raid': { x: -20, z: 24, yaw: 0.35, zoom: 70 },
  'enemy-camp': { x: 70, z: -66, yaw: 3.6, zoom: 60 },
  'ford': { x: 22, z: -4, yaw: 0.4, zoom: 55 },
  'showcase': { x: 0, z: 0, yaw: 0.6, zoom: 40 },
};

const MIN_ZOOM = 16, MAX_ZOOM = 170;

export function createRtsCamera({ aspect = 16 / 9, terrain = null } = {}) {
  const camera = new THREE.PerspectiveCamera(40, aspect, 0.5, 1600);
  const state = { x: 0, z: 0, yaw: 0.6, zoom: 60, tx: 0, tz: 0, tyaw: 0.6, tzoom: 60 };
  const bounds = terrain ? terrain.half - 12 : 200;
  const tmp = new THREE.Vector3();

  function pitchFor(zoom) {
    const t = (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
    return 0.62 + t * 0.4; // radians from horizontal: ~35° close, ~59° far
  }

  function apply() {
    const pitch = pitchFor(state.zoom);
    const gy = terrain ? Math.max(terrain.height(state.x, state.z), 0) : 0;
    const horiz = Math.cos(pitch) * state.zoom;
    camera.position.set(
      state.x + Math.sin(state.yaw) * horiz,
      gy + Math.sin(pitch) * state.zoom,
      state.z + Math.cos(state.yaw) * horiz,
    );
    tmp.set(state.x, gy + 1, state.z);
    camera.lookAt(tmp);
    camera.updateMatrixWorld();
  }

  const api = {
    camera,
    state,
    setAspect(a) { camera.aspect = a; camera.updateProjectionMatrix(); },
    setPreset(name) {
      const p = CAMERA_PRESETS[name];
      if (!p) return false;
      api.jumpTo(p.x, p.z, p.yaw, p.zoom);
      return true;
    },
    jumpTo(x, z, yaw = state.yaw, zoom = state.zoom) {
      state.x = state.tx = x; state.z = state.tz = z;
      state.yaw = state.tyaw = yaw; state.zoom = state.tzoom = zoom;
      apply();
    },
    focus(x, z) { state.tx = x; state.tz = z; },
    pan(dx, dz) {
      // dx = screen right, dz = screen forward (metres at zoom 60)
      const s = state.tzoom / 60;
      const c = Math.cos(state.tyaw), sn = Math.sin(state.tyaw);
      // right = (c, -sn), forward (towards the look direction) = (-sn, -c)
      state.tx += (dx * c - dz * sn) * s;
      state.tz += (-dx * sn - dz * c) * s;
      state.tx = Math.max(-bounds, Math.min(bounds, state.tx));
      state.tz = Math.max(-bounds, Math.min(bounds, state.tz));
    },
    /** Grab-pan: move the view immediately by a world-space delta (no easing). */
    panWorld(dx, dz) {
      const nx = Math.max(-bounds, Math.min(bounds, state.tx + dx)), nz = Math.max(-bounds, Math.min(bounds, state.tz + dz));
      state.x += nx - state.tx; state.z += nz - state.tz;
      state.tx = nx; state.tz = nz;
      apply();
    },
    rotate(d) { state.tyaw += d; },
    zoomBy(f) { state.tzoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.tzoom * f)); },
    update(dt, reducedMotion = false) {
      const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 10);
      state.x += (state.tx - state.x) * k;
      state.z += (state.tz - state.z) * k;
      state.yaw += (state.tyaw - state.yaw) * k;
      state.zoom += (state.tzoom - state.zoom) * k;
      apply();
    },
    serialize() { return { x: state.tx, z: state.tz, yaw: state.tyaw, zoom: state.tzoom }; },
  };
  apply();
  return api;
}
