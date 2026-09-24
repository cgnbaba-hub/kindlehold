// Browser save slots (localStorage). Every read goes through deserializeWorld validation.
import { serializeWorld, deserializeWorld } from './index.js';

const PREFIX = 'kindlehold.save.';
export const SLOTS = ['quick', 'slot1', 'slot2', 'slot3', 'auto'];

function store() { try { return window.localStorage; } catch { return null; } }

export function listSaves() {
  const ls = store();
  const out = [];
  for (const slot of SLOTS) {
    let meta = null;
    try {
      const m = ls && ls.getItem(PREFIX + slot + '.meta');
      if (m) meta = JSON.parse(m);
    } catch { meta = null; }
    out.push({ slot, meta: meta && typeof meta === 'object' ? { label: String(meta.label || '').slice(0, 80), tick: Number(meta.tick) || 0, savedAt: String(meta.savedAt || '').slice(0, 40), difficulty: String(meta.difficulty || '').slice(0, 10) } : null });
  }
  return out;
}

export function saveToSlot(world, slot, label = '') {
  if (!SLOTS.includes(slot)) throw new Error('invalid slot');
  const ls = store();
  if (!ls) throw new Error('Browser storage is not available (private mode?)');
  const text = serializeWorld(world, label);
  ls.setItem(PREFIX + slot, text);
  ls.setItem(PREFIX + slot + '.meta', JSON.stringify({ label, tick: world.tick, savedAt: new Date().toISOString(), difficulty: world.meta.difficulty }));
  return text.length;
}

export function loadFromSlot(slot) {
  if (!SLOTS.includes(slot)) throw new Error('invalid slot');
  const ls = store();
  const text = ls && ls.getItem(PREFIX + slot);
  if (!text) throw new Error('That save slot is empty');
  return deserializeWorld(text);
}

export function hasAnySave() { return listSaves().some((s) => s.meta); }

export function latestSave() {
  return listSaves().filter((s) => s.meta).sort((a, b) => (b.meta.savedAt > a.meta.savedAt ? 1 : -1))[0] || null;
}

export function deleteSlot(slot) { const ls = store(); if (ls && SLOTS.includes(slot)) { ls.removeItem(PREFIX + slot); ls.removeItem(PREFIX + slot + '.meta'); } }
