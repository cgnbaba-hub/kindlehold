// Map registry: every scenario names the map it is played on. The generated 'wild' map is built
// from the world's seed, so a save rebuilds the same valley without storing it.
import { HARROWMERE_MAP } from './harrowmere.js';
import { SALTMERE_MAP } from './saltmere.js';
import { WHITEHART_MAP } from './whitehart.js';
import { IRONMARCH_MAP } from './ironmarch.js';
import { generateWildMap } from './wild.js';

export const MAPS = { harrowmere: HARROWMERE_MAP, saltmere: SALTMERE_MAP, whitehart: WHITEHART_MAP, ironmarch: IRONMARCH_MAP };
const wild = new Map();
export function mapById(id, seed = 1) {
  if (id === 'wild') {
    const key = String(seed);
    if (!wild.has(key)) { if (wild.size > 8) wild.clear(); wild.set(key, generateWildMap(seed)); }
    return wild.get(key);
  }
  return Object.hasOwn(MAPS, id) ? MAPS[id] : HARROWMERE_MAP;
}
/** The key a map's derived data (terrain) is cached under. */
export function mapKey(map) { return map.id === 'wild' ? `wild:${map.seed}` : map.id; }
