// Menus and full-screen screens: main menu, difficulty, load/save, pause, settings,
// how-to-play, credits, loading, victory/defeat. Keyboard reachable, Esc closes.
import { h, icon, clear, fmtTime } from './dom.js';
import { listSaves } from '../save/storage.js';
import { DEFAULT_BINDINGS, BINDING_LABELS, keyLabel } from '../input/bindings.js';
import { HARROWMERE_SCENARIO } from '../missions/scenarios/harrowmere.js';
import { SCENARIOS, CAMPAIGN, FREE_PLAY } from '../missions/index.js';
import { loadProgress, isUnlocked } from '../app/campaign.js';

function focusFirst(el) { const f = el.querySelector('button:not([disabled]), [tabindex="0"], input, select'); if (f) f.focus(); }

function screen(cls, children, { onEsc } = {}) {
  const el = h(`div.screen.${cls}`, { role: 'dialog', 'aria-modal': 'true' }, children);
  if (onEsc) el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); onEsc(); } });
  return el;
}

function menuButton(label, onClick, { primary = false, disabled = false, tip = null, ic = null, sub = null } = {}) {
  const b = h(`button.menu-btn${primary ? '.primary' : ''}${ic ? '.rich' : ''}`, { type: 'button', disabled, title: tip || undefined },
    ic ? [icon(ic, 'icon menu-ic'), h('span.menu-txt', {}, [h('span.menu-label', { text: label }), sub ? h('span.menu-sub', { text: sub }) : null])] : [label]);
  b.addEventListener('click', onClick);
  return b;
}

/** Decorative, project-authored title backdrop (pure CSS layers; no image files). */
function backdrop() {
  // CSS silhouettes stay underneath as a fallback if the image cannot load
  return h('div.backdrop', { 'aria-hidden': 'true' }, [
    h('div.bd-sky'), h('div.bd-hills.far'), h('div.bd-hills.mid'), h('div.bd-keep'), h('div.bd-glow'), h('div.bd-hills.near'), h('div.bd-mist'),
    h('div.bd-image'), h('div.bd-shade'),
  ]);
}

