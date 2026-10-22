// The player's own maps: kept in the browser (localStorage), exported and imported as text.
// Everything read back is untrusted: parsed with a size limit, checked for dangerous keys, then
// normalized and validated (map-format.js). A broken entry is skipped, never thrown at the menu.
import { safeParse, assertNoDangerousKeys } from '../core/validate.js';
import { normalizeMap, validateMap } from './map-format.js';
import { log } from '../core/logger.js';

const KEY = 'kindlehold.maps.v1';
export const MAX_MAPS = 12;
const MAX_TEXT = 60000;
const EXPORT_FORMAT = 'kindlehold-map-1';

function store() { try { return window.localStorage; } catch { return null; } }

function readAll() {
  const s = store();
  if (!s) return [];
  try {
    const doc = safeParse(s.getItem(KEY) || '{"maps":[]}', MAX_TEXT * MAX_MAPS);
    assertNoDangerousKeys(doc);
    const out = [];
    for (const e of Array.isArray(doc.maps) ? doc.maps.slice(0, MAX_MAPS) : []) {
      try { out.push({ id: String(e.id).slice(0, 24), savedAt: Number(e.savedAt) || 0, map: validateMap(normalizeMap(e.map)) }); }
      catch (err) { log.warn('maps', `skipped a broken map: ${err.message}`); }
    }
    return out;
  } catch (err) { log.warn('maps', `could not read your maps: ${err.message}`); return []; }
}

function writeAll(list) {
  const s = store();
  if (!s) throw new Error('This browser keeps no local storage: export the map instead.');
  s.setItem(KEY, JSON.stringify({ maps: list.slice(0, MAX_MAPS) }));
}

/** Your maps, newest first: [{ id, savedAt, map }]. */
export function listMaps() { return readAll().sort((a, b) => b.savedAt - a.savedAt); }

/** Save (or overwrite by id) a map; returns its id. */
export function saveMap(map, id = null) {
  const m = validateMap(normalizeMap(map));
  const list = readAll();
  const key = id && list.some((e) => e.id === id) ? id : `m${Date.now().toString(36)}`;
  const rest = list.filter((e) => e.id !== key);
  if (rest.length >= MAX_MAPS) throw new Error(`At most ${MAX_MAPS} maps: delete one first.`);
  writeAll([{ id: key, savedAt: Date.now(), map: m }, ...rest]);
  return key;
}

export function deleteMap(id) { writeAll(readAll().filter((e) => e.id !== id)); }

/** The map as text to share. */
export function exportMap(map) { return JSON.stringify({ format: EXPORT_FORMAT, map: validateMap(normalizeMap(map)) }); }

/** A shared map from text (throws with a readable message when it is not one). */
export function importMap(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Paste the text of an exported map.');
  const doc = safeParse(text.trim(), MAX_TEXT);
  assertNoDangerousKeys(doc);
  if (!doc || doc.format !== EXPORT_FORMAT) throw new Error('This is not an exported Kindlehold map.');
  return validateMap(normalizeMap(doc.map));
}
