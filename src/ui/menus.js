// Menus and full-screen screens: main menu, difficulty, load/save, pause, settings,
// how-to-play, credits, loading, victory/defeat. Keyboard reachable, Esc closes.
import { h, icon, clear, fmtTime } from './dom.js';
import { listSaves } from '../save/storage.js';
import { DEFAULT_BINDINGS, BINDING_LABELS, keyLabel } from '../input/bindings.js';
import { HARROWMERE_SCENARIO } from '../missions/scenarios/harrowmere.js';

function focusFirst(el) { const f = el.querySelector('button:not([disabled]), [tabindex="0"], input, select'); if (f) f.focus(); }

function screen(cls, children, { onEsc } = {}) {
  const el = h(`div.screen.${cls}`, { role: 'dialog', 'aria-modal': 'true' }, children);
  if (onEsc) el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); onEsc(); } });
  return el;
}

function menuButton(label, onClick, { primary = false, disabled = false, tip = null } = {}) {
  const b = h(`button.menu-btn${primary ? '.primary' : ''}`, { type: 'button', disabled, title: tip || undefined }, [label]);
  b.addEventListener('click', onClick);
  return b;
}

/** Decorative, project-authored title backdrop (pure CSS layers; no image files). */
function backdrop() {
  return h('div.backdrop', { 'aria-hidden': 'true' }, [
    h('div.bd-sky'), h('div.bd-hills.far'), h('div.bd-hills.mid'), h('div.bd-keep'), h('div.bd-glow'), h('div.bd-hills.near'), h('div.bd-mist'),
  ]);
}

