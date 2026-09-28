// Player settings: defaults, validation, persistence (localStorage, failure-tolerant).
import { safeParse, assertNoDangerousKeys } from '../core/validate.js';
import { DEFAULT_BINDINGS } from '../input/bindings.js';
import { log } from '../core/logger.js';

const KEY = 'kindlehold.settings.v1';

export const DEFAULT_SETTINGS = {
  quality: 'high',          // low | medium | high
  unlockAllChapters: false,
  cinematics: true,
  masterVolume: 0.6, musicVolume: 0.45, ambienceVolume: 0.7, effectsVolume: 0.8, voiceVolume: 0.7,
  muted: false,
  reducedMotion: false,
  depthOfField: true,       // soft miniature focus at the top and bottom of the view (High quality)
  uiScale: 1,
  edgeScroll: false,
  cameraSpeed: 1,
  tutorialHints: true,
  tutorialDone: false,
  gameSpeed: 1,
  difficulty: 'normal',
  bindings: {},
};

const RANGES = {
  masterVolume: [0, 1], musicVolume: [0, 1], ambienceVolume: [0, 1], effectsVolume: [0, 1], voiceVolume: [0, 1],
  uiScale: [0.8, 1.3], cameraSpeed: [0.4, 2.5], gameSpeed: [0.5, 2],
};

export function sanitizeSettings(raw) {
  const out = { ...DEFAULT_SETTINGS, bindings: {} };
  if (!raw || typeof raw !== 'object') return out;
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    const v = raw[k];
    const d = DEFAULT_SETTINGS[k];
    if (v === undefined) continue;
    if (k === 'bindings') {
      if (v && typeof v === 'object') for (const a of Object.keys(DEFAULT_BINDINGS)) if (typeof v[a] === 'string' && /^[A-Za-z0-9]{1,20}$/.test(v[a])) out.bindings[a] = v[a];
    } else if (typeof d === 'number' && typeof v === 'number' && Number.isFinite(v)) {
      const [lo, hi] = RANGES[k] || [-Infinity, Infinity];
      out[k] = Math.min(hi, Math.max(lo, v));
    } else if (typeof d === 'boolean' && typeof v === 'boolean') out[k] = v;
    else if (k === 'quality' && ['low', 'medium', 'high'].includes(v)) out[k] = v;
    else if (k === 'difficulty' && ['story', 'normal', 'hard'].includes(v)) out[k] = v;
  }
  return out;
}

export function loadSettings() {
  try {
    const text = window.localStorage.getItem(KEY);
    if (!text) return sanitizeSettings(null);
    const parsed = safeParse(text, 20000);
    assertNoDangerousKeys(parsed);
    return sanitizeSettings(parsed);
  } catch (err) {
    log.warn('settings', `could not read settings, using defaults (${err.message})`);
    return sanitizeSettings(null);
  }
}

export function saveSettings(s) {
  try { window.localStorage.setItem(KEY, JSON.stringify(sanitizeSettings(s))); return true; } catch { return false; }
}

export function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
