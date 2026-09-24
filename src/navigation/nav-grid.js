// Navigation grid (2 m cells) + budgeted A* with string pulling. Pure simulation code.

export const CELL = 2;
const SQRT2 = Math.SQRT2;
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2]];

export function createNavGrid(terrain, { maxExpansions = 6000 } = {}) {
  const half = terrain.half;
  const w = Math.floor((half * 2) / CELL);
  const n = w * w;
  const staticBlocked = new Uint8Array(n);
  const blockCount = new Uint16Array(n); // dynamic obstacles (building footprints), ref-counted
  const cost = new Float32Array(n);

  for (let j = 0; j < w; j++) {
    for (let i = 0; i < w; i++) {
      const x = -half + (i + 0.5) * CELL, z = -half + (j + 0.5) * CELL;
      const depth = terrain.waterDepth(x, z);
      const slope = terrain.slope(x, z);
      const edge = i === 0 || j === 0 || i === w - 1 || j === w - 1;
      const k = j * w + i;
      staticBlocked[k] = edge || depth > 0.55 || slope > 0.95 ? 1 : 0;
      cost[k] = 1 + slope * 1.5 + (depth > 0.05 ? 1.5 : 0);
    }
  }

  // A* scratch (reused; no per-request allocation except the output path)
  const g = new Float32Array(n);
  const f = new Float32Array(n);
  const parent = new Int32Array(n);
  const stamp = new Uint32Array(n);
  const closed = new Uint32Array(n);
  const heap = new Int32Array(n + 1);
  let heapSize = 0;
  let searchId = 1;

  function heapPush(k) {
    let i = ++heapSize;
    heap[i] = k;
    while (i > 1) {
      const p = i >> 1;
      if (f[heap[p]] <= f[heap[i]]) break;
      const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p;
    }
  }
  function heapPop() {
    const top = heap[1];
    heap[1] = heap[heapSize--];
    let i = 1;
    for (;;) {
      const l = i * 2, r = l + 1;
      let m = i;
      if (l <= heapSize && f[heap[l]] < f[heap[m]]) m = l;
      if (r <= heapSize && f[heap[r]] < f[heap[m]]) m = r;
      if (m === i) break;
      const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
    }
    return top;
  }

  const cellOf = (x) => Math.max(0, Math.min(w - 1, Math.floor((x + half) / CELL)));
  const centre = (i) => -half + (i + 0.5) * CELL;
  const walkableK = (k) => staticBlocked[k] === 0 && blockCount[k] === 0;
  function walkable(x, z) { return walkableK(cellOf(z) * w + cellOf(x)); }

  function nearestWalkable(ci, cj, maxR = 8) {
    if (walkableK(cj * w + ci)) return cj * w + ci;
    for (let r = 1; r <= maxR; r++) {
      let best = -1, bestD = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= w || j >= w) continue;
          const k = j * w + i;
          if (!walkableK(k)) continue;
          const d = di * di + dj * dj;
          if (d < bestD) { bestD = d; best = k; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  function lineWalkable(ax, az, bx, bz) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(dist / (CELL * 0.4));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (!walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  const stats = { requests: 0, expansions: 0, partial: 0, failed: 0 };

  /**
   * @returns {{points:number[][], partial:boolean}|null} null when no route at all
   */
  function findPath(sx, sz, tx, tz) {
    stats.requests++;
    const si = cellOf(sx), sj = cellOf(sz);
    let start = nearestWalkable(si, sj, 4);
    const goal = nearestWalkable(cellOf(tx), cellOf(tz), 10);
    if (start < 0 || goal < 0) { stats.failed++; return null; }
    const goalI = goal % w, goalJ = (goal / w) | 0;
    const gx = centre(goalI), gz = centre(goalJ);
    if (start === goal) return { points: [[walkableK(cellOf(tz) * w + cellOf(tx)) ? tx : gx, walkableK(cellOf(tz) * w + cellOf(tx)) ? tz : gz]], partial: false };

    searchId++;
    heapSize = 0;
    const h = (k) => {
      const di = Math.abs((k % w) - goalI), dj = Math.abs(((k / w) | 0) - goalJ);
      return (di + dj + (SQRT2 - 2) * Math.min(di, dj)) * 1.0;
    };
    g[start] = 0; f[start] = h(start); parent[start] = -1; stamp[start] = searchId;
    heapPush(start);
    let best = start, bestH = f[start];
    let expansions = 0;
    let found = false;
    while (heapSize > 0) {
      const k = heapPop();
      if (closed[k] === searchId) continue;
      closed[k] = searchId;
      if (k === goal) { found = true; break; }
      if (++expansions > maxExpansions) break;
      const ki = k % w, kj = (k / w) | 0;
      const hk = f[k] - g[k];
      if (hk < bestH) { bestH = hk; best = k; }
      for (let d = 0; d < 8; d++) {
        const ni = ki + DIRS[d][0], nj = kj + DIRS[d][1];
        if (ni < 0 || nj < 0 || ni >= w || nj >= w) continue;
        const nk = nj * w + ni;
        if (!walkableK(nk) || closed[nk] === searchId) continue;
        if (d >= 4 && (!walkableK(kj * w + ni) || !walkableK(nj * w + ki))) continue; // no corner cutting
        const ng = g[k] + DIRS[d][2] * (cost[k] + cost[nk]) * 0.5;
        if (stamp[nk] !== searchId || ng < g[nk]) {
          stamp[nk] = searchId; g[nk] = ng; f[nk] = ng + h(nk); parent[nk] = k;
          heapPush(nk);
        }
      }
    }
    stats.expansions += expansions;
    const end = found ? goal : best;
    if (!found) stats.partial++;
    // reconstruct
    const cells = [];
    for (let k = end; k !== -1; k = parent[k]) cells.push(k);
    cells.reverse();
    // string pulling
    const pts = [];
    let ax = sx, az = sz;
    let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      for (; j > i + 1; j--) {
        const cx = centre(cells[j] % w), cz = centre((cells[j] / w) | 0);
        if (lineWalkable(ax, az, cx, cz)) break;
      }
      const cx = centre(cells[j] % w), cz = centre((cells[j] / w) | 0);
      pts.push([cx, cz]);
      ax = cx; az = cz; i = j;
    }
    if (found) {
      const tWalk = walkable(tx, tz);
      if (pts.length === 0) pts.push([tWalk ? tx : gx, tWalk ? tz : gz]);
      else if (tWalk) pts[pts.length - 1] = [tx, tz];
    }
    if (pts.length === 0) pts.push([centre(end % w), centre((end / w) | 0)]);
    return { points: pts, partial: !found };
  }

  function forCircle(x, z, r, fn) {
    const i0 = cellOf(x - r), i1 = cellOf(x + r), j0 = cellOf(z - r), j1 = cellOf(z + r);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = centre(i), cz = centre(j);
      if ((cx - x) ** 2 + (cz - z) ** 2 <= r * r) fn(j * w + i);
    }
  }

  return {
    w, half, cell: CELL, stats,
    walkable,
    isStaticBlocked: (x, z) => staticBlocked[cellOf(z) * w + cellOf(x)] === 1,
    findPath,
    lineWalkable,
    block(x, z, r) { forCircle(x, z, r, (k) => { blockCount[k]++; }); },
    unblock(x, z, r) { forCircle(x, z, r, (k) => { if (blockCount[k] > 0) blockCount[k]--; }); },
    clearDynamic() { blockCount.fill(0); },
    /** Nearest walkable point to (x,z) or null. */
    nearestWalkablePoint(x, z, maxR = 10) {
      const k = nearestWalkable(cellOf(x), cellOf(z), maxR);
      if (k < 0) return null;
      if (walkableK(cellOf(z) * w + cellOf(x))) return { x, z };
      return { x: centre(k % w), z: centre((k / w) | 0) };
    },
  };
}
