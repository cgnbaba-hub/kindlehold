// Missions: objectives, tutorial messages, raid warning trigger, victory and defeat.
import { EV, PLAYER, ENEMY } from '../core/contracts.js';
import { all, emit, alert } from '../world/world.js';
import { evaluate } from './conditions.js';
import { setupScenario } from './setup.js';
import { HARROWMERE_SCENARIO } from './scenarios/harrowmere.js';
import { GREYFEN_SCENARIO, TOLLBREAKER_SCENARIO } from './scenarios/campaign.js';
import { SALTROAD_SCENARIO } from './scenarios/saltroad.js';
import { WHITESTAG_SCENARIO } from './scenarios/whitestag.js';
import { IRONDEBT_SCENARIO } from './scenarios/irondebt.js';
import { FREE_SCENARIOS, FREE_PLAY } from './scenarios/freeplay.js';
import { aiSettings, spawnEnemy } from '../ai/index.js';
import { doorOf } from '../buildings/defs.js';
import { addRes } from '../economy/stock.js';
import { reveal } from '../exploration/index.js';
import { setRelation, relation } from '../diplomacy/index.js';
import { enemyFaction } from '../ai/factions.js';

export const SCENARIOS = { harrowmere: HARROWMERE_SCENARIO, greyfen: GREYFEN_SCENARIO, tollbreaker: TOLLBREAKER_SCENARIO, saltroad: SALTROAD_SCENARIO, whitestag: WHITESTAG_SCENARIO, irondebt: IRONDEBT_SCENARIO, ...FREE_SCENARIOS };
/** Free play: one map each, no story. */
export { FREE_PLAY };
/** The campaign in play order. */
export const CAMPAIGN = ['harrowmere', 'greyfen', 'tollbreaker', 'saltroad', 'whitestag', 'irondebt'];

export function scenarioOf(world) { const id = world.mission.scenarioId || world.meta.scenarioId; return Object.hasOwn(SCENARIOS, id) ? SCENARIOS[id] : HARROWMERE_SCENARIO; }

