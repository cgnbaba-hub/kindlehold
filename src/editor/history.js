// Undo and redo for the map editor: snapshots of the map being edited (as text), one per gesture.
// The editor marks the state *before* each change; a run of small changes of the same kind (a
// slider being dragged, the wheel turning) is one step.

export const GROUP_MS = 900;

export function createHistory(limit = 80) {
  const past = [], future = [];
  let lastKey = null, lastAt = 0;
  // (a step that changed nothing, like a click at a limit, is skipped)
  const take = (from, to, current) => {
    let s = from.pop();
    while (s !== undefined && s === current) s = from.pop();
    if (s === undefined) return null;
    to.push(current);
    lastKey = null;
    return s;
  };
  return {
    /** Remember `snap`, the state before a change. Same `key` again within GROUP_MS: same step. */
    mark(snap, key = null, now = 0) {
      future.length = 0;
      if (key && key === lastKey && now - lastAt < GROUP_MS) { lastAt = now; return; }
      lastKey = key; lastAt = now;
      if (past[past.length - 1] === snap) return;
      past.push(snap);
      if (past.length > limit) past.shift();
    },
    /** The state to go back to (null: nothing to undo). `current` is kept for redo. */
    undo: (current) => take(past, future, current),
    redo: (current) => take(future, past, current),
    canUndo: (current) => past.some((s) => s !== current),
    canRedo: (current) => future.some((s) => s !== current),
    clear() { past.length = 0; future.length = 0; lastKey = null; },
  };
}