export function createMenus({ root, settings, onSettingsChange, graphicsInfo = () => null, openDiagnostics = null }) {
  let current = null;
  function show(el) { close(); current = el; root.append(el); focusFirst(el); requestAnimationFrame(() => { if (!el.contains(document.activeElement)) focusFirst(el); }); return el; }
  function close() { if (current) { current.remove(); current = null; } }

  function mainMenu({ onNew, onContinue, onLoad, canContinue }) {
    const el = screen('main-menu', [
      backdrop(),
      h('div.menu-card', {}, [
        h('h1.title', {}, ['Kindlehold']),
        h('p.subtitle', { text: 'The Rekindling of Harrowmere' }),
        h('nav.menu-list', { 'aria-label': 'Main menu' }, [
          menuButton('Campaign', () => campaignMenu({ onPick: onNew, onBack: () => mainMenu({ onNew, onContinue, onLoad, canContinue }) }), { primary: true, ic: 'rekindle', sub: `${CAMPAIGN.length} chapters: the story of Maren and the Hearthbound` }),
          menuButton('Free Play', () => freePlayMenu({ onPick: onNew, onBack: () => mainMenu({ onNew, onContinue, onLoad, canContinue }) }), { ic: 'cottage', sub: 'Build freely on any map, no story' }),
          menuButton('Continue', onContinue, { disabled: !canContinue, tip: canContinue ? 'Load your most recent save' : 'No saved games yet', ic: 'play', sub: canContinue ? 'Pick up where you left off' : 'No saved games yet' }),
          menuButton('Load Game', () => loadDialog({ onLoad, onBack: () => mainMenu({ onNew, onContinue, onLoad, canContinue }) }), { ic: 'save', sub: 'Quick, auto and three save slots' }),
          menuButton('Settings', () => settingsScreen({ onBack: () => mainMenu({ onNew, onContinue, onLoad, canContinue }) }), { ic: 'gear', sub: 'Graphics, sound, controls, interface' }),
          menuButton('How to Play', () => howTo({ onBack: () => mainMenu({ onNew, onContinue, onLoad, canContinue }) }), { ic: 'objective', sub: 'Controls, economy, seasons, battles' }),
          menuButton('Credits & Licences', () => credits({ onBack: () => mainMenu({ onNew, onContinue, onLoad, canContinue }) }), { ic: 'menu', sub: 'Who made what' }),
        ]),
        h('p.fineprint', { text: 'An original game. Not affiliated with any other strategy series.' }),
      ]),
    ]);
    return show(el);
  }

  /** The campaign: chapters in order, each opened by winning the one before. */
  function campaignMenu({ onPick, onBack }) {
    const progress = loadProgress();
    const list = h('div.chapter-list');
    const back = () => campaignMenu({ onPick, onBack });
    CAMPAIGN.forEach((id, i) => {
      const sc = SCENARIOS[id];
      const open = isUnlocked(id, progress, settings.unlockAllChapters);
      const done = !!progress.done[id];
      const b = h('button.chapter', { type: 'button', disabled: !open, 'aria-label': `Chapter ${i + 1}: ${sc.title}${open ? '' : ' (locked)'}` }, [
        h('span.chapter-no', { text: String(i + 1) }),
        h('span.chapter-text', {}, [h('strong', { text: sc.title }), h('span', { text: open ? sc.blurb : 'Win the previous chapter to continue the story.' })]),
        h('span.chapter-state', { text: done ? '✓ Won' : open ? 'Play' : 'Locked' }),
      ]);
      if (open) b.addEventListener('click', () => difficultyPicker({ scenario: sc, onPick: (d) => onPick(d, id), onBack: back }));
      list.append(b);
    });
    const memory = progress.greyfen ? h('p.muted', { text: progress.greyfen === 'allied' ? 'Your choice so far: the Greyfen are your allies.' : 'Your choice so far: the Greyfen Hold has fallen.' }) : null;
    return show(screen('sub-menu', [backdrop(), h('div.menu-card.wide', {}, [
      h('h2', { text: 'Campaign' }), h('p.lore', { text: 'Seven winters after the Long Frost, Maren Ashgrove leads the Hearthbound home to Kindlehold.' }),
      list, memory, menuButton('Back', onBack),
    ].filter(Boolean))], { onEsc: onBack }));
  }

  /** Free play: every campaign map, open from the start, without story. */
  function freePlayMenu({ onPick, onBack }) {
    const list = h('div.chapter-list');
    const back = () => freePlayMenu({ onPick, onBack });
    FREE_PLAY.forEach((id, i) => {
      const sc = SCENARIOS[id];
      const name = sc.title.replace(/^Free Play: /, '');
      const b = h('button.chapter', { type: 'button', 'aria-label': `Free play: ${name}` }, [
        h('span.chapter-no', { text: String(i + 1) }),
        h('span.chapter-text', {}, [h('strong', { text: name }), h('span', { text: sc.blurb })]),
        h('span.chapter-state', { text: 'Play' }),
      ]);
      b.addEventListener('click', () => difficultyPicker({ scenario: sc, onPick: (d) => onPick(d, id), onBack: back }));
      list.append(b);
    });
    return show(screen('sub-menu', [backdrop(), h('div.menu-card.wide', {}, [
      h('h2', { text: 'Free Play' }), h('p.lore', { text: 'Pick a land, build your settlement at your own pace and break the lord who holds it. Every building and technology is open to research.' }),
      list, menuButton('Back', onBack),
    ])], { onEsc: onBack }));
  }

  function difficultyPicker({ onPick, onBack, scenario = HARROWMERE_SCENARIO }) {
    const opts = [
      ['story', 'Story', 'Smaller raids, more starting goods. Relaxed pace.', 'cottage', ['Starting goods ×1.5', 'First raid: 6 raiders', 'Plunderers from minute 11']],
      ['normal', 'Normal', 'The intended challenge.', 'shield', ['Starting goods ×1', 'First raid: 9 raiders', 'Plunderers from minute 8']],
      ['hard', 'Hard', 'Larger, faster raids. Rustfang troops have +10% health (documented AI advantage).', 'reaver', ['Starting goods ×0.8', 'First raid: 11 raiders', 'Plunderers from minute 6']],
    ];
    const list = h('div.diff-list.cards', { role: 'radiogroup', 'aria-label': 'Difficulty' });
    for (const [id, name, desc, ic, facts] of opts) {
      const b = h('button.diff', { type: 'button', role: 'radio', 'aria-checked': settings.difficulty === id ? 'true' : 'false' }, [icon(ic, 'icon diff-ic'), h('strong', { text: name }), h('span', { text: desc }), h('ul.diff-facts', {}, facts.map((f) => h('li', { text: f })))]);
      b.addEventListener('click', () => { settings.difficulty = id; onSettingsChange(settings); onPick(id); });
      list.append(b);
    }
    return show(screen('sub-menu', [backdrop(), h('div.menu-card.wide', {}, [
      h('h2', { text: scenario.chapter ? `Chapter ${scenario.chapter}: ${scenario.title}` : scenario.title }),
      h('p.lore', { text: scenario.blurb }),
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
        body.append(choice('Quality', 'quality', [['low', 'Low (no shadows, no post-processing)'], ['medium', 'Medium (glow, smooth edges)'], ['high', 'High (all effects)']]), toggle('Miniature focus', 'depthOfField', 'Softly blur the top and bottom of close views, like a model landscape (High quality)'), toggle('Limit to 30 frames per second', 'frameCap30', 'Less work for the graphics card: cooler and quieter laptops, fewer hitches on older machines'), toggle('Modelled buildings', 'modelledBuildings', 'Detailed building models (KayKit). Off: the simpler hand-built buildings. Takes effect in the next game or after loading'));
        body.append(h('p.muted', { text: inGame ? 'Quality changes apply the next time a game is started or loaded.' : 'Quality applies when a game starts.' }));
        const gi = graphicsInfo();
        if (gi) {
          const names = { ao: 'occlusion', glow: 'glow and miniature focus', msaa: 'edge smoothing' };
          const load = gi.reduced.length ? `Switched off under load: ${gi.reduced.map((k) => names[k] || k).join(', ')}. ` : '';
          body.append(h('p.muted.gfx-info', { text: `${load}Resolution ${Math.round((gi.ratio / gi.max) * 100)} %.${gi.gpu ? ` Graphics chip: ${gi.gpu}` : ''}` }));
          if (openDiagnostics) body.append(menuButton('Show diagnostics (F3)', openDiagnostics, { sub: 'Performance log of this game, to download and send' }));
        }
      } else if (tab === 'Audio') {
        body.append(slider('Master volume', 'masterVolume', 0, 1, 0.05), slider('Music', 'musicVolume', 0, 1, 0.05), slider('Ambience', 'ambienceVolume', 0, 1, 0.05), slider('Effects', 'effectsVolume', 0, 1, 0.05), slider('Voices', 'voiceVolume', 0, 1, 0.05), toggle('Mute all audio', 'muted'));
      } else if (tab === 'Gameplay') {
        body.append(slider('Game speed', 'gameSpeed', 0.5, 2, 0.5, (v) => `${v}×`), toggle('Tutorial hints', 'tutorialHints', 'Show hints under objectives and highlight buttons'), toggle('Unlock all chapters', 'unlockAllChapters', 'Play any campaign chapter without winning the earlier ones'), toggle('Chapter intros', 'cinematics', 'Fly over the valley while the story is told when a chapter begins'), choice('Default difficulty', 'difficulty', [['story', 'Story'], ['normal', 'Normal'], ['hard', 'Hard']]));
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
        body.append(h('p.muted', { text: 'Mouse: left-click select · left-drag box-select · right-click move/attack · right-drag moves the map · middle-drag rotates · wheel zooms. Ctrl+1–9 make groups, 1–9 select them.' }));
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
      ['lodge', 'Build an economy', 'Open the Build menu (B by default). Lodges need trees, Quarries rock, Mines an iron vein. Labourers carry materials and build.'],
      ['pop', 'People are everything', 'Cottages house five. New settlers need free housing and provisions. Every workplace and soldier uses one person.'],
      ['provisions', 'Feed them', 'Everyone eats every 90 s. Hunger lowers stability, and low stability slows all work.'],
      ['storehouse', 'Storehouses and idle hands', 'Labourers carry goods to and from the nearest store — build Storehouses for outlying quarters. At the Keep, Idle hands: Gather lets labourers with nothing to do fell trees and cut stone. Any building can be moved (Move): materials come along, only building time is spent.'],
      ['mill', 'Production chains', 'A Windmill grinds grain into flour, a Bakery bakes it into bread (one loaf feeds two and cheers people up), a Smithy forges iron into tools for the third workshop level.'],
      ['alertWarn', 'Read the warnings', 'Selected buildings tell you exactly why they stall: no worker, storage full, no input, nothing in range.'],
      ['research', 'Research at the Keep', 'Keen Axes, Braced Timber, Tempered Blades and the March Charter (which unlocks Watchtowers).'],
      ['shield', 'Soldiers', 'Shieldbearers beat blades, Bladesmen beat archers, Fletchers beat shields. Right-click to move or attack; A = attack-move.'],
      ['maren', 'Maren Ashgrove', 'F: Beacon Flare (damages and dazzles enemies). G: Kindle the Line (wards nearby allies). Allies near her heal.'],
      ['wren', 'Wren Fenmore (from chapter 6)', 'F: Arrow Storm (arrows rain on a circle). G: Hunter\'s Mark (marked enemies take 30% more damage; reveals the land). She sees further than anyone.'],
      ['warhall', 'Win', 'Survive the Rustfang raid, then destroy the Warhall at the ford fort. Lose the Keep and the scenario is lost.'],
    ];
    return show(screen('sub-menu', [backdrop(), h('div.menu-card.wide', {}, [
      h('h2', { text: 'How to play' }),
      h('ul.howto', {}, rows.map(([ic, t, d]) => h('li', {}, [icon(ic, 'icon icon-md'), h('div', {}, [h('strong', { text: t }), h('p', { text: d })])]))),
      menuButton('Replay the interactive tutorial next game', () => { settings.tutorialDone = false; onSettingsChange(settings); onBack(); }),
      menuButton('Back', onBack, { primary: true }),
    ])], { onEsc: onBack }));
  }

  function credits({ onBack }) {
    return show(screen('sub-menu', [backdrop(), h('div.menu-card.wide', {}, [
      h('h2', { text: 'Credits & licences' }),
      h('p', { text: 'Kindlehold is an original game: its setting, story characters, missions, dialogue, buildings, interface, icons, textures, music and sounds were created for this project, mostly generated procedurally at runtime.' }),
      h('p', { text: 'Characters and their animations: KayKit Adventurers Character Pack by Kay Lousberg (kaylousberg.com), CC0 1.0 — recoloured and dressed for Kindlehold\'s roles and factions.' }),
      h('p', { text: 'Building models and props: KayKit Medieval Hexagon Pack by Kay Lousberg (kaylousberg.com), CC0 1.0.' }),
      h('p', { text: 'Rendering: three.js (MIT licence) including its Sky shader addon. Build tooling: Vite (MIT). No other third-party art, audio or fonts are shipped.' }),
      h('p.muted', { text: 'Inspired only by the general conventions of economy-focused real-time strategy games. Not affiliated with, endorsed by, or a remake of any existing game.' }),
      menuButton('Back', onBack, { primary: true }),
    ])], { onEsc: onBack }));
  }

  function loading(text = 'Rekindling the hearth…') {
    return show(screen('loading', [backdrop(), h('div.menu-card', { role: 'status' }, [h('h2', { text: 'Kindlehold' }), h('p', { text }), h('div.boot-bar', {}, [h('div.boot-bar-fill')])])]));
  }

  function endScreen({ result, world, onMenu, onRestart, onNext = null }) {
    const sc = SCENARIOS[world.meta.scenarioId] || HARROWMERE_SCENARIO;
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
      h('nav.menu-list.row', {}, [
        onNext ? menuButton('Next chapter', onNext, { primary: true }) : null,
        menuButton('Play again', onRestart, { primary: !onNext }), menuButton('Main menu', onMenu),
      ].filter(Boolean)),
      onNext ? null : result === 'victory' && sc.id === CAMPAIGN[CAMPAIGN.length - 1] ? h('p.muted', { text: 'You have finished the campaign. Thank you for playing — more chapters are coming.' }) : null,
    ])]));
  }

  return { mainMenu, difficultyPicker, loadDialog, saveDialog, pauseMenu, settingsScreen, howTo, credits, loading, endScreen, close, get open() { return !!current; } };
}