export function createMissionsModule() {
  let ctx = null;
  const unsub = [];

  function say(world, lines, kind = 'dialogue') {
    const sc = scenarioOf(world);
    for (const l of lines) {
      const sp = sc.speakers[l.speaker] || { name: l.speaker, role: '' };
      const msg = { tick: world.tick, speaker: sp.name, role: sp.role, text: l.text, kind, portrait: l.speaker };
      world.mission.messages.push(msg);
      if (world.mission.messages.length > 60) world.mission.messages.shift();
      emit(world, EV.MISSION_MESSAGE, msg);
    }
  }

  function end(world, result, reason) {
    if (world.mission.result) return;
    world.mission.result = result;
    world.mission.endedTick = world.tick;
    world.mission.endReason = reason;
    emit(world, EV.MISSION_ENDED, { result, reason });
  }

  function evaluateObjectives(world) {
    const sc = scenarioOf(world);
    for (const def of sc.objectives) {
      const st = world.mission.objectives.find((o) => o.id === def.id);
      if (!st || st.state === 'done') continue;
      if (st.state === 'pending' && evaluate(world, def.activeWhen)) {
        st.state = 'active';
        st.activatedTick = world.tick;
        emit(world, EV.MISSION_OBJECTIVE, { id: def.id, state: 'active' });
      }
      if (st.state === 'active' && evaluate(world, def.completeWhen)) {
        st.state = 'done';
        st.doneTick = world.tick;
        emit(world, EV.MISSION_OBJECTIVE, { id: def.id, state: 'done' });
        if (def.onComplete) say(world, def.onComplete);
      }
    }
  }

  /** A scripted host (e.g. Vharek and his bodyguard) marches in on the east road towards the Keep. */
  function spawnHost(world, spec) {
    const at = world.enemyEntry || { x: 100, z: -100 };
    const keep = all(world, 'building').find((b) => b.type === 'keep' && b.owner === PLAYER && b.state !== 'destroyed');
    const goal = keep ? doorOf(keep) : { x: 0, z: 0 };
    const types = [...(spec.units || []), ...(spec.commander ? [spec.commander] : [])];
    types.forEach((type, i) => {
      const u = spawnEnemy(world, type, at.x - (i % 4) * 1.8, at.z + Math.floor(i / 4) * 1.8);
      if (!u) return;
      u.host = true;
      u.order = { type: 'attackMove', x: goal.x + (i % 4) - 2, z: goal.z + 2, ax: u.x, az: u.z };
    });
    if (spec.flag) world.mission.flags[spec.flag] = true;
    const c = spec.commander ? all(world, 'unit').find((u) => u.type === spec.commander) : null;
    alert(world, 'danger', spec.alert || 'An enemy host is marching on Kindlehold!', c ? c.x : at.x, c ? c.z : at.z);
  }

  /** A late commander (e.g. Lady Ismay) steps out of the hall to defend it in person. */
  function commanderAtHall(world) {
    const fac = enemyFaction(world);
    const hall = all(world, 'building').find((b) => b.type === fac.hall && b.owner === ENEMY && b.state !== 'destroyed');
    if (!hall || all(world, 'unit').some((u) => u.type === fac.commander)) return;
    const d = doorOf(hall);
    const c = spawnEnemy(world, fac.commander, d.x, d.z + 1);
    if (!c) return;
    c.order = { type: 'guard', ax: d.x, az: d.z + 1, leash: 30 };
    alert(world, 'danger', `${fac.leader} takes the field at the ${fac.hallName}!`, c.x, c.z);
  }

  // scripted story beats: each fires once when its condition holds
  function runEvents(world) {
    const sc = scenarioOf(world);
    const tr = world.mission.triggers;
    for (const ev of sc.events || []) {
      if (tr[ev.id] || !evaluate(world, ev.when)) continue;
      tr[ev.id] = world.tick;
      if (ev.say) say(world, ev.say);
      if (ev.alert) alert(world, ev.alert[0], ev.alert[1]);
      for (const a of ev.actions || []) {
        if (a.grant) for (const r in a.grant) addRes(world, PLAYER, r, a.grant[r], 'story');
        if (a.flag) world.mission.flags[a.flag] = true;
        if (a.unflag) delete world.mission.flags[a.unflag];
        if (a.reveal) reveal(world, ctx.services.terrain.half, a.reveal[0], a.reveal[1], a.reveal[2]);
        if (a.relation) setRelation(world, PLAYER, a.relation[0], relation(world, PLAYER, a.relation[0]) + a.relation[1], 'story');
        if (a.spawnHost) spawnHost(world, a.spawnHost);
        if (a.commanderAtHall) commanderAtHall(world);
        if (a.raidSoon && world.ai.state === 'build') world.ai.raidTick = Math.min(world.ai.raidTick ?? Infinity, world.tick + a.raidSoon * 20);
      }
      emit(world, 'mission:event', { id: ev.id });
    }
  }

  function checkRaidWarning(world) {
    const m = world.mission;
    if (m.flags.raidWarned) return;
    const armsDone = (m.objectives.find((o) => o.id === (scenarioOf(world).raidWarnAfter || 'arms')) || {}).state === 'done';
    if (armsDone || world.tick >= m.raidWarningTick) {
      m.flags.raidWarned = true;
      world.ai.raidTick = world.tick + aiSettings(world).raidDelay * 20;
      say(world, scenarioOf(world).warning);
      alert(world, 'danger', `A ${enemyFaction(world).short} attack is coming! Prepare your defences.`);
      emit(world, 'mission:raid-warning', { raidTick: world.ai.raidTick });
    }
  }

  function checkEnd(world) {
    const sc = scenarioOf(world);
    if (sc.winWhen) { if (evaluate(world, sc.winWhen)) { end(world, 'victory', 'objectives'); return; } }
    else if (!all(world, 'building').some((b) => b.type === enemyFaction(world).hall && b.owner === ENEMY && b.state !== 'destroyed')) { end(world, 'victory', 'warhall-destroyed'); return; }
    const keep = all(world, 'building').some((b) => b.type === 'keep' && b.owner === PLAYER && b.state !== 'destroyed');
    if (!keep) { end(world, 'defeat', 'keep-destroyed'); return; }
    let people = 0;
    for (const s of all(world, 'settler')) if (s.owner === PLAYER) people++;
    let heroUp = false;
    for (const u of all(world, 'unit')) if (u.owner === PLAYER) { if (u.hero) heroUp = heroUp || !u.downed; else people++; }
    for (const b of all(world, 'building')) if (b.owner === PLAYER && b.queue) people += b.queue.filter((q) => q.training).length;
    if (people === 0 && !heroUp) end(world, 'defeat', 'no-one-left');
  }

  return {
    id: 'missions',
    kind: 'sim',
    critical: false,
    init(c) {
      ctx = c;
      unsub.push(c.bus.on('world:setup', () => {
        setupScenario(ctx.world, ctx.services.terrain, scenarioOf(ctx.world));
        say(ctx.world, scenarioOf(ctx.world).intro);
        evaluateObjectives(ctx.world);
        c.bus.emit('world:setup-done', {});
      }));
    },
    update() {
      const world = ctx.world;
      if (world.mission.result) return;
      if (world.tick % 10 === 0) {
        evaluateObjectives(world);
        runEvents(world);
        checkRaidWarning(world);
        checkEnd(world);
      }
    },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
    say: (lines) => say(ctx.world, lines),
  };
}
