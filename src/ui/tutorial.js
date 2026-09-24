// Interactive first-game tutorial: a coach panel that teaches one thing at a time and
// only advances when the player has actually done it (camera, selection, rekindling,
// building, commanding the hero). Skippable, restartable from the main menu.
import { h, clear, setText } from './dom.js';
import { all } from '../world/world.js';
import { PLAYER } from '../core/contracts.js';

function keepOf(w) { return all(w, 'building').find((b) => b.type === 'keep' && b.owner === PLAYER); }
function count(w, type, states = ['site', 'active']) { return all(w, 'building').filter((b) => b.owner === PLAYER && b.type === type && states.includes(b.state)).length; }

export const TUTORIAL_STEPS = [
  {
    id: 'pan', title: 'Move the map',
    text: 'Hold the RIGHT mouse button and drag to pull the map around, just like grabbing a sheet of paper. The arrow keys work too.',
    start: (c) => ({ x: c.cam.state.x, z: c.cam.state.z }),
    done: (c, s) => Math.hypot(c.cam.state.x - s.x, c.cam.state.z - s.z) > 8,
  },
  {
    id: 'zoom', title: 'Zoom and rotate',
    text: 'Turn the mouse wheel to zoom towards the cursor. Hold the MIDDLE mouse button (or press Q / E) to rotate the view.',
    start: (c) => ({ zoom: c.cam.state.zoom, yaw: c.cam.state.yaw }),
    done: (c, s) => Math.abs(c.cam.state.zoom - s.zoom) > 6 || Math.abs(c.cam.state.yaw - s.yaw) > 0.3,
  },
  {
    id: 'select-keep', title: 'Select the Keep',
    text: 'LEFT-click the round stone tower with the empty fire bowl — Kindlehold Keep. Selected things show their details and buttons at the bottom.',
    focus: (c) => keepOf(c.world()),
    done: (c) => { const k = keepOf(c.world()); return !!k && c.world().selection.ids.includes(k.id); },
  },
  {
    id: 'rekindle', title: 'Light the hearth',
    text: 'In the command panel (bottom right), press the flame button "Rekindle". Settlers only come home to a burning hearth.',
    done: (c) => !!c.world().mission.flags.keepLit,
  },
  {
    id: 'lodge', title: 'Build a Woodcutter\'s Lodge',
    text: 'Press B (or the Build button), choose the Lodge, then left-click near the forest west of the Keep. Green means the spot is valid; right-click cancels.',
    focus: () => ({ x: -66, z: 38 }),
    done: (c) => count(c.world(), 'lodge') > 0,
  },
  {
    id: 'watch', title: 'Watch your people work',
    text: 'Labourers now carry timber and stone from the Keep and build the Lodge. Speed things up with ] (and slow down with [). Wait until the Lodge is finished.',
    done: (c) => count(c.world(), 'lodge', ['active']) > 0,
  },
  {
    id: 'farm', title: 'Food: build a Farmstead',
    text: 'Everyone eats provisions. Place a Farmstead on open grass inside your territory (the dashed ring). Its fields grow and are harvested automatically.',
    done: (c) => count(c.world(), 'farm') > 0,
  },
  {
    id: 'hero', title: 'Command Maren',
    text: 'Left-click Maren, the hooded warden with the lantern, then RIGHT-click the ground to send her there. Right-clicking an enemy attacks it.',
    focus: (c) => all(c.world(), 'unit').find((u) => u.hero),
    start: (c) => { const m = all(c.world(), 'unit').find((u) => u.hero); return { x: m ? m.x : 0, z: m ? m.z : 0 }; },
    done: (c, s) => { const m = all(c.world(), 'unit').find((u) => u.hero); return !!m && Math.hypot(m.x - s.x, m.z - s.z) > 4; },
  },
  {
    id: 'objectives', title: 'You\'re ready',
    text: 'The Objectives panel (top right) always tells you what to do next, with a hint underneath. Buildings that stop working show an amber "!" — click them to see why. Good luck, Warden!',
    final: true,
  },
];

export function createTutorial({ root, session, settings, onFinish }) {
  const cam = session.rc.rts;
  const ctx = { cam, world: () => session.world };
  let index = 0;
  let stepState = null;
  let pulse = 0;
  let doneDelay = 0;

  const title = h('h3.tut-title');
  const text = h('p.tut-text');
  const progress = h('div.tut-progress', { 'aria-hidden': 'true' });
  const status = h('div.tut-status', { role: 'status' });
  const next = h('button.btn.btn-primary', { type: 'button' }, ['Got it']);
  const skip = h('button.btn', { type: 'button' }, ['Skip tutorial']);
  const panel = h('section.tutorial.panel', { role: 'dialog', 'aria-label': 'Tutorial', 'aria-live': 'polite' }, [
    h('div.tut-head', {}, [h('span.tut-badge', { text: 'Tutorial' }), progress]), title, text, status, h('div.tut-actions', {}, [skip, next]),
  ]);
  root.append(panel);

  function finish() {
    settings.tutorialDone = true;
    panel.remove();
    if (onFinish) onFinish();
  }
  skip.addEventListener('click', finish);
  next.addEventListener('click', () => { if (TUTORIAL_STEPS[index].final) finish(); });

  function show() {
    const st = TUTORIAL_STEPS[index];
    setText(title, st.title);
    setText(text, st.text);
    setText(status, st.final ? '' : 'Waiting for you…');
    status.classList.remove('ok');
    next.hidden = !st.final;
    clear(progress);
    TUTORIAL_STEPS.forEach((_, i) => progress.append(h(`span.tut-dot${i < index ? '.done' : i === index ? '.now' : ''}`)));
    stepState = st.start ? st.start(ctx) : null;
    doneDelay = 0;
  }
  show();

  return {
    el: panel,
    get index() { return index; },
    update(dt) {
      if (!panel.isConnected) return;
      const st = TUTORIAL_STEPS[index];
      // gently point at the thing the step is about
      pulse += dt;
      if (st.focus && pulse > 1.1) {
        pulse = 0;
        const f = st.focus(ctx);
        if (f && session.marker) session.marker('rally', f.x, f.z);
      }
      if (st.final) return;
      if (doneDelay > 0) {
        doneDelay -= dt;
        if (doneDelay <= 0) { index++; show(); }
        return;
      }
      if (st.done(ctx, stepState)) {
        setText(status, '✓ Well done!');
        status.classList.add('ok');
        doneDelay = 1.2;
      }
    },
    dispose() { panel.remove(); },
  };
}