export function createMenus({ root, settings, onSettingsChange }) {
  let current = null;
  function show(el) { close(); current = el; root.append(el); requestAnimationFrame(() => focusFirst(el)); return el; }
  function close() { if (current) { current.remove(); current = null; } }

  function mainMenu({ onNew, onContinue, onLoad, canContinue }) {
    const el = screen('main-menu', [
      backdrop(),
      h('div.menu-card', {}, [
        h('h1.title', {}, ['Kindlehold']),
        h('p.subtitle', { text: 'The Rekindling of Harrowmere' }),
        h('nav.menu-list', { 'aria-label': 'Main menu' }, [
          menuButton('New Game', () => difficultyPicker({ onPick: onNew, onBack: () => mainMenu({ onNew, onContinue, onLoad, canContinue }) }), { primary: true }),
          menuButton('Continue', onContinue, { disabled: !canContinue, tip: canContinue ? 'Load your most recent save' : 'No saved games yet' }),
          menuButton('Load Game', () => loadDialog({ onLoad, onBack: () => mainMenu({ onNew, onContinue, onLoad, canContinue }) })),
          menuButton('Settings', () => settingsScreen({ onBack: () => mainMenu({ onNew, onContinue, onLoad, canContinue }) })),
          menuButton('How to Play', () => howTo({ onBack: () => mainMenu({ onNew, onContinue, onLoad, canContinue }) })),
          menuButton('Credits & Licences', () => credits({ onBack: () => mainMenu({ onNew, onContinue, onLoad, canContinue }) })),
        ]),
        h('p.fineprint', { text: 'An original game. Not affiliated with any other strategy series.' }),
      ]),
    ]);
    return show(el);
  }

  function difficultyPicker({ onPick, onBack }) {
    const opts = [
      ['story', 'Story', 'Smaller raids, more starting goods. Relaxed pace.'],
      ['normal', 'Normal', 'The intended challenge.'],
      ['hard', 'Hard', 'Larger, faster raids. Rustfang troops have +10% health (documented AI advantage).'],
    ];
    const list = h('div.diff-list', { role: 'radiogroup', 'aria-label': 'Difficulty' });
    for (const [id, name, desc] of opts) {
      const b = h('button.diff', { type: 'button', role: 'radio', 'aria-checked': settings.difficulty === id ? 'true' : 'false' }, [h('strong', { text: name }), h('span', { text: desc })]);
      b.addEventListener('click', () => { settings.difficulty = id; onSettingsChange(settings); onPick(id); });
      list.append(b);
    }
    return show(screen('sub-menu', [backdrop(), h('div.menu-card.wide', {}, [
      h('h2', { text: HARROWMERE_SCENARIO.title }),
      h('p.lore', { text: HARROWMERE_SCENARIO.blurb }),
      h('h3', { text: 'Choose difficulty' }), list, menuButton('Back', onBack),
    ])], { onEsc: onBack }));
  }

  function slotLabel(s) {
    if (!s.meta) return 'Empty';
    const d = s.meta.savedAt ? new Date(s.meta.savedAt) : null;
    return `${s.meta.label || 'Kindlehold'} · ${fmtTime(s.meta.tick / 20)} in game · ${s.meta.difficulty}${d ? ' · ' + d.toLocaleString() : ''}`;
  }

  function loadDialog({ onLoad, onBack }) {
    const list = h('div.slot-list');
    for (const s of listSaves()) {
      const b = h('button.slot', { type: 'button', disabled: !s.meta }, [h('strong', { text: s.slot === 'quick' ? 'Quick save' : s.slot === 'auto' ? 'Autosave' : `Slot ${s.slot.slice(4)}` }), h('span', { text: slotLabel(s) })]);
      b.addEventListener('click', () => onLoad(s.slot));
      list.append(b);
    }
    return show(screen('sub-menu', [backdrop(), h('div.menu-card.wide', {}, [h('h2', { text: 'Load game' }), list, menuButton('Back', onBack)])], { onEsc: onBack }));
  }

  function saveDialog({ onSave, onBack }) {
    const list = h('div.slot-list');
    for (const s of listSaves().filter((x) => x.slot !== 'auto')) {
      const b = h('button.slot', { type: 'button' }, [h('strong', { text: s.slot === 'quick' ? 'Quick save' : `Slot ${s.slot.slice(4)}` }), h('span', { text: slotLabel(s) })]);
      b.addEventListener('click', () => onSave(s.slot));
      list.append(b);
    }
    return show(screen('sub-menu.dim', [h('div.menu-card.wide', {}, [h('h2', { text: 'Save game' }), list, menuButton('Back', onBack)])], { onEsc: onBack }));
  }

  function pauseMenu({ onResume, onSave, onLoad, onQuit, onRestart }) {
    return show(screen('pause.dim', [h('div.menu-card', {}, [
      h('h2', { text: 'Paused' }),
      h('nav.menu-list', {}, [
        menuButton('Resume', onResume, { primary: true }),
        menuButton('Save Game', () => saveDialog({ onSave, onBack: () => pauseMenu({ onResume, onSave, onLoad, onQuit, onRestart }) })),
        menuButton('Load Game', () => loadDialog({ onLoad, onBack: () => pauseMenu({ onResume, onSave, onLoad, onQuit, onRestart }) })),
        menuButton('Settings', () => settingsScreen({ onBack: () => pauseMenu({ onResume, onSave, onLoad, onQuit, onRestart }), inGame: true })),
        menuButton('How to Play', () => howTo({ onBack: () => pauseMenu({ onResume, onSave, onLoad, onQuit, onRestart }) })),
        menuButton('Restart Scenario', onRestart),
        menuButton('Quit to Main Menu', onQuit),
      ]),
    ])], { onEsc: onResume }));
  }

  function slider(label, key, min, max, step, fmt = (v) => `${Math.round(v * 100)}%`) {
    const out = h('output', { text: fmt(settings[key]) });
    const id = `set-${key}`;
    const inp = h('input', { type: 'range', id, min, max, step, value: settings[key] });
    inp.addEventListener('input', () => { settings[key] = Number(inp.value); out.textContent = fmt(settings[key]); onSettingsChange(settings); });
    return h('div.setting', {}, [h('label', { for: id, text: label }), inp, out]);
  }
  function toggle(label, key, desc = '') {
    const id = `set-${key}`;
    const inp = h('input', { type: 'checkbox', id, checked: !!settings[key] });
    inp.addEventListener('change', () => { settings[key] = inp.checked; onSettingsChange(settings); });
    return h('div.setting.toggle', {}, [inp, h('label', { for: id }, [label, desc ? h('small', { text: desc }) : null])]);
  }
  function choice(label, key, options) {
    const id = `set-${key}`;
    const sel = h('select', { id }, options.map(([v, t]) => h('option', { value: v, selected: settings[key] === v }, [t])));
    sel.addEventListener('change', () => { settings[key] = sel.value; onSettingsChange(settings); });
    return h('div.setting', {}, [h('label', { for: id, text: label }), sel]);
  }

  function settingsScreen({ onBack, inGame = false }) {
    const tabs = ['Graphics', 'Audio', 'Gameplay', 'Controls', 'Accessibility'];
    const body = h('div.settings-body');
    const tabBar = h('div.tabs', { role: 'tablist' });
    function render(tab) {
      clear(body);
      for (const b of tabBar.children) b.setAttribute('aria-selected', b.textContent === tab ? 'true' : 'false');
      if (tab === 'Graphics') {
        body.append(choice('Quality', 'quality', [['low', 'Low (no shadows, fewer particles)'], ['medium', 'Medium'], ['high', 'High']]));
        body.append(h('p.muted', { text: inGame ? 'Quality changes apply the next time a game is started or loaded.' : 'Quality applies when a game starts.' }));
      } else if (tab === 'Audio') {
        body.append(slider('Master volume', 'masterVolume', 0, 1, 0.05), slider('Music', 'musicVolume', 0, 1, 0.05), slider('Ambience', 'ambienceVolume', 0, 1, 0.05), slider('Effects', 'effectsVolume', 0, 1, 0.05), slider('Voices', 'voiceVolume', 0, 1, 0.05), toggle('Mute all audio', 'muted'));
      } else if (tab === 'Gameplay') {
        body.append(slider('Game speed', 'gameSpeed', 0.5, 2, 0.5, (v) => `${v}×`), toggle('Tutorial hints', 'tutorialHints', 'Show hints under objectives and highlight buttons'), choice('Default difficulty', 'difficulty', [['story', 'Story'], ['normal', 'Normal'], ['hard', 'Hard']]));
      } else if (tab === 'Controls') {
        body.append(slider('Camera speed', 'cameraSpeed', 0.4, 2.5, 0.1, (v) => `${v.toFixed(1)}×`), toggle('Edge scrolling', 'edgeScroll', 'Move the camera when the mouse touches the screen edge'));
        const table = h('div.bindings', { role: 'list' });
        for (const action of Object.keys(DEFAULT_BINDINGS)) {
          const cur = (settings.bindings && settings.bindings[action]) || DEFAULT_BINDINGS[action];
          const b = h('button.bind', { type: 'button', 'aria-label': `${BINDING_LABELS[action]}: ${keyLabel(cur)}. Press to rebind.` }, [keyLabel(cur)]);
          b.addEventListener('click', () => {
            b.textContent = 'Press a key…';
            const handler = (e) => {
              e.preventDefault(); e.stopPropagation();
              window.removeEventListener('keydown', handler, true);
              if (e.code !== 'Escape' || action === 'pause') { settings.bindings = { ...(settings.bindings || {}), [action]: e.code }; onSettingsChange(settings); }
              render('Controls');
            };
            window.addEventListener('keydown', handler, true);
          });
          table.append(h('div.bind-row', { role: 'listitem' }, [h('span', { text: BINDING_LABELS[action] }), b]));
        }
        body.append(table, menuButton('Reset keys to defaults', () => { settings.bindings = {}; onSettingsChange(settings); render('Controls'); }));
        body.append(h('p.muted', { text: 'Mouse: left-click select · drag to box-select · right-click move/attack · middle-drag rotate · wheel zoom. Ctrl+1–9 make groups, 1–9 select them.' }));
      } else {
        body.append(toggle('Reduced motion', 'reducedMotion', 'Instant camera moves, calmer effects, no pulsing highlights'), slider('Interface size', 'uiScale', 0.8, 1.3, 0.05, (v) => `${Math.round(v * 100)}%`));
      }
    }
    for (const t of tabs) {
      const b = h('button.tab', { type: 'button', role: 'tab' }, [t]);
      b.addEventListener('click', () => render(t));
      tabBar.append(b);
    }
    const el = show(screen(`settings${inGame ? '.dim' : ''}`, [inGame ? null : backdrop(), h('div.menu-card.wide', {}, [h('h2', { text: 'Settings' }), tabBar, body, menuButton('Done', onBack, { primary: true })])], { onEsc: onBack }));
    render('Graphics');
    return el;
  }

  function howTo({ onBack }) {
    const rows = [
      ['rekindle', 'Rekindle the Keep', 'Select the Keep and light its hearth. Settlers only come home to a burning hearth.'],
      ['lodge', 'Build an economy', 'Press B. Lodges need trees, Quarries rock, Mines an iron vein. Labourers carry materials and build.'],
      ['pop', 'People are everything', 'Cottages house five. New settlers need free housing and provisions. Every workplace and soldier uses one person.'],
      ['provisions', 'Feed them', 'Everyone eats every 90 s. Hunger lowers stability, and low stability slows all work.'],
      ['alertWarn', 'Read the warnings', 'Selected buildings tell you exactly why they stall: no worker, storage full, no input, nothing in range.'],
      ['research', 'Research at the Keep', 'Keen Axes, Braced Timber, Tempered Blades and the March Charter (which unlocks Watchtowers).'],
      ['shield', 'Soldiers', 'Shieldbearers beat blades, Bladesmen beat archers, Fletchers beat shields. Right-click to move or attack; A = attack-move.'],
      ['maren', 'Maren Ashgrove', 'F: Beacon Flare (damages and dazzles enemies). G: Kindle the Line (wards nearby allies). Allies near her heal.'],
      ['warhall', 'Win', 'Survive the Rustfang raid, then destroy the Warhall at the ford fort. Lose the Keep and the scenario is lost.'],
    ];
    return show(screen('sub-menu', [backdrop(), h('div.menu-card.wide', {}, [
      h('h2', { text: 'How to play' }),
      h('ul.howto', {}, rows.map(([ic, t, d]) => h('li', {}, [icon(ic, 'icon icon-md'), h('div', {}, [h('strong', { text: t }), h('p', { text: d })])]))),
      menuButton('Back', onBack, { primary: true }),
    ])], { onEsc: onBack }));
  }

  function credits({ onBack }) {
    return show(screen('sub-menu', [backdrop(), h('div.menu-card.wide', {}, [
      h('h2', { text: 'Credits & licences' }),
      h('p', { text: 'Kindlehold is an original game: its setting, characters, missions, dialogue, buildings, interface, icons, textures, models, music and sounds were created for this project, mostly generated procedurally at runtime.' }),
      h('p', { text: 'Rendering: three.js (MIT licence) including its Sky shader addon. Build tooling: Vite (MIT). No third-party art, audio or fonts are shipped.' }),
      h('p.muted', { text: 'Inspired only by the general conventions of economy-focused real-time strategy games. Not affiliated with, endorsed by, or a remake of any existing game.' }),
      menuButton('Back', onBack, { primary: true }),
    ])], { onEsc: onBack }));
  }

  function loading(text = 'Rekindling the hearth…') {
    return show(screen('loading', [backdrop(), h('div.menu-card', { role: 'status' }, [h('h2', { text: 'Kindlehold' }), h('p', { text }), h('div.boot-bar', {}, [h('div.boot-bar-fill')])])]));
  }

  function endScreen({ result, world, onMenu, onRestart }) {
    const sc = HARROWMERE_SCENARIO;
    const txt = result === 'victory' ? sc.victory : sc.defeat;
    const st = world.stats;
    const stats = [
      ['Time', fmtTime(world.tick / 20)],
      ['Settlers arrived', st.settlersArrived], ['Buildings raised', st.buildingsBuilt],
      ['Timber / stone produced', `${st.produced.timber} / ${st.produced.stone}`], ['Iron / provisions produced', `${st.produced.iron} / ${st.produced.provisions}`],
      ['Soldiers trained', st.unitsRecruited], ['Reavers defeated', st.enemiesDefeated], ['Our losses', st.unitsLost], ['Raids faced', world.ai.wave],
    ];
    return show(screen(`end.${result}`, [backdrop(), h('div.menu-card.wide', {}, [
      h('h1.title.small', { text: result === 'victory' ? 'Victory' : 'Defeat' }),
      h('h2', { text: txt.title }),
      h('p.lore', { text: txt.text }),
      h('dl.stats-list', {}, stats.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: String(v) })])),
      h('nav.menu-list.row', {}, [menuButton('Play again', onRestart, { primary: true }), menuButton('Main menu', onMenu)]),
    ])]));
  }

  return { mainMenu, difficultyPicker, loadDialog, saveDialog, pauseMenu, settingsScreen, howTo, credits, loading, endScreen, close, get open() { return !!current; } };
}
