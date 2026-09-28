// Map registry: every scenario names the map it is played on.
import { HARROWMERE_MAP } from './harrowmere.js';
import { SALTMERE_MAP } from './saltmere.js';

export const MAPS = { harrowmere: HARROWMERE_MAP, saltmere: SALTMERE_MAP };
export function mapById(id) { return Object.hasOwn(MAPS, id) ? MAPS[id] : HARROWMERE_MAP; }
