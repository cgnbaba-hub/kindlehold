// Winter presentation: follows the simulated season (world.weather) and drives the snow
// cover on ground, roofs and trees, the river ice, falling snow and a colder light.
// View-only: reads the world, never changes it.
import * as THREE from 'three';
import { SNOW } from '../render/structure-material.js';

const FALL_BOX = { w: 150, h: 46 };

export function createWinter({ scene, world, terrainView, water, sky, quality, getTarget, reducedMotion = () => false }) {
  const count = quality && quality.pixelRatio < 1 ? 1400 : 3200;
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  let r = 20260926;
  const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * FALL_BOX.w;
    pos[i * 3 + 1] = rnd() * FALL_BOX.h;
    pos[i * 3 + 2] = (rnd() - 0.5) * FALL_BOX.w;
    seed[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const uniforms = {
    uTime: { value: 0 }, uOrigin: { value: new THREE.Vector3() }, uAlpha: { value: 0 },
    uBox: { value: new THREE.Vector2(FALL_BOX.w, FALL_BOX.h) }, uScale: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: false,
    vertexShader: `
uniform float uTime; uniform vec3 uOrigin; uniform vec2 uBox; uniform float uScale;
attribute float seed; varying float vA;
void main() {
  vec3 p = position;
  float fall = 1.4 + seed * 1.3;
  p.y = mod(p.y - uTime * fall, uBox.y);
  p.x += sin(uTime * (0.6 + seed) + seed * 40.0) * 1.2 + uTime * 0.5;
  p.z += cos(uTime * (0.5 + seed * 0.7) + seed * 17.0) * 1.0;
  // wrap the flake box around the camera target so snow falls wherever the player looks
  p.xz = mod(p.xz - uOrigin.xz + uBox.x * 0.5, uBox.x) - uBox.x * 0.5 + uOrigin.xz;
  p.y += uOrigin.y;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp((2.0 + seed * 2.2) * uScale * 120.0 / -mv.z, 1.0, 7.0);
  vA = 0.55 + seed * 0.45;
}`,
    fragmentShader: `
uniform float uAlpha; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  gl_FragColor = vec4(0.96, 0.97, 1.0, uAlpha * vA * (1.0 - d * 3.2));
}`,
  });
  const flakes = new THREE.Points(geo, mat);
  flakes.frustumCulled = false;
  flakes.renderOrder = 5;
  flakes.visible = false;
  flakes.name = 'snowfall';
  scene.add(flakes);

  let snow = -1, ice = -1;
  const cold = new THREE.Color('#c9d6e6');
  const coldFog = new THREE.Color('#b8c4d0');
  let t = 0;

  function sync(dt, immediate = false) {
    const w = world().weather || {};
    const tSnow = w.snow || 0;
    const tIce = w.frozen ? 1 : 0;
    const k = immediate ? 1 : Math.min(1, dt * 1.5);
    snow = snow < 0 ? tSnow : snow + (tSnow - snow) * k;
    ice = ice < 0 ? tIce : ice + (tIce - ice) * Math.min(1, immediate ? 1 : dt * 0.5);
    SNOW.value = snow;
    terrainView.setSnow(snow);
    water.setIce(ice);
    return w;
  }

  return {
    id: 'environment-winter',
    kind: 'view',
    flakes,
    render(alpha, frame) {
      const w = sync(frame.dt || 0);
      // colder, flatter light while snow lies (applied after the sky set the time of day)
      if (snow > 0.001) {
        const k = snow * 0.55;
        sky.sun.color.lerp(cold, k);
        sky.hemi.groundColor.lerp(cold, snow * 0.7);
        sky.hemi.intensity *= 1 + snow * 0.15;
        sky.sun.intensity *= 1 - snow * 0.12;
        if (scene.fog) { scene.fog.color.lerp(coldFog, snow * 0.4 * (1 - sky.nightFactor)); if (scene.background && scene.background.isColor) scene.background.copy(scene.fog.color); }
      }
      const fall = (w.intensity || 0) * (w.kind === 'snow' ? 1 : 0);
      flakes.visible = fall > 0.01 && !reducedMotion();
      if (flakes.visible) {
        t += frame.dt || 0;
        const tg = getTarget();
        uniforms.uTime.value = t;
        uniforms.uOrigin.value.set(tg.x, tg.y - 4, tg.z);
        uniforms.uAlpha.value = fall * 0.85;
        uniforms.uScale.value = tg.scale || 1;
      }
    },
    /** Snap to the current season (used after loads and for screenshot presets). */
    snap() { sync(0, true); },
    dispose() { scene.remove(flakes); geo.dispose(); mat.dispose(); SNOW.value = 0; },
  };
}
