// Frame-time telemetry: fixed-size ring buffer, no per-frame allocation.

export function createFrameStats(capacity = 600) {
  const times = new Float32Array(capacity);
  const simTimes = new Float32Array(capacity);
  let count = 0, head = 0;
  let simHead = 0, simCount = 0;
  const scratch = new Float32Array(capacity);

  function percentile(buf, n, p) {
    if (n === 0) return 0;
    for (let i = 0; i < n; i++) scratch[i] = buf[i];
    const view = scratch.subarray(0, n);
    view.sort();
    const idx = Math.min(n - 1, Math.max(0, Math.round((p / 100) * (n - 1))));
    return view[idx];
  }

  return {
    pushFrame(ms) {
      times[head] = ms;
      head = (head + 1) % capacity;
      if (count < capacity) count++;
    },
    pushSim(ms) {
      simTimes[simHead] = ms;
      simHead = (simHead + 1) % capacity;
      if (simCount < capacity) simCount++;
    },
    reset() { count = 0; head = 0; simCount = 0; simHead = 0; },
    summary() {
      let sum = 0;
      for (let i = 0; i < count; i++) sum += times[i];
      const mean = count ? sum / count : 0;
      let ssum = 0;
      for (let i = 0; i < simCount; i++) ssum += simTimes[i];
      return {
        frames: count,
        fps: mean > 0 ? 1000 / mean : 0,
        frameMs: { mean, p50: percentile(times, count, 50), p95: percentile(times, count, 95), p99: percentile(times, count, 99) },
        simMs: { samples: simCount, mean: simCount ? ssum / simCount : 0, p95: percentile(simTimes, simCount, 95) },
      };
    },
  };
}
