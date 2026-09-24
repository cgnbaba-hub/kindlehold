// Deterministic world hash (FNV-1a over canonical JSON) for determinism tests and replays.

export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function canonical(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number') return Number.isFinite(value) ? String(Math.round(value * 1e6) / 1e6) : 'null';
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}

export function worldHash(world) { return hashString(canonical(world)); }
