// Uniform-grid spatial hash for mobile and static entities (derived, rebuilt per tick).

export function createSpatialHash(half, cellSize = 8) {
  const cells = Math.ceil((half * 2) / cellSize);
  /** @type {any[][]} */
  const buckets = Array.from({ length: cells * cells }, () => []);
  const used = [];

  function key(x, z) {
    const i = Math.max(0, Math.min(cells - 1, Math.floor((x + half) / cellSize)));
    const j = Math.max(0, Math.min(cells - 1, Math.floor((z + half) / cellSize)));
    return j * cells + i;
  }

  return {
    clear() {
      for (const k of used) buckets[k].length = 0;
      used.length = 0;
    },
    insert(e) {
      const k = key(e.x, e.z);
      if (buckets[k].length === 0) used.push(k);
      buckets[k].push(e);
    },
    /** Push entities within radius into out (cleared first). Deterministic order: by cell then insertion. */
    query(x, z, r, out, filter = null) {
      out.length = 0;
      const i0 = Math.max(0, Math.floor((x - r + half) / cellSize));
      const i1 = Math.min(cells - 1, Math.floor((x + r + half) / cellSize));
      const j0 = Math.max(0, Math.floor((z - r + half) / cellSize));
      const j1 = Math.min(cells - 1, Math.floor((z + r + half) / cellSize));
      const r2 = r * r;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const b = buckets[j * cells + i];
          for (let n = 0; n < b.length; n++) {
            const e = b[n];
            const dx = e.x - x, dz = e.z - z;
            if (dx * dx + dz * dz <= r2 && (!filter || filter(e))) out.push(e);
          }
        }
      }
      return out;
    },
  };
}
