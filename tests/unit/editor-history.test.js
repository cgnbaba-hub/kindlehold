// Undo and redo in the map editor: one step per gesture, steps that changed nothing are skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, GROUP_MS } from '../../src/editor/history.js';

test('undo goes back step by step, redo forward again; a new change forgets what was undone', () => {
  const hi = createHistory();
  assert.equal(hi.canUndo('a'), false);
  assert.equal(hi.undo('a'), null);
  hi.mark('a'); // a -> b
  hi.mark('b'); // b -> c
  assert.equal(hi.canUndo('c'), true);
  assert.equal(hi.undo('c'), 'b');
  assert.equal(hi.undo('b'), 'a');
  assert.equal(hi.undo('a'), null);
  assert.equal(hi.canRedo('a'), true);
  assert.equal(hi.redo('a'), 'b');
  hi.mark('b'); // b -> d: c is gone
  assert.equal(hi.canRedo('d'), false);
  assert.equal(hi.redo('d'), null);
  assert.equal(hi.undo('d'), 'b');
});

test('a slider being dragged is one step; a pause or another control starts a new one', () => {
  const hi = createHistory();
  hi.mark('r10', 'slider:Radius', 1000);
  hi.mark('r11', 'slider:Radius', 1100);
  hi.mark('r12', 'slider:Radius', 1200 + GROUP_MS - 101);
  assert.equal(hi.undo('r13'), 'r10', 'the whole drag is taken back at once');
  assert.equal(hi.undo('r10'), null);
  hi.mark('r10', 'slider:Radius', 5000);
  hi.mark('r14', 'slider:Radius', 5000 + GROUP_MS + 1);
  hi.mark('r15', 'slider:Height', 5000 + GROUP_MS + 2);
  assert.equal(hi.undo('h2'), 'r15');
  assert.equal(hi.undo('r15'), 'r14');
  assert.equal(hi.undo('r14'), 'r10');
  // after an undo the same control starts a new step
  hi.mark('r10', 'slider:Radius', 5000 + GROUP_MS + 3);
  assert.equal(hi.undo('r20'), 'r10');
});

test('steps that changed nothing are skipped, and the history has an end', () => {
  const hi = createHistory(3);
  hi.mark('a');
  hi.mark('b');
  hi.mark('b'); // a click at a limit: nothing changed
  hi.mark('b');
  assert.equal(hi.undo('b'), 'a', 'no dead undo presses');
  hi.clear();
  for (const s of ['1', '2', '3', '4', '5']) hi.mark(s);
  assert.equal(hi.undo('6'), '5');
  assert.equal(hi.undo('5'), '4');
  assert.equal(hi.undo('4'), '3');
  assert.equal(hi.undo('3'), null, 'only the last three steps are kept');
  hi.clear();
  assert.equal(hi.canUndo('x'), false);
  assert.equal(hi.canRedo('x'), false);
});
