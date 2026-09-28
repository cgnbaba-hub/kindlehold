// Campaign progress (browser only): which chapters are open and what the player decided.
// Kept apart from save games so starting a chapter fresh still remembers earlier choices.
import { CAMPAIGN } from '../missions/index.js';
import { stance } from '../diplomacy/index.js';

const KEY = 'kindlehold.campaign.v1';
const EMPTY = () => ({ unlocked: 1, done: {}, greyfen: null });

export function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return EMPTY();
    const done = {};
    for (const id of CAMPAIGN) if (raw.done && raw.done[id] === true) done[id] = true;
    return {
      unlocked: Math.max(1, Math.min(CAMPAIGN.length, Number.isInteger(raw.unlocked) ? raw.unlocked : 1)),
      done,
      greyfen: ['allied', 'defeated'].includes(raw.greyfen) ? raw.greyfen : null,
    };
  } catch { return EMPTY(); }
}

function saveProgress(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: progress lives for this visit only */ } }

/** A chapter was won: open the next one and remember the choices it settled. */
export function recordVictory(world) {
  const p = loadProgress();
  const id = world.meta.scenarioId;
  const i = CAMPAIGN.indexOf(id);
  if (i < 0) return p;
  p.done[id] = true;
  p.unlocked = Math.max(p.unlocked, Math.min(CAMPAIGN.length, i + 2));
  if (id === 'greyfen') {
    const f = world.mission.flags;
    p.greyfen = f.greyfenDefeated ? 'defeated' : (f.greyfenAllied || stance(world, 'p1', 'p3') === 'allied') ? 'allied' : p.greyfen;
  }
  saveProgress(p);
  return p;
}

/** What a chapter should know about the ones before it. */
export function campaignMemory(p = loadProgress()) {
  return p.greyfen ? { greyfen: p.greyfen } : null;
}

export function isUnlocked(id, p = loadProgress(), unlockAll = false) {
  return unlockAll || CAMPAIGN.indexOf(id) < p.unlocked;
}
