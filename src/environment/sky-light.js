// Sky dome, sun/moon directional light, hemisphere fill, fog — driven by time of day.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

const KEYS = [
  // hour, sun colour, sun intensity, hemi sky, hemi ground, hemi intensity, fog colour, exposure
  [0, '#8fa6d6', 0.32, '#2a3a5c', '#141820', 0.55, '#141c2a', 0.95],
  [4.5, '#8fa6d6', 0.3, '#2a3a5c', '#141820', 0.5, '#1a2230', 0.95],
  [5.6, '#ff9a6a', 0.9, '#6f7fa8', '#3a3228', 0.55, '#8a7f86', 0.95],
  [7, '#ffc58c', 2.3, '#a9c3e2', '#5a5038', 0.75, '#c2c4c0', 0.9],
  [10, '#fff1dc', 3.1, '#b9d2ee', '#5f5a42', 0.85, '#c9d4dc', 0.85],
  [14, '#fff3e2', 3.1, '#b9d2ee', '#5f5a42', 0.85, '#c9d4dc', 0.85],
  [17.2, '#ffcf96', 2.4, '#a8bedc', '#5a4e38', 0.75, '#d0c6b4', 0.9],
  [18.6, '#ff8a4a', 1.2, '#7c7fa6', '#3a2e26', 0.6, '#a0807a', 0.95],
  [19.6, '#a7b4e0', 0.35, '#34426a', '#171a22', 0.5, '#2a3040', 0.95],
  [24, '#8fa6d6', 0.32, '#2a3a5c', '#141820', 0.55, '#141c2a', 0.95],
];

const ca = new THREE.Color(), cb = new THREE.Color();
function lerpColor(out, a, b, t) { ca.set(a); cb.set(b); out.copy(ca).lerp(cb, t); return out; }

export function createSkyLight({ scene, renderer, quality }) {
  const sky = new Sky();
  sky.scale.setScalar(4000);
  const u = sky.material.uniforms;
  u.turbidity.value = 4.5;
  u.rayleigh.value = 1.6;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.82;
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = !!quality.shadows;
  if (quality.shadows) {
    sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.35;
    sun.shadow.radius = 2;
  }
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight('#b9d2ee', '#5f5a42', 0.8);
  scene.add(hemi);

  scene.fog = new THREE.FogExp2('#c9d4dc', 0.0026);

  // stars (fixed seeded pattern, only visible at night)
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(900 * 3);
  let s = 12345;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 900; i++) {
    const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 0.95);
    starPos[i * 3] = Math.sin(ph) * Math.cos(th) * 1800;
    starPos[i * 3 + 1] = Math.cos(ph) * 1800;
    starPos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 1800;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: '#dfe6ff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  const sunDir = new THREE.Vector3();
  const col = new THREE.Color();
  const col2 = new THREE.Color();
  let hour = 10;
  let nightFactor = 0;
  const shadowCenter = new THREE.Vector3();

  function sample(h) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0])));
    return { a, b, t };
  }

  function apply() {
    const { a, b, t } = sample(hour);
    // sun path: rises east (+x) at 6h, sets west at 18h, tilted south (+z)
    const ang = ((hour - 6) / 12) * Math.PI;
    const elev = Math.sin(ang);
    const isDay = elev > -0.05;
    if (isDay) sunDir.set(Math.cos(ang), Math.max(elev, 0.02) * 0.95, 0.42).normalize();
    else {
      // moon: opposite arc
      const mang = ((hour + 6) / 12) * Math.PI;
      sunDir.set(Math.cos(mang), Math.max(Math.sin(mang), 0.25), 0.3).normalize();
    }
    u.sunPosition.value.set(Math.cos(ang), elev, 0.42).normalize();
    nightFactor = Math.min(1, Math.max(0, (-elev + 0.05) / 0.25));
    lerpColor(sun.color, a[1], b[1], t);
    sun.intensity = a[2] + (b[2] - a[2]) * t;
    lerpColor(hemi.color, a[3], b[3], t);
    lerpColor(hemi.groundColor, a[4], b[4], t);
    hemi.intensity = a[5] + (b[5] - a[5]) * t;
    lerpColor(scene.fog.color, a[6], b[6], t);
    renderer.toneMappingExposure = a[7] + (b[7] - a[7]) * t;
    starMat.opacity = nightFactor * 0.9;
    sky.visible = nightFactor < 0.98;
    u.rayleigh.value = 1.6 - nightFactor * 1.2;
    // night background colour when sky dome is faded
    scene.background = nightFactor > 0.98 ? lerpColor(col2, '#0b1120', '#0b1120', 0) : null;
    col.copy(scene.fog.color);
  }

  const api = {
    id: 'environment-sky',
    kind: 'view',
    sun, hemi, sky,
    get hour() { return hour; },
    get nightFactor() { return nightFactor; },
    setHour(h) { hour = ((h % 24) + 24) % 24; apply(); },
    /** Keep the shadow camera fitted around the view target. */
    fitShadow(cx, cz, radius) {
      shadowCenter.set(cx, 0, cz);
      sun.position.copy(shadowCenter).addScaledVector(sunDir, 160);
      sun.target.position.copy(shadowCenter);
      sun.target.updateMatrixWorld();
      if (sun.castShadow) {
        const cam = sun.shadow.camera;
        const r = radius;
        if (cam.right !== r) {
          cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
          cam.near = 20; cam.far = 360;
          cam.updateProjectionMatrix();
        }
      }
    },
    render() {},
    dispose() {
      scene.remove(sky, sun, sun.target, hemi, stars);
      sky.material.dispose(); sky.geometry.dispose();
      starGeo.dispose(); starMat.dispose();
      sun.dispose();
    },
  };
  apply();
  return api;
}
