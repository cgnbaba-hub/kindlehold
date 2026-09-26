// In-game HUD (semantic HTML over the canvas): resources, population, stability,
// clock, objectives + tutorial hints, dialogue, alerts, selection panel, command grid,
// minimap, tooltips, placement banner, toasts.
import { h, icon, portrait, clear, setText, fmtTime } from './dom.js';
import { portraitKey } from './portraits.js';
import { seasonAt } from '../weather/index.js';
import { paydayForecast, TAX_LEVELS, HIRE_COST } from '../population/index.js';
import { POI_INFO, TRADES } from '../pois/index.js';
import { createMinimap } from './minimap.js';
import { all } from '../world/world.js';
import { PLAYER, EV, RESOURCES } from '../core/contracts.js';
import { BUILDINGS, PLAYER_BUILD_ORDER, UPGRADES, nextUpgrade, levelOf, displayName, upgradeBonus, slotsOf } from '../buildings/defs.js';
import { UNITS, RECRUITABLE, COUNTERS } from '../units/defs.js';
import { TECHS, TECH_ORDER } from '../technology/defs.js';
import { researchBlocker } from '../technology/index.js';
import { buildCost, upgradeBlocker } from '../construction/index.js';
import { canAfford } from '../economy/stock.js';
import { ABILITIES } from '../heroes/index.js';
import { STALL_TEXT, WORK } from '../production/index.js';
import { scenarioOf } from '../missions/index.js';
import { aiSettings } from '../ai/index.js';
import { keyLabel, DEFAULT_BINDINGS } from '../input/bindings.js';

const RES_NAMES = { timber: 'Timber', stone: 'Stone', iron: 'Iron', provisions: 'Provisions', taler: 'Taler' };
const CLS_NAMES = { melee: 'Melee', ranged: 'Ranged', defensive: 'Defensive', hero: 'Hero', commander: 'Commander' };
const JOB_NAMES = { forester: 'Forester', quarrier: 'Quarrier', farmer: 'Farmer', miner: 'Miner', hunter: 'Hunter', cook: 'Cook' };

function costRow(cost) {
  const row = h('span.cost');
  for (const r of RESOURCES) if (cost[r]) row.append(h('span.cost-item', {}, [icon(r, 'icon icon-xs'), String(cost[r])]));
  return row;
}

