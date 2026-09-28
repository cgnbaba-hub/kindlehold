// Application flow: main menu -> loading -> game session (HUD, input, audio) ->
// pause/save/load -> victory/defeat -> menu. Verification mode (?verify=1) starts a
// session directly with a deterministic demo state and exposes window.__GAME__.
import { createSession } from './session.js';
import { installVerifyApi, markReady } from '../debug/verify-api.js';
import { showErrorOverlay, hideErrorOverlay } from './error-overlay.js';
import { loadSettings, saveSettings, prefersReducedMotion } from './settings.js';
import { createMenus } from '../ui/menus.js';
import { createHud } from '../ui/hud.js';
import { createTutorial } from '../ui/tutorial.js';
import { saveToSlot, loadFromSlot, latestSave, hasAnySave } from '../save/storage.js';
import { EV } from '../core/contracts.js';
import { log } from '../core/logger.js';
import { smokeTestWorld } from './load-check.js';
import { recordVictory, campaignMemory } from './campaign.js';
import { SCENARIOS, CAMPAIGN } from '../missions/index.js';
import { playCinematic } from '../ui/cinematic.js';

const SPEEDS = [0.5, 1, 2, 4, 8];

export async function startApp(params) {
  const container = document.getElementById('app');
  const boot = document.getElementById('boot-screen');
  const verify = params.get('verify') === '1';
  const debugApi = params.get('debug') === '1'; // exposes window.__GAME__ for e2e tests
  const settings = loadSettings();
  if (prefersReducedMotion() && !localStorageHas('kindlehold.settings.v1')) settings.reducedMotion = true;
  const uiRoot = document.createElement('div');
  uiRoot.className = 'ui-root';
  container.append(uiRoot);
  applyUiSettings();

  let session = null;
  let hud = null;
  let tutorial = null;
  let cinematic = null;
  let menus = null;
  let paused = false;
  let ended = false;

  function localStorageHas(k) { try { return window.localStorage.getItem(k) !== null; } catch { return false; } }
  function applyUiSettings() {
    document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale));
    document.documentElement.classList.toggle('reduced-motion', !!settings.reducedMotion);
  }
  function onSettingsChange(s) {
    Object.assign(settings, s);
    saveSettings(settings);
    applyUiSettings();
    if (session) { session.audio.applyVolumes(); if (!paused) session.loop.setSpeed(settings.gameSpeed); }
  }

  menus = createMenus({ root: uiRoot, settings, onSettingsChange });

  function endSession() {
    if (cinematic) { const c = cinematic; cinematic = null; c.skip(); }
    if (tutorial) { tutorial.dispose(); tutorial = null; }
    if (hud) { hud.dispose(); hud = null; }
    if (session) { session.dispose(); session = null; }
    paused = false; ended = false;
  }

  function showMain() {
    endSession();
    menus.mainMenu({
      onNew: (difficulty, scenarioId) => startGame({ difficulty, scenarioId }),
      onContinue: () => { const s = latestSave(); if (s) startGame({ slot: s.slot }); },
      onLoad: (slot) => startGame({ slot }),
      canContinue: hasAnySave(),
    });
  }

  async function startGame({ difficulty = settings.difficulty, slot = null, seed = null, demo = null, scenarioId = 'harrowmere', intro = true } = {}) {
    endSession();
    menus.loading(slot ? 'Unpacking your saved settlement…' : 'Rekindling the hearth…');
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
    let loaded = null;
    if (slot) {
      try { loaded = loadFromSlot(slot).world; smokeTestWorld(loaded); }
      catch (err) {
        log.warn('save', `load failed: ${err.message}`);
        menus.close();
        showErrorOverlay({ title: 'Could not load that save', message: err.message, actions: [{ label: 'Back to menu', primary: true, run: () => { hideErrorOverlay(); showMain(); } }] });
        return;
      }
    }
    try {
      session = await createSession({
        container, seed: seed || (loaded ? loaded.meta.seed : String(Date.now() % 100000)), quality: ['low', 'medium', 'high'].includes(params.get('quality')) ? params.get('quality') : settings.quality, verify, settings,
        difficulty: loaded ? loaded.meta.difficulty : difficulty, world: loaded, demo,
        scenarioId: loaded ? loaded.meta.scenarioId : scenarioId, campaign: loaded ? null : campaignMemory(),
        onCritical: (id, err) => showErrorOverlay({
          title: 'The game stopped unexpectedly',
          message: `A core system (${id}) failed. Your last save is safe.`,
          detail: err && (err.stack || err.message),
          actions: [
            { label: 'Load last save', primary: true, run: () => { hideErrorOverlay(); const s = latestSave(); if (s) startGame({ slot: s.slot }); else showMain(); } },
            { label: 'Main menu', run: () => { hideErrorOverlay(); showMain(); } },
          ],
        }),
        hooks: {
          blocked: () => menus.open,
          onPause: () => togglePause(),
          onBuildMenu: () => hud && hud.openBuildMenu(),
          onSelection: () => { if (hud) hud.selectionChanged(); if (session) session.audio.ui(); },
          onMarker: (k, x, z) => session && session.marker(k, x, z),
          onToast: (t) => hud && hud.toast(t),
          onQuickSave: () => doSave('quick'),
          onQuickLoad: () => startGame({ slot: 'quick' }),
          onSpeed: (d) => { const sp = SPEEDS; const i = Math.max(0, Math.min(sp.length - 1, sp.indexOf(session.loop.getSpeed()) + d)); session.loop.setSpeed(sp[i]); },
          onFrame: (dt) => { if (cinematic) { cinematic.update(dt); return; } if (hud) hud.update(dt); if (tutorial) tutorial.update(dt); autosave(dt); },
          onUiFailure: (err) => showErrorOverlay({ title: 'The interface stopped responding', message: 'The game is still running. Save and reload, or return to the menu.', detail: err && (err.stack || err.message), actions: [{ label: 'Save and reload', primary: true, run: () => { doSave('quick', true); location.reload(); } }, { label: 'Main menu', run: () => { hideErrorOverlay(); showMain(); } }] }),
        },
      });
    } catch (err) {
      log.error('app', `session failed: ${err.message}`, err);
      menus.close();
      showErrorOverlay({ title: 'Kindlehold could not start the game', message: 'Something went wrong while building the world.', detail: err.stack || err.message, actions: [{ label: 'Main menu', primary: true, run: () => { hideErrorOverlay(); showMain(); } }] });
      return;
    }
    session.loop.setSpeed(settings.gameSpeed);
    hud = createHud({ root: uiRoot, session, input: session.input, settings, actions: {
      pause: () => togglePause(),
      cycleSpeed: () => { const sp = SPEEDS; const i = (sp.indexOf(session.loop.getSpeed()) + 1) % sp.length; session.loop.setSpeed(sp[i]); },
    } });
    // graphics trouble: keep the game safe and tell the player what happened
    let scaledNotice = false;
    session.rc.on('lost', () => {
      doSave('auto', true);
      if (!paused && !ended) togglePause();
      if (hud) hud.toast('The graphics driver was reset. Your game was saved and paused.', 'warn');
    });
    session.rc.on('restored', () => { if (hud) hud.toast('Graphics recovered at a lower resolution. Resume when ready.', 'info'); });
    session.rc.on('scaled', ({ ratio, max, reason }) => {
      if (reason !== 'slow' || scaledNotice || !hud) return;
      scaledNotice = true;
      hud.toast(`Your graphics card is working hard: resolution lowered to ${Math.round((ratio / max) * 100)} %. Settings → Graphics → Quality can help too.`, 'info');
    });
    if (!verify && !slot && !settings.tutorialDone && session.world.meta.scenarioId === 'harrowmere') {
      tutorial = createTutorial({ root: uiRoot, session, settings, onFinish: () => { saveSettings(settings); tutorial = null; } });
    }
    session.sim.bus.on(EV.MISSION_ENDED, ({ result }) => {
      if (ended) return;
      ended = true;
      const w = session.world;
      if (result === 'victory' && !verify) recordVictory(w);
      const next = result === 'victory' ? CAMPAIGN[CAMPAIGN.indexOf(w.meta.scenarioId) + 1] : null;
      setTimeout(() => {
        if (!session) return;
        session.loop.pause();
        const diff = session.world.meta.difficulty, sid = session.world.meta.scenarioId;
        menus.endScreen({ result, world: session.world, onMenu: showMain, onRestart: () => startGame({ difficulty: diff, scenarioId: sid }), onNext: next ? () => startGame({ difficulty: diff, scenarioId: next }) : null });
      }, 2500);
    });
    if (verify || debugApi || import.meta.env.DEV) installVerifyApi(Object.assign(session, { save: (s) => doSave(s || 'quick'), load: (s) => startGame({ slot: s || 'quick' }) }));
    menus.close();
    session.start();
    // a new chapter opens with a flight over the valley while the intro is spoken
    const sc = SCENARIOS[session.world.meta.scenarioId];
    if (intro && !verify && !slot && !demo && sc && sc.cinematic && settings.cinematics !== false) {
      session.loop.pause();
      if (hud) hud.el.hidden = true;
      if (tutorial && tutorial.el) tutorial.el.hidden = true;
      session.setShroud(false);
      const s = session;
      cinematic = playCinematic({ root: uiRoot, rts: session.rc.rts, scenario: sc, reducedMotion: !!settings.reducedMotion, onDone: () => {
        cinematic = null;
        if (session !== s) return;
        session.setShroud(true);
        if (hud) hud.el.hidden = false;
        if (tutorial && tutorial.el) tutorial.el.hidden = false;
        if (!paused) session.loop.resume();
      } });
    }
    await session.firstFrame;
    markReady();
  }

  let autosaveTimer = 0;
  function autosave(dt) {
    if (!session || paused || ended || verify) return;
    autosaveTimer += dt;
    if (autosaveTimer > 120) { autosaveTimer = 0; doSave('auto', true); }
  }

  function doSave(slot, quiet = false) {
    if (!session) return false;
    try {
      session.world.camera = session.rc.rts.serialize();
      saveToSlot(session.world, slot, `Kindlehold — ${session.world.meta.difficulty}`);
      if (!quiet && hud) hud.toast(slot === 'quick' ? 'Quick-saved' : 'Game saved', 'success');
      return true;
    } catch (err) {
      if (hud) hud.toast(`Save failed: ${err.message}`, 'warn');
      return false;
    }
  }

  function togglePause() {
    if (!session || ended) return;
    if (paused) {
      paused = false; menus.close(); session.loop.resume(); session.audio.resume(); return;
    }
    paused = true;
    session.loop.pause();
    menus.pauseMenu({
      onResume: () => togglePause(),
      onSave: (slot) => { doSave(slot); togglePause(); },
      onLoad: (slot) => startGame({ slot }),
      onQuit: () => showMain(),
      onRestart: () => startGame({ difficulty: session.world.meta.difficulty, scenarioId: session.world.meta.scenarioId }),
    });
  }

  if (boot) boot.remove();
  if (verify) {
    // deterministic verification session (no menu)
    const diff = ['story', 'normal', 'hard'].includes(params.get('difficulty')) ? params.get('difficulty') : 'normal';
    await startGame({ seed: params.get('seed') || '1337', demo: params.get('demo') || null, difficulty: diff });
    if (params.get('ui') !== '1' && hud) hud.el.hidden = true; // world-only screenshots
    return;
  }
  // ?start=1 jumps straight into a game (tests, quick checks): no intro flight
  if (params.get('start') === '1') { await startGame({ intro: false, scenarioId: ['greyfen', 'tollbreaker', 'saltroad'].includes(params.get('chapter')) ? params.get('chapter') : 'harrowmere' }); return; }
  showMain();
  markReady();
}
