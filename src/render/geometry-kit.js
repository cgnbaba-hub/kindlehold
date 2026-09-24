// Small procedural modelling kit: vertex-coloured primitives merged into one geometry.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();

/** Paint every vertex of a (non-indexed-or-indexed) geometry with a colour, optionally jittered. */
export function paint(geo, color, jitter = 0, rnd = null, pattern = 0) {
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  const pat = new Float32Array(n);
  _c.set(color);
  for (let i = 0; i < n; i++) {
    const j = jitter && rnd ? 1 + (rnd() - 0.5) * jitter : 1;
    col[i * 3] = _c.r * j; col[i * 3 + 1] = _c.g * j; col[i * 3 + 2] = _c.b * j;
    pat[i] = pattern;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('pattern', new THREE.BufferAttribute(pat, 1));
  return geo;
}

/** Vertical gradient colouring (bottom -> top). */
export function paintGradient(geo, bottom, top, pattern = 0) {
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const a = new THREE.Color(bottom), b = new THREE.Color(top);
  const col = new Float32Array(pos.count * 3);
  const pat = new Float32Array(pos.count).fill(pattern);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - min.y) / Math.max(1e-6, max.y - min.y);
    _c.copy(a).lerp(b, t);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('pattern', new THREE.BufferAttribute(pat, 1));
  return geo;
}

export function place(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  geo.applyMatrix4(m);
  return geo;
}

/** Displace vertices radially with deterministic noise (for rocks, foliage). */
export function jitterVertices(geo, amount, rnd) {
  const pos = geo.attributes.position;
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let d = map.get(key);
    if (!d) { d = [(rnd() - 0.5) * amount, (rnd() - 0.5) * amount, (rnd() - 0.5) * amount]; map.set(key, d); }
    pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
  }
  pos.needsUpdate = true;
  return geo;
}

/** Merge parts; all parts must carry position/normal/color/pattern attributes. */
export function merge(parts) {
  const prepared = parts.map((g) => {
    let geo = g.index ? g.toNonIndexed() : g;
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.pattern) geo.setAttribute('pattern', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
    return geo;
  });
  const out = mergeGeometries(prepared, false);
  out.computeBoundingSphere();
  return out;
}

/** Simple seeded generator for view-side geometry variation (never used by simulation). */
export function viewRng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; s ^= s >>> 12; return (s >>> 0) / 4294967296; };
}

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const cone = (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg);
export const ico = (r, detail = 0) => new THREE.IcosahedronGeometry(r, detail);
export const sphere = (r, w = 8, h = 6, ...rest) => new THREE.SphereGeometry(r, w, h, ...rest);

/** Gable roof prism: width (x), depth (z), ridge height; eaves overhang included by caller. */
export function gable(w, d, h) {
  const hw = w / 2, hd = d / 2;
  const v = [
    // left slope
    -hw, 0, -hd, 0, h, -hd, 0, h, hd, -hw, 0, -hd, 0, h, hd, -hw, 0, hd,
    // right slope
    hw, 0, hd, 0, h, hd, 0, h, -hd, hw, 0, hd, 0, h, -hd, hw, 0, -hd,
    // front gable
    -hw, 0, hd, 0, h, hd, hw, 0, hd,
    // back gable
    hw, 0, -hd, 0, h, -hd, -hw, 0, -hd,
    // bottom
    -hw, 0, -hd, hw, 0, hd, hw, 0, -hd, -hw, 0, -hd, -hw, 0, hd, hw, 0, hd,
  ];
  return orientOutward(v, 0, h / 3, 0);
}

/** Build a geometry whose triangles all face away from (cx, cy, cz). */
function orientOutward(v, cx, cy, cz) {
  for (let i = 0; i < v.length; i += 9) {
    const ax = v[i], ay = v[i + 1], az = v[i + 2];
    const e1 = [v[i + 3] - ax, v[i + 4] - ay, v[i + 5] - az], e2 = [v[i + 6] - ax, v[i + 7] - ay, v[i + 8] - az];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const mx = (ax + v[i + 3] + v[i + 6]) / 3 - cx, my = (ay + v[i + 4] + v[i + 7]) / 3 - cy, mz = (az + v[i + 5] + v[i + 8]) / 3 - cz;
    if (n[0] * mx + n[1] * my + n[2] * mz < 0) {
      for (let k = 0; k < 3; k++) { const t = v[i + 3 + k]; v[i + 3 + k] = v[i + 6 + k]; v[i + 6 + k] = t; }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/** Hip/pyramid roof over a rectangle. */
export function pyramid(w, d, h) {
  const hw = w / 2, hd = d / 2;
  const v = [
    -hw, 0, hd, hw, 0, hd, 0, h, 0,
    hw, 0, hd, hw, 0, -hd, 0, h, 0,
    hw, 0, -hd, -hw, 0, -hd, 0, h, 0,
    -hw, 0, -hd, -hw, 0, hd, 0, h, 0,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}
