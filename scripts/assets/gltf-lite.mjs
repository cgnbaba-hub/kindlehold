// Minimal GLB + PNG readers for the asset baker (no dependencies): enough for the KayKit packs.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  let off = 12, json = null, bin = null;
  while (off < b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4);
    const chunk = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  return withReader(json, bin);
}

/** A .gltf file with its single external .bin buffer (as in the KayKit hexagon pack). */
export function readGltf(file) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const uri = json.buffers && json.buffers[0] && json.buffers[0].uri;
  if (!uri || uri.startsWith('data:')) throw new Error(`${file}: expected one external buffer`);
  const bin = fs.readFileSync(path.join(path.dirname(file), decodeURIComponent(uri)));
  return withReader(json, bin);
}

function withReader(json, bin) {
  const gltf = json;
  /** Typed copy of an accessor (normalized integer data is left as integers). */
  gltf.read = (i) => {
    const a = gltf.accessors[i];
    const bv = gltf.bufferViews[a.bufferView];
    const T = COMP[a.componentType], n = SIZE[a.type];
    const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const stride = bv.byteStride || n * T.BYTES_PER_ELEMENT;
    const out = new T(a.count * n);
    const dv = new DataView(bin.buffer, bin.byteOffset);
    for (let k = 0; k < a.count; k++) {
      for (let c = 0; c < n; c++) {
        const p = start + k * stride + c * T.BYTES_PER_ELEMENT;
        out[k * n + c] = T === Float32Array ? dv.getFloat32(p, true) : T === Uint16Array ? dv.getUint16(p, true) : T === Uint32Array ? dv.getUint32(p, true) : T === Uint8Array ? dv.getUint8(p) : T === Int16Array ? dv.getInt16(p, true) : dv.getInt8(p);
      }
    }
    return { data: out, count: a.count, size: n, normalized: !!a.normalized, componentType: a.componentType };
  };
  return gltf;
}

/** Decode an 8-bit, non-interlaced PNG (RGB or RGBA) to { width, height, rgba }. */
export function readPng(file) {
  const b = fs.readFileSync(file);
  let off = 8, width = 0, height = 0, colorType = 0, bitDepth = 0;
  const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off), type = b.toString('ascii', off + 4, off + 8);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; if (data[12]) throw new Error('interlaced PNG'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error(`${file}: unsupported PNG (depth ${bitDepth}, type ${colorType})`);
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rgba = new Uint8Array(width * height * 4);
  const line = width * bpp;
  let prev = new Uint8Array(line), cur = new Uint8Array(line);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (line + 1)];
    const src = raw.subarray(y * (line + 1) + 1, (y + 1) * (line + 1));
    for (let x = 0; x < line; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, up = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      cur[x] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      rgba[o] = cur[x * bpp]; rgba[o + 1] = cur[x * bpp + 1]; rgba[o + 2] = cur[x * bpp + 2]; rgba[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255;
    }
    [prev, cur] = [cur, prev];
  }
  return { width, height, rgba };
}