export function createHud({ root, session, input, settings, actions }) {
  const sim = session.sim;
  const world = () => sim.world;
  const bus = sim.bus;
  const unsub = [];
  const bindings = () => ({ ...DEFAULT_BINDINGS, ...(settings.bindings || {}) });

  const hud = h('div.hud', { role: 'region', 'aria-label': 'Game interface' });
  root.append(hud);

  // --- top-left: resource ribbon -------------------------------------------------
  const resEls = {};
  const ribbon = h('div.ribbon.panel', { role: 'group', 'aria-label': 'Stores' });
  for (const r of RESOURCES) {
    const val = h('span.res-val', { text: '0' });
    const rate = h('span.res-rate', { text: '' });
    const el = h('div.res', { 'data-tip': `${RES_NAMES[r]} in the Keep store. Small number: change over the last minute.`, tabindex: 0 }, [icon(r), h('div.res-text', {}, [val, rate])]);
    resEls[r] = { val, rate, el };
    ribbon.append(el);
  }
  const popVal = h('span.res-val', { text: '0/0' });
  const idleVal = h('span.res-rate', { text: '' });
  const popEl = h('div.res', { 'data-tip': 'People / housing. Build Cottages for more housing. Idle = labourers free to haul and build.', tabindex: 0 }, [icon('pop'), h('div.res-text', {}, [popVal, idleVal])]);
  const stabBar = h('div.meter-fill');
  const stabEl = h('div.res.stab', { 'data-tip': 'Stability: fed, housed people work faster. Below 30 no newcomers arrive.', tabindex: 0 }, [icon('stability'), h('div.meter', {}, [stabBar])]);
  ribbon.append(popEl, stabEl);
  hud.append(ribbon);

  // --- top-centre: clock + speed + menu ---------------------------------------------
  const clockIcon = h('span.clock-icon');
  const clockText = h('span.clock-text', { text: '' });
  const speedBtn = h('button.btn-ghost', { type: 'button', 'aria-label': 'Game speed', 'data-tip': 'Game speed ([ and ])' }, ['1×']);
  const pauseBtn = h('button.btn-ghost', { type: 'button', 'aria-label': 'Pause menu', 'data-tip': 'Menu (Esc)' }, [icon('menu')]);
  speedBtn.addEventListener('click', () => actions.cycleSpeed());
  pauseBtn.addEventListener('click', () => actions.pause());
  // skip the night: race to dawn at 8x, then return to the previous speed
  const nightBtn = h('button.night-skip.panel', { type: 'button', 'aria-label': 'Skip the night', 'data-tip': 'Skip the night: time runs at 8× until dawn' }, [icon('moon', 'icon icon-sm'), h('span', { text: ' Skip night' })]);
  nightBtn.hidden = true;
  let skipping = null;
  nightBtn.addEventListener('click', () => { if (skipping == null) { skipping = session.loop.getSpeed(); session.loop.setSpeed(8); } });
  const topbar = h('div.topbar.panel', {}, [clockIcon, clockText, speedBtn, pauseBtn]);
  hud.append(topbar, nightBtn);

  // --- top-right: objectives ----------------------------------------------------------
  const objList = h('ol.obj-list');
  const raidTimer = h('div.raid-timer', { role: 'status' });
  const objPanel = h('section.objectives.panel', { 'aria-label': 'Objectives' }, [h('h2', {}, [icon('objective', 'icon icon-sm'), 'Objectives']), raidTimer, objList]);
  hud.append(objPanel);

  // --- dialogue -----------------------------------------------------------------------
  const dialogue = h('div.dialogue', { role: 'log', 'aria-live': 'polite', 'aria-label': 'Messages' });
  hud.append(dialogue);

  // --- alerts -------------------------------------------------------------------------
  const alerts = h('ul.alerts', { 'aria-live': 'assertive', 'aria-label': 'Alerts' });
  hud.append(alerts);

  // --- bottom: minimap, selection, commands ----------------------------------------------
  const minimap = createMinimap({ terrain: sim.terrain, world, rts: session.rc.rts, onMoveOrder: (x, z) => {
    const ids = world().selection.ids.filter((id) => { const e = world().entities[id]; return e && e.kind === 'unit' && e.owner === PLAYER; });
    if (ids.length) input.issue({ type: 'move', ids, x, z });
  } });
  const mapPanel = h('div.minimap.panel', {}, [minimap.el]);
  const selPanel = h('section.selection.panel', { 'aria-label': 'Selection' });
  const cmdGrid = h('div.cmd-grid');
  const cmdTitle = h('div.cmd-title');
  const cmdPanel = h('section.commands.panel', { 'aria-label': 'Commands' }, [cmdTitle, cmdGrid]);
  const groupBar = h('div.group-bar', { 'aria-label': 'Control groups' });
  hud.append(h('div.bottom-bar', {}, [mapPanel, h('div.sel-col', {}, [groupBar, selPanel]), cmdPanel]));
  let groupSig = '';
  function renderGroups() {
    const w = world();
    const entries = [];
    for (let g = 1; g <= 9; g++) {
      const ids = (w.selection.groups[g] || []).filter((id) => w.entities[id]);
      if (ids.length) entries.push([g, ids]);
    }
    const sig = entries.map(([g, ids]) => `${g}:${ids.length}`).join(',');
    if (sig === groupSig) return;
    groupSig = sig;
    clear(groupBar);
    for (const [g, ids] of entries) {
      const b = h('button.group-chip', { type: 'button', 'data-tip': `Group ${g} (press ${g}; Ctrl+${g} to reassign)` }, [h('strong', { text: String(g) }), h('span', { text: `×${ids.length}` })]);
      b.addEventListener('click', () => input.setSelection(ids));
      groupBar.append(b);
    }
  }

  // --- placement / targeting banner, toasts, tooltip ----------------------------------------
  const banner = h('div.banner', { role: 'status', hidden: true });
  const toasts = h('div.toasts', { 'aria-live': 'polite' });
  const tooltip = h('div.tooltip', { role: 'tooltip', hidden: true });
  const boxEl = h('div.drag-box', { hidden: true });
  hud.append(banner, toasts, tooltip, boxEl);

  // tooltips for any [data-tip]
  let tipTarget = null;
  function showTip(el, x, y) {
    const tip = el.getAttribute('data-tip');
    if (!tip) return;
    clear(tooltip);
    const title = el.getAttribute('data-tip-title');
    if (title) tooltip.append(h('strong', { text: title }));
    tooltip.append(h('span', { text: tip }));
    tooltip.hidden = false;
    const r = tooltip.getBoundingClientRect();
    tooltip.style.left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2)) + 'px';
    tooltip.style.top = Math.max(8, y - r.height - 14) + 'px';
  }
  hud.addEventListener('pointerover', (ev) => { const el = ev.target.closest && ev.target.closest('[data-tip]'); if (el) { tipTarget = el; showTip(el, ev.clientX, el.getBoundingClientRect().top); } });
  hud.addEventListener('pointerout', (ev) => { if (tipTarget && !tipTarget.contains(ev.relatedTarget)) { tooltip.hidden = true; tipTarget = null; } });
  hud.addEventListener('focusin', (ev) => { const el = ev.target.closest && ev.target.closest('[data-tip]'); if (el) { const r = el.getBoundingClientRect(); showTip(el, r.left + r.width / 2, r.top); } });
  hud.addEventListener('focusout', () => { tooltip.hidden = true; });

  function toast(text, kind = 'info') {
    const t = h(`div.toast.toast-${kind}`, { text });
    toasts.append(t);
    while (toasts.children.length > 4) toasts.firstChild.remove();
    setTimeout(() => t.remove(), 2600);
  }

  // --- event feeds ---------------------------------------------------------------------------
  const resHistory = [];
  unsub.push(bus.on(EV.RESOURCE_CHANGED, (d) => { if (d.owner === PLAYER) resHistory.push({ tick: world().tick, res: d.res, delta: d.delta }); }));
  unsub.push(bus.on(EV.COMMAND_REJECTED, (d) => toast(d.reason, 'warn')));
  unsub.push(bus.on(EV.ALERT, (d) => {
    if (d.owner && d.owner !== PLAYER) return;
    const kind = d.level === 'danger' ? 'alertDanger' : d.level === 'warn' ? 'alertWarn' : d.level === 'success' ? 'alertSuccess' : 'alertInfo';
    const li = h(`li.alert.alert-${d.level}`, {}, [icon(kind, 'icon icon-sm'), h('span', { text: d.text })]);
    if (d.x !== undefined) {
      li.tabIndex = 0; li.setAttribute('role', 'button'); li.setAttribute('data-tip', 'Click to look');
      const go = () => session.rc.rts.focus(d.x, d.z);
      li.addEventListener('click', go);
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    }
    alerts.prepend(li);
    while (alerts.children.length > 5) alerts.lastChild.remove();
    setTimeout(() => li.classList.add('fade'), 9000);
    setTimeout(() => li.remove(), 10000);
  }));
  unsub.push(bus.on(EV.MISSION_MESSAGE, (m) => showMessage(m)));
  unsub.push(bus.on(EV.MISSION_OBJECTIVE, (d) => { dirtyObjectives = true; if (d.state === 'done') toast(`Objective complete`, 'success'); }));
  unsub.push(bus.on(EV.TECH_COMPLETED, (d) => { if (d.owner === PLAYER) toast(`${TECHS[d.techId].name} researched`, 'success'); dirtySel = true; }));
  unsub.push(bus.on(EV.BUILDING_COMPLETED, (d) => { if (d.owner === PLAYER) toast(`${BUILDINGS[d.type].name} finished`, 'success'); dirtySel = true; }));

  const msgQueue = [];
  let msgShowing = null, msgTimer = 0;
  function showMessage(m) { msgQueue.push(m); }
  function pumpMessages(dt) {
    if (msgShowing) {
      msgTimer -= dt;
      if (msgTimer <= 0) { msgShowing.classList.add('fade'); const el = msgShowing; setTimeout(() => el.remove(), 400); msgShowing = null; }
    }
    if (!msgShowing && msgQueue.length) {
      const m = msgQueue.shift();
      const pk = portraitKey(m);
      const pic = pk ? portrait(pk) : null;
      msgShowing = h(`div.msg${pic ? '.with-portrait' : ''}`, {}, [pic, h('div.msg-body', {}, [h('div.msg-speaker', {}, [h('strong', { text: m.speaker }), h('span', { text: m.role ? ` — ${m.role}` : '' })]), h('p', { text: m.text })])]);
      clear(dialogue).append(msgShowing);
      msgTimer = Math.max(5, Math.min(11, m.text.length / 14));
    }
  }

  /** Replace {bindingName} placeholders with the player's current key labels. */
  function withKeys(text) { const b = bindings(); return text.replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(b, k) ? keyLabel(b[k]) : m)); }

  // --- objectives -----------------------------------------------------------------------------
  let dirtyObjectives = true;
  function renderObjectives() {
    const w = world();
    const sc = scenarioOf(w);
    clear(objList);
    for (const def of sc.objectives) {
      const st = w.mission.objectives.find((o) => o.id === def.id);
      if (!st || st.state === 'pending') continue;
      if (st.state === 'done' && w.tick - (st.doneTick || 0) > 20 * 25) continue;
      const li = h(`li.obj${st.state === 'done' ? '.done' : ''}${def.optional ? '.optional' : ''}`, {}, [
        h('div.obj-title', {}, [st.state === 'done' ? icon('check', 'icon icon-xs') : h('span.obj-dot'), h('span', { text: def.title })]),
        h('div.obj-text', { text: def.text }),
      ]);
      if (st.state === 'active' && settings.tutorialHints && def.hint) li.append(h('div.obj-hint', { text: withKeys(def.hint) }));
      objList.append(li);
    }
  }

  // --- selection panel ---------------------------------------------------------------------------
  let dirtySel = true;
  let forceCmd = true;
  let lastSelKey = '';
  const sel = () => world().selection.ids.map((id) => world().entities[id]).filter(Boolean);

  function hpBar(frac, label) {
    return h('div.hp', { role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(frac * 100), 'aria-label': label }, [h('div.hp-fill', { style: { width: `${Math.max(0, Math.min(1, frac)) * 100}%` } })]);
  }

  function renderSelection(selPanel) {
    const items = sel();
    if (!items.length) {
      const w = world();
      const p = w.players[PLAYER];
      const idle = all(w, 'settler').filter((s) => s.owner === PLAYER && !s.job).length;
      selPanel.append(h('div.sel-empty', {}, [
        h('h3', { text: 'Kindlehold' }),
        h('p', { text: `${p.pop} people · ${idle} labourers · stability ${Math.round(p.stability)}` }),
        h('p.muted', { text: 'Left-click to select, drag to select soldiers (or labourers), right-click to command.' }),
      ]));
      return;
    }
    if (items.length > 1) {
      const groups = {};
      for (const e of items) { const k = e.kind === 'settler' ? 'settler' : e.type; (groups[k] ||= []).push(e); }
      selPanel.append(h('h3', { text: `${items.length} selected` }));
      const grid = h('div.sel-group');
      for (const k in groups) {
        const hp = groups[k].reduce((s, e) => s + e.hp / e.maxHp, 0) / groups[k].length;
        const b = h('button.sel-chip', { type: 'button', 'data-tip': `Select only ${UNITS[k] ? UNITS[k].name : 'settlers'}` }, [icon(k), h('span', { text: `×${groups[k].length}` }), hpBar(hp, 'health')]);
        b.addEventListener('click', () => input.setSelection(groups[k].map((e) => e.id)));
        grid.append(b);
      }
      selPanel.append(grid);
      if (groups.settler && groups.settler.length === items.length) selPanel.append(h('div.sel-row.small.muted', { text: 'Right-click a tree or rock outcrop: these labourers fell timber or cut stone by hand and carry it to the Keep.' }));
      return;
    }
    const e = items[0];
    const w = world();
    const head = (ic, title, sub) => h('div.sel-head', {}, [icon(ic, 'icon icon-lg'), h('div', {}, [h('h3', { text: title }), h('div.sel-sub', { text: sub })])]);
    if (e.kind === 'building') {
      const def = BUILDINGS[e.type];
      const lvl = levelOf(e);
      selPanel.append(head(e.type, `${displayName(e)}${UPGRADES[e.type] ? ` · Level ${lvl}` : ''}`, e.owner === PLAYER ? (e.state === 'site' ? 'Under construction' : e.state === 'destroyed' ? 'Ruins' : def.desc) : def.desc));
      if (e.upgrade) selPanel.append(h('div.sel-row', {}, [h('span', { text: `Upgrading ${Math.round(e.upgrade.progress * 100)}%` }), hpBar(e.upgrade.progress, 'upgrade progress')]));
      if (e.state === 'site') {
        const need = [];
        for (const r in e.build.required) need.push(`${RES_NAMES[r]} ${Math.min(e.build.required[r], e.build.supplied[r] || 0)}/${e.build.required[r]}`);
        selPanel.append(h('div.sel-row', {}, [h('span', { text: `Progress ${Math.round(e.build.progress * 100)}%` }), hpBar(e.build.progress, 'construction progress')]));
        selPanel.append(h('div.sel-row.small', { text: `Materials delivered: ${need.join(' · ')}` }));
        selPanel.append(h('div.sel-row.small', { text: `Builders: ${e.build.builders.length}/3` }));
      } else if (e.state === 'active') {
        selPanel.append(h('div.sel-row', {}, [h('span', { text: `Health ${Math.ceil(e.hp)}/${e.maxHp}` }), hpBar(e.hp / e.maxHp, 'health')]));
        if (def.slots) selPanel.append(h('div.sel-row.small', { text: `${JOB_NAMES[def.job]}s: ${e.workers.length}/${slotsOf(e)}` }));
        let out = 0; for (const r in e.stock.out) out += e.stock.out[r];
        if (def.outCap) selPanel.append(h('div.sel-row.small', { text: `Waiting for pickup: ${out}/${def.outCap} ${RES_NAMES[WORK[def.job].res].toLowerCase()}` }));
        if (def.inCap) selPanel.append(h('div.sel-row.small', { text: `Provisions for the ${e.type === 'canteen' ? 'kitchen' : 'miners'}: ${e.stock.in.provisions || 0}/${def.inCap}` }));
        if (e.type === 'canteen') selPanel.append(h('div.sel-row.small', { text: `Hot meals ready: ${Math.floor(e.meals || 0)}/${def.mealCap} — served first at every mealtime` }));
        if (def.housing) selPanel.append(h('div.sel-row.small', { text: `Houses ${def.housing + upgradeBonus(e, 'housing') + (e.type === 'keep' && w.players[PLAYER].techs.charter ? 6 : 0)} people` }));
        if (e.type === 'farm' && e.plots) selPanel.append(h('div.sel-row.small', { text: `Fields: ${e.plots.filter((p) => p.state === 'ripe').length} ripe, ${e.plots.filter((p) => p.state === 'growing').length} growing` }));
        if (e.type === 'keep') {
          const p = w.players[PLAYER];
          if (!e.lit) selPanel.append(h('div.sel-warn', { text: 'The hearth is dark. Rekindle it so settlers come home.' }));
          if (p.research) selPanel.append(h('div.sel-row', {}, [h('span', { text: `Studying ${TECHS[p.research.techId].name}` }), hpBar(p.research.progress, 'research')]));
          const studied = TECH_ORDER.filter((id) => p.techs[id]).map((id) => TECHS[id].name);
          if (studied.length) selPanel.append(h('div.sel-row.small.muted', { text: `Studied: ${studied.join(', ')}` }));
          // treasury: tax level and the next payday
          const f = paydayForecast(w, PLAYER);
          const taxRow = h('div.tax-row', { role: 'group', 'aria-label': 'Tax level' }, [h('span', { text: 'Taxes' })]);
          TAX_LEVELS.forEach((lvl, i) => {
            const b = h(`button.tax-btn${(p.tax ?? 1) === i ? '.active' : ''}`, { type: 'button', 'aria-pressed': (p.tax ?? 1) === i ? 'true' : 'false', 'data-tip': `${lvl.perSettler} Taler per settler each payday · stability ${lvl.stability > 0 ? '+' : ''}${lvl.stability}` , text: lvl.name });
            b.addEventListener('click', () => { input.issue({ type: 'setTax', level: i }); setTimeout(() => { dirtySel = true; }, 120); });
            taxRow.append(b);
          });
          selPanel.append(taxRow);
          selPanel.append(h('div.sel-row.small', { text: `Payday in ${fmtTime(Math.max(0, (p.nextPayTick ?? 0) - w.tick) / 20)}: +${f.taxes} taxes from ${f.settlers} settlers${f.pay ? `, −${f.pay} pay for ${f.soldiers} soldiers` : ''}` }));
        }
        if (e.type === 'barracks' && e.queue.length) {
          const q = h('div.queue');
          e.queue.forEach((it, i) => {
            const b = h('button.queue-item', { type: 'button', 'data-tip': it.training ? 'Training' : 'Waiting for a settler — click to cancel' }, [icon(it.unitType, 'icon icon-sm'), i === 0 && it.training ? hpBar(it.progress, 'training') : null]);
            b.addEventListener('click', () => input.issue({ type: 'cancelRecruit', building: e.id, index: i }));
            q.append(b);
          });
          selPanel.append(q);
        }
        if (e.stall && STALL_TEXT[e.stall]) selPanel.append(h('div.sel-warn', { role: 'status', text: STALL_TEXT[e.stall] }));
      }
      return;
    }
    if (e.kind === 'unit') {
      const def = UNITS[e.type];
      const counters = Object.keys((COUNTERS[def.cls] || {})).map((c) => CLS_NAMES[c]).join(', ');
      selPanel.append(head(e.type, def.name, def.title ? `${def.title} · ${CLS_NAMES[def.cls]}` : `${CLS_NAMES[def.cls]}${e.owner !== PLAYER ? ' · Rustfang' : ''}`));
      selPanel.append(h('div.sel-row', {}, [h('span', { text: e.downed ? 'Recovering…' : `Health ${Math.ceil(e.hp)}/${e.maxHp}` }), hpBar(e.hp / e.maxHp, 'health')]));
      const dmg = def.damage * (e.owner === PLAYER && !e.hero && w.players[PLAYER].techs.blades ? 1.25 : 1);
      selPanel.append(h('div.stats', {}, [
        h('span', { 'data-tip': 'Damage per hit' }, [icon('sword', 'icon icon-xs'), String(Math.round(dmg))]),
        h('span', { 'data-tip': 'Armour (subtracted from each hit)' }, [icon('hold', 'icon icon-xs'), String(def.armor)]),
        h('span', { 'data-tip': 'Attack range (m)' }, [icon('attackMove', 'icon icon-xs'), `${def.range} m`]),
      ]));
      if (counters) selPanel.append(h('div.sel-row.small', { text: `Strong against ${counters}` }));
      selPanel.append(h('div.sel-row.small.muted', { text: def.desc }));
      if (e.hero) selPanel.append(h('div.sel-row.small', { text: 'Hearthlight: allies within 10 m regenerate and take 10% less damage.' }));
      return;
    }
    if (e.kind === 'settler') {
      const what = e.job ? JOB_NAMES[e.job] : 'Labourer';
      let doing = 'Idle';
      if (e.fleeing) doing = 'Fleeing to the Keep!';
      else if (e.sleep) doing = e.sleep.in ? 'Asleep at home' : 'Heading home for the night';
      else if (e.arriving) doing = 'Arriving in Kindlehold';
      else if (e.enlisting) doing = 'Going to the Barracks to train';
      else if (e.order) doing = e.carry ? `Carrying ${e.carry.amt} ${RES_NAMES[e.carry.res].toLowerCase()} to the Keep (your order)` : `${e.order.kind === 'tree' ? 'Felling trees' : 'Cutting stone'} by hand (your order)`;
      else if (e.job) doing = e.carry ? `Carrying ${e.carry.amt} ${RES_NAMES[e.carry.res].toLowerCase()}` : `Working at the ${BUILDINGS[w.entities[e.workplace] ? w.entities[e.workplace].type : 'keep'].name}`;
      else if (e.task) doing = { supply: 'Carrying building materials', build: 'Building', haul: 'Hauling goods to the Keep', deliver: 'Delivering provisions', repair: 'Repairing', idle: 'Idle at the hearth' }[e.task.type] || 'Busy';
      selPanel.append(head('settler', what, doing));
      selPanel.append(h('div.sel-row', {}, [h('span', { text: `Health ${Math.ceil(e.hp)}/${e.maxHp}` }), hpBar(e.hp / e.maxHp, 'health')]));
      if (e.owner === PLAYER && !e.order) selPanel.append(h('div.sel-row.small.muted', { text: 'Right-click a tree or rock outcrop to gather there by hand.' }));
      return;
    }
    if (e.kind === 'poi') {
      const info = POI_INFO[e.type];
      const status = { found: e.type === 'hamlet' ? 'Send Maren here to win the hamlet over.' : e.type === 'trader' ? 'Open for trade: see the buttons on the right.' : 'Send anyone here to see what it holds.', done: { cairn: 'Climbed — the view is mapped.', ruin: 'The cache has been recovered.', hamlet: 'Allied: families joined Kindlehold; a tithe comes every payday.', trader: '' }[e.type] }[e.state] || '';
      selPanel.append(head(e.type === 'trader' ? 'taler' : e.type === 'hamlet' ? 'cottage' : e.type === 'ruin' ? 'stone' : 'objective', info.name, info.desc));
      if (status) selPanel.append(h('div.sel-row.small', { text: status }));
      return;
    }
    if (e.kind === 'deposit') {
      const name = { tree: 'Tree', rock: 'Rock outcrop', iron: 'Iron vein' }[e.type];
      selPanel.append(head(e.type === 'iron' ? 'vein' : e.type, name, e.type === 'iron' ? 'Build an Iron Mine within 10 m.' : `${e.amount} ${e.type === 'tree' ? 'timber' : 'stone'} left`));
    }
  }

  // --- command grid ------------------------------------------------------------------------------
  let cmdMode = 'auto'; // 'auto' | 'build'
  let confirmDemolish = 0;
  const SHORT = { 'Back to work': 'Release', 'Upgrading…': 'Upgrading', 'Steel Mail': 'Mail', 'Veteran Drill': 'Drill', 'Kindle the Line': 'Kindle', 'Beacon Flare': 'Flare', 'Rekindle the Hearth': 'Rekindle', 'Hold position': 'Hold', 'Cancel construction': 'Cancel', 'Set rally point': 'Rally', 'Resume work': 'Resume', 'Pause work': 'Pause', 'Click again to demolish': 'Confirm', "Woodcutter's Lodge": 'Lodge', 'Iron Mine': 'Mine' };
  function shortLabel(l) { if (SHORT[l]) return SHORT[l]; return l.replace(/^Train /, '').split(' ')[0]; }
  function cmdButton({ ic, label, key, tip, tipTitle, onClick, disabled = false, cost = null, progress = null, cooldown = null, active = false, highlight = false }) {
    const b = h(`button.cmd${active ? '.active' : ''}${highlight ? '.pulse' : ''}`, { type: 'button', 'aria-label': label, 'data-tip': tip || label, 'data-tip-title': tipTitle || label, 'aria-disabled': disabled ? 'true' : 'false' }, [icon(ic, 'icon icon-md'), cost ? null : h('span.cmd-label', { text: shortLabel(label) })]);
    if (key) b.append(h('span.cmd-key', { text: keyLabel(key) }));
    if (cost) b.append(costRow(cost));
    if (progress !== null) b.append(h('div.cmd-progress', { style: { height: `${Math.round(progress * 100)}%` } }));
    if (cooldown) b.append(h('div.cmd-cooldown', { text: String(Math.ceil(cooldown)) }));
    if (disabled) b.classList.add('disabled');
    b.addEventListener('click', () => { if (!disabled) onClick(); else if (tip) toast(tip.split('.')[0], 'warn'); });
    return b;
  }

  function renderCommands(cmdGrid, cmdTitle) {
    const w = world();
    const p = w.players[PLAYER];
    const items = sel();
    const bb = bindings();
    const one = items.length === 1 ? items[0] : null;
    const units = items.filter((e) => e.kind === 'unit' && e.owner === PLAYER && !e.downed);
    const activeObj = scenarioOf(w).objectives.find((o) => { const st = w.mission.objectives.find((x) => x.id === o.id); return st && st.state === 'active' && !o.optional; });
    const hl = settings.tutorialHints && activeObj ? activeObj.highlight : null;
    const serfs = items.filter((e) => e.kind === 'settler' && e.owner === PLAYER);
    if (cmdMode !== 'build' && serfs.length && serfs.length === items.length && serfs.some((e) => e.order)) {
      setText(cmdTitle, 'Labourers');
      cmdGrid.append(cmdButton({ ic: 'stop', label: 'Back to work', tip: 'Stop gathering by hand; they return to hauling and building on their own.', onClick: () => input.issue({ type: 'release', ids: serfs.map((e) => e.id) }) }));
      cmdGrid.append(cmdButton({ ic: 'build', label: 'Build…', key: bb.buildMenu, tip: 'Open the construction menu.', onClick: () => { cmdMode = 'build'; dirtySel = true; } }));
      return;
    }
    if (one && one.kind === 'poi' && one.type === 'trader' && one.state !== 'hidden' && cmdMode !== 'build') {
      setText(cmdTitle, 'Trade');
      for (const d of TRADES) {
        const afford = canAfford(w, PLAYER, d.give);
        const got = Object.entries(d.get).map(([r, n]) => `${n} ${RES_NAMES[r].toLowerCase()}`).join(', ');
        cmdGrid.append(cmdButton({ ic: Object.keys(d.get)[0], label: d.label, tipTitle: d.label, tip: afford ? `You receive ${got}.` : `Not enough to trade. You would receive ${got}.`, cost: d.give, disabled: !afford, onClick: () => input.issue({ type: 'trade', id: one.id, deal: d.id }) }));
      }
      return;
    }
    if (cmdMode === 'build' || (!items.length) || (serfs.length && serfs.length === items.length)) {
      setText(cmdTitle, 'Build');
      for (const type of PLAYER_BUILD_ORDER) {
        const def = BUILDINGS[type];
        const cost = buildCost(w, PLAYER, type);
        const locked = def.requiresTech && !p.techs[def.requiresTech];
        const afford = canAfford(w, PLAYER, cost);
        cmdGrid.append(cmdButton({
          ic: type, label: def.name, tipTitle: def.name,
          tip: locked ? `Requires the March Charter (research at the Keep). ${def.desc}` : afford ? def.desc : `Not enough resources. ${def.desc}`,
          disabled: locked || !afford, cost, highlight: hl === `build:${type}` || (hl === 'build' && (type === 'lodge' || type === 'farm')),
          onClick: () => { input.startPlacement(type); cmdMode = 'auto'; },
        }));
      }
      if (cmdMode === 'build' && items.length) cmdGrid.append(cmdButton({ ic: 'cancel', label: 'Back', tip: 'Back to commands', onClick: () => { cmdMode = 'auto'; dirtySel = true; } }));
      return;
    }
    if (units.length) {
      const hero = units.find((u) => u.hero);
      setText(cmdTitle, hero && units.length === 1 ? 'Maren Ashgrove' : 'Orders');
      cmdGrid.append(cmdButton({ ic: 'move', label: 'Move', tip: 'Then left-click a destination (or simply right-click the ground). Groups keep formation.', onClick: () => input.beginTarget('move'), active: input.state.targetKind === 'move' }));
      cmdGrid.append(cmdButton({ ic: 'attackMove', label: 'Attack-move', key: bb.attackMove, tip: 'Move and fight anything met on the way. Then left-click a target point.', onClick: () => input.beginTarget('attackMove'), active: input.state.targetKind === 'attackMove' }));
      cmdGrid.append(cmdButton({ ic: 'patrol', label: 'Patrol', key: bb.patrol, tip: 'Walk back and forth, engaging enemies.', onClick: () => input.beginTarget('patrol'), active: input.state.targetKind === 'patrol' }));
      cmdGrid.append(cmdButton({ ic: 'stop', label: 'Stop', key: bb.stop, tip: 'Stop and guard the current spot.', onClick: () => input.issue({ type: 'stop', ids: units.map((u) => u.id) }) }));
      cmdGrid.append(cmdButton({ ic: 'hold', label: 'Hold position', key: bb.hold, tip: 'Never move; only strike enemies in reach.', onClick: () => input.issue({ type: 'hold', ids: units.map((u) => u.id) }) }));
      if (hero) {
        for (const ab of [ABILITIES.flare, ABILITIES.kindle]) {
          const cd = Math.max(0, ((hero.abilityCd && hero.abilityCd[ab.id]) || 0) - w.tick) / 20;
          const key = ab.id === 'flare' ? bb.abilityFlare : bb.abilityKindle;
          cmdGrid.append(cmdButton({ ic: ab.id, label: ab.name, key, tipTitle: `${ab.name} (${ab.cooldown}s cooldown)`, tip: ab.desc, cooldown: cd > 0 ? cd : null, disabled: cd > 0, active: input.state.targetKind === ab.id, onClick: () => input.beginTarget(ab.id), highlight: hl === 'army' && cd <= 0 }));
        }
      }
      return;
    }
    if (one && one.kind === 'building' && one.owner === PLAYER) {
      const def = BUILDINGS[one.type];
      setText(cmdTitle, def.name);
      if (one.state === 'site') {
        cmdGrid.append(cmdButton({ ic: 'cancel', label: 'Cancel construction', tip: 'Refunds undelivered materials in full, delivered ones by half once work has begun.', onClick: () => { input.issue({ type: 'cancel', id: one.id }); input.setSelection([]); } }));
        return;
      }
      if (one.state !== 'active') return;
      // upgrade to the next level (or its progress)
      const up = nextUpgrade(one);
      if (up || one.upgrade) {
        if (one.upgrade) cmdGrid.append(cmdButton({ ic: 'bracing', label: 'Upgrading…', tipTitle: `Upgrading to ${up ? up.name : ''}`, tip: up ? up.desc : '', progress: one.upgrade.progress, disabled: true, onClick: () => {} }));
        else {
          const why = upgradeBlocker(w, PLAYER, one);
          const afford = canAfford(w, PLAYER, up.cost);
          cmdGrid.append(cmdButton({ ic: 'bracing', label: `Upgrade to ${up.name}`, tipTitle: `Upgrade to ${up.name} (level ${levelOf(one) + 1})`, tip: why ? `${why}. ${up.desc}` : afford ? `${up.desc} Takes ${up.time}s; the building keeps working.` : `Not enough resources. ${up.desc}`, cost: up.cost, disabled: !!why || !afford, onClick: () => input.issue({ type: 'upgrade', id: one.id }) }));
        }
      }
      if (one.type === 'keep') {
        if (!one.lit) cmdGrid.append(cmdButton({ ic: 'rekindle', label: 'Rekindle the Hearth', tip: 'Light the keep fire. Settlers will return to Kindlehold.', highlight: hl === 'keep', onClick: () => input.issue({ type: 'rekindle' }) }));
        else {
          const full = p.pop >= p.popCap;
          cmdGrid.append(cmdButton({ ic: 'settler', label: 'Hire labourer', tipTitle: `Hire a labourer (${HIRE_COST} Taler)`, tip: full ? 'No free housing — build Cottages first.' : p.res.taler < HIRE_COST ? `Not enough Taler. Taxes come in every payday.` : 'A labourer joins at once, straight from the Keep.', cost: { taler: HIRE_COST }, disabled: full || p.res.taler < HIRE_COST, onClick: () => input.issue({ type: 'hireSettler' }) }));
        }
        for (const id of TECH_ORDER) {
          const t = TECHS[id];
          const done = p.techs[id];
          if (done) continue; // finished studies are listed in the Keep panel, not as buttons
          const why = researchBlocker(w, PLAYER, id);
          const running = p.research && p.research.techId === id;
          cmdGrid.append(cmdButton({
            ic: id, label: t.name, tipTitle: `${t.name} · ${t.branch}${done ? ' (done)' : ''}`,
            tip: done ? t.desc : running ? `Researching… ${t.desc}` : why ? `${why}. ${t.desc}` : `${t.desc} (${t.time}s)`,
            disabled: !!why && !running, cost: done ? null : t.cost, progress: running ? p.research.progress : null, active: done,
            highlight: hl === 'research' && !why,
            onClick: () => input.issue({ type: 'research', techId: id }),
          }));
        }
        cmdGrid.append(cmdButton({ ic: 'build', label: 'Build…', key: bb.buildMenu, tip: 'Open the construction menu.', highlight: hl && hl.startsWith('build'), onClick: () => { cmdMode = 'build'; dirtySel = true; } }));
        return;
      }
      if (one.type === 'barracks') {
        for (const type of RECRUITABLE) {
          const u = UNITS[type];
          const afford = canAfford(w, PLAYER, u.cost);
          cmdGrid.append(cmdButton({ ic: type, label: `Train ${u.name}`, tipTitle: u.name, tip: afford ? `${u.desc} Uses one idle settler.` : `Not enough resources. ${u.desc}`, cost: u.cost, disabled: !afford || one.queue.length >= 5, highlight: hl === 'build:barracks', onClick: () => input.issue({ type: 'recruit', building: one.id, unitType: type }) }));
        }
        cmdGrid.append(cmdButton({ ic: 'patrol', label: 'Set rally point', tip: 'Right-click the ground while the Barracks is selected.', onClick: () => toast('Right-click the ground to set the rally point', 'info') }));
      }
      if (def.slots) {
        cmdGrid.append(cmdButton({ ic: one.paused ? 'play' : 'pause', label: one.paused ? 'Resume work' : 'Pause work', tip: one.paused ? 'Let workers return to this building.' : 'Frees its workers for other work: hauling, building, other workplaces or soldier training. Useful when goods pile up or people are short.', active: !!one.paused, onClick: () => input.issue({ type: 'toggleWork', id: one.id }) }));
      }
      const demoArmed = performance.now() - confirmDemolish < 3000;
      cmdGrid.append(cmdButton({ ic: 'demolish', label: demoArmed ? 'Click again to demolish' : 'Demolish', tip: 'Tear down this building (30% refund). Click twice to confirm.', active: demoArmed, onClick: () => {
        if (performance.now() - confirmDemolish < 3000) { input.issue({ type: 'demolish', id: one.id }); input.setSelection([]); confirmDemolish = 0; }
        else { confirmDemolish = performance.now(); dirtySel = true; toast('Click Demolish again to confirm', 'warn'); }
      } }));
      return;
    }
    setText(cmdTitle, '');
  }

  // --- periodic refresh ------------------------------------------------------------------------
  let t = 0, slow = 0;
  function update(dt) {
    const w = world();
    const p = w.players[PLAYER];
    t += dt; slow += dt;
    pumpMessages(dt);
    minimap.update(dt);
    // drag box
    const st = input.state;
    if (st.box) {
      boxEl.hidden = false;
      Object.assign(boxEl.style, { left: `${Math.min(st.box.x0, st.box.x1)}px`, top: `${Math.min(st.box.y0, st.box.y1)}px`, width: `${Math.abs(st.box.x1 - st.box.x0)}px`, height: `${Math.abs(st.box.y1 - st.box.y0)}px` });
    } else boxEl.hidden = true;
    // banner
    if (st.mode === 'place') {
      banner.hidden = false;
      const reason = session.overlay ? session.overlay.placementReason : '';
      setText(banner, `Placing ${BUILDINGS[st.placeType].name} — left-click to build, ${keyLabel(bindings().rotateLeft)}/${keyLabel(bindings().rotateRight)} to rotate, right-click to cancel${reason ? ' · ' + reason : ''}`);
      banner.classList.toggle('bad', !!reason);
    } else if (st.mode === 'target') {
      banner.hidden = false; banner.classList.remove('bad');
      setText(banner, st.targetKind === 'flare' ? 'Beacon Flare — left-click where the lantern should burst (right-click to cancel)' : `${{ patrol: 'Patrol', move: 'Move', attackMove: 'Attack-move' }[st.targetKind] || 'Order'} — left-click a destination (right-click to cancel)`);
    } else banner.hidden = true;
    if (t < 0.2 && dt !== 0) return; // dt 0 = explicit redraw (e.g. frozen frame): refresh now
    t = 0;
    // resources + rates over the last minute
    while (resHistory.length && w.tick - resHistory[0].tick > 1200) resHistory.shift();
    const rates = { timber: 0, stone: 0, iron: 0, provisions: 0, taler: 0 };
    for (const r of resHistory) rates[r.res] += r.delta;
    for (const r of RESOURCES) {
      setText(resEls[r].val, Math.floor(p.res[r]));
      const rt = Math.round(rates[r]);
      setText(resEls[r].rate, rt ? `${rt > 0 ? '+' : ''}${rt}/min` : '');
      resEls[r].rate.className = `res-rate ${rt < 0 ? 'neg' : 'pos'}`;
    }
    setText(popVal, `${p.pop}/${p.popCap}`);
    const idle = all(w, 'settler').filter((s) => s.owner === PLAYER && !s.job).length;
    setText(idleVal, `${idle} labourers`);
    popEl.classList.toggle('warn', p.pop >= p.popCap);
    stabBar.style.width = `${Math.round(p.stability)}%`;
    stabBar.className = `meter-fill ${p.stability < 30 ? 'bad' : p.stability < 55 ? 'mid' : 'good'}`;
    stabEl.setAttribute('aria-label', `Stability ${Math.round(p.stability)} of 100`);
    // clock
    const hour = w.time.hour;
    const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
    clear(clockIcon).append(icon(hour > 6 && hour < 19 ? 'sun' : 'moon', 'icon icon-sm'));
    const ss = seasonAt(w.tick);
    // season: compact (the top bar must stay clear of the ribbon at 1280 px); details in the tooltip
    const season = ss.winter ? ` · ❄ ${fmtTime(ss.untilEnd / 20)}` : ss.untilNext <= 60 * 20 ? ` · ❄ in ${fmtTime(ss.untilNext / 20)}` : '';
    // time of day first and unmistakable; the elapsed match time lives in the tooltip
    const day = w.time.day || 1;
    setText(clockText, `Day ${day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${season}`);
    clockText.setAttribute('data-tip', `Time of day ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} (a day lasts about ${Math.round(w.time.dayLengthTicks / 1200 * 0.78)} minutes; nights pass quickly). Played ${fmtTime(w.tick / 20)}. ${ss.winter ? `Winter: crops grow slowly, the river is frozen. Thaw in ${fmtTime(ss.untilEnd / 20)}.` : `Summer. Next winter in ${fmtTime(ss.untilNext / 20)}.`}`);
    const nightNow = hour >= 21.5 || hour < 5;
    if (skipping != null && !nightNow) { session.loop.setSpeed(skipping); skipping = null; }
    nightBtn.hidden = !nightNow || skipping != null;
    setText(speedBtn, session.loop.isPaused() ? 'II' : `${session.loop.getSpeed()}×`);
    // raid countdown
    if (w.ai.raidTick != null && w.ai.state === 'build' && w.mission.flags.raidWarned) {
      raidTimer.hidden = false; setText(raidTimer, `Rustfang raid in ${fmtTime((w.ai.raidTick - w.tick) / 20)}`);
    } else if (w.ai.state === 'raid') { raidTimer.hidden = false; setText(raidTimer, 'Raid in progress!'); }
    else if (w.ai.wave >= 1) {
      const cfg = aiSettings(w);
      const left = Math.max(0, cfg.reserves - (w.ai.spawned || 0));
      raidTimer.hidden = false;
      setText(raidTimer, left > 0 ? `Scouts: the Rustfang can still muster about ${left} more warriors` : 'Scouts: the Rustfang reserves are exhausted — strike now!');
    } else raidTimer.hidden = true;
    // selection/commands refresh when content changes or twice per second
    const key = `${w.selection.ids.join(',')}|${cmdMode}|${st.mode}|${st.targetKind}`;
    if (key !== lastSelKey) { lastSelKey = key; dirtySel = true; forceCmd = true; }
    if (dirtySel || slow > 0.5) {
      slow = 0; dirtySel = false;
      // build off-DOM and swap only when the markup changed, so clicks are never lost
      const s2 = h('div'); renderSelection(s2);
      if (s2.innerHTML !== selPanel.innerHTML) { clear(selPanel); while (s2.firstChild) selPanel.append(s2.firstChild); }
      const g2 = h('div'), t2 = h('div'); renderCommands(g2, t2);
      if (g2.innerHTML !== cmdGrid.innerHTML || forceCmd) { forceCmd = false; clear(cmdGrid); while (g2.firstChild) cmdGrid.append(g2.firstChild); }
      setText(cmdTitle, t2.textContent);
    }
    if (dirtyObjectives || w.tick % 100 < 5) { renderObjectives(); dirtyObjectives = false; }
    renderGroups();
  }

  return {
    el: hud,
    update,
    toast,
    openBuildMenu() { cmdMode = cmdMode === 'build' ? 'auto' : 'build'; dirtySel = true; },
    selectionChanged() { cmdMode = 'auto'; dirtySel = true; },
    dispose() { unsub.forEach((u) => u()); hud.remove(); },
  };
}
