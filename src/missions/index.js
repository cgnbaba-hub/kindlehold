// Missions: objectives, tutorial messages, raid warning trigger, victory and defeat.
import { EV, PLAYER, ENEMY } from '../core/contracts.js';
import { all, emit, alert } from '../world/world.js';
import { evaluate } from './conditions.js';
import { setupScenario } from './setup.js';
import { HARROWMERE_SCENARIO } from './scenarios/harrowmere.js';
import { aiSettings } from '../ai/index.js';

export const SCENARIOS = { harrowmere: HARROWMERE_SCENARIO };

export function scenarioOf(world) { const id = world.mission.scenarioId || world.meta.scenarioId; return Object.hasOwn(SCENARIOS, id) ? SCENARIOS[id] : HARROWMERE_SCENARIO; }

export function createMissionsModule() {
  let ctx = null;
  const unsub = [];

  function say(world, lines, kind = 'dialogue') {
    const sc = scenarioOf(world);
    for (const l of lines) {
      const sp = sc.speakers[l.speaker] || { name: l.speaker, role: '' };
      const msg = { tick: world.tick, speaker: sp.name, role: sp.role, text: l.text, kind };
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

  function checkRaidWarning(world) {
    const m = world.mission;
    if (m.flags.raidWarned) return;
    const armsDone = (m.objectives.find((o) => o.id === 'arms') || {}).state === 'done';
    if (armsDone || world.tick >= m.raidWarningTick) {
      m.flags.raidWarned = true;
      world.ai.raidTick = world.tick + aiSettings(world).raidDelay * 20;
      say(world, scenarioOf(world).warning);
      alert(world, 'danger', 'A Rustfang raid is coming! Prepare your defences.');
      emit(world, 'mission:raid-warning', { raidTick: world.ai.raidTick });
    }
  }

  function checkEnd(world) {
    const hall = all(world, 'building').some((b) => b.type === 'warhall' && b.owner === ENEMY && b.state !== 'destroyed');
    if (!hall) { end(world, 'victory', 'warhall-destroyed'); return; }
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
        setupScenario(ctx.world, ctx.services.terrain);
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
        checkRaidWarning(world);
        checkEnd(world);
      }
    },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
    say: (lines) => say(ctx.world, lines),
  };
}
