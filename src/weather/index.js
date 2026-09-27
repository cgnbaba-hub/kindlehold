// Seasons: long summers and short, hard winters on a fixed, deterministic schedule.
// Winter lets the fields rest (crops barely grow) and freezes the Harrow, so the river
// can be crossed anywhere — by the Hearthbound and by the Rustfang. When the ice breaks,
// anyone still on it scrambles ashore soaked and hurt.
import { all, alert, emit } from '../world/world.js';
import { EV } from '../core/contracts.js';
import { stopWalking } from '../navigation/agent.js';
import { scenarioOf } from '../missions/index.js';

const MIN = 60 * 20;
export const SEASON = Object.freeze({
  firstWinter: 17 * MIN,   // the first winter begins at minute 17 (after the first raid)
  winter: 3 * MIN,         // and lasts three minutes
  summer: 8 * MIN,         // then eight minutes of summer until the next
  freezeAfter: 30 * 20,    // the river freezes 30 s into winter
  snowIn: 30 * 20,         // snow cover builds up over 30 s
  melt: 45 * 20,           // and melts over 45 s
  crackWarning: 20 * 20,   // warning before the ice breaks
});
export const WINTER_GROWTH = 0.5; // crops grow at half speed in winter
// Summer showers: a fixed rhythm (deterministic), a little over a minute of rain every five.
export const RAIN = Object.freeze({ every: 5 * MIN, offset: 2 * MIN, length: 75 * 20, fade: 12 * 20, notBefore: 3 * MIN, growth: 1.35 });

/** Rain intensity (0..1) at a tick: pure function, no rain in winter or in the first minutes. */
export function rainAt(tick) {
  if (tick < RAIN.notBefore || seasonAt(tick).winter) return 0;
  const t = (tick + RAIN.offset) % RAIN.every;
  if (t >= RAIN.length) return 0;
  return Math.min(1, t / RAIN.fade, (RAIN.length - t) / RAIN.fade);
}
export const THAW_DAMAGE = 0.25;  // fraction of max HP lost when caught on breaking ice

/** Season at a tick: { winter, sinceStart, untilEnd, untilNext } (pure function of the tick). */
export function seasonAt(tick) {
  const cycle = SEASON.winter + SEASON.summer;
  if (tick < SEASON.firstWinter) return { winter: false, untilNext: SEASON.firstWinter - tick };
  const t = (tick - SEASON.firstWinter) % cycle;
  if (t < SEASON.winter) return { winter: true, sinceStart: t, untilEnd: SEASON.winter - t };
  return { winter: false, untilNext: cycle - t };
}

export function ensureWeather(world) {
  const w = world.weather || (world.weather = { kind: 'clear', intensity: 0 });
  if (w.season == null) { w.season = 'summer'; w.snow = 0; w.frozen = false; }
  return w;
}

export function isWinter(world) { return !!(world.weather && world.weather.season === 'winter'); }
/** Crop growth multiplier for the current season and weather: fields drink up the rain. */
export function growthFactor(world) {
  if (isWinter(world)) return WINTER_GROWTH;
  const w = world.weather;
  return w && w.kind === 'rain' ? 1 + (RAIN.growth - 1) * w.intensity : 1;
}

function say(world, speaker, text) {
  const sc = scenarioOf(world);
  const sp = (sc.speakers && sc.speakers[speaker]) || { name: speaker, role: '' };
  const msg = { tick: world.tick, speaker: sp.name, role: sp.role, text, kind: 'dialogue', portrait: speaker };
  world.mission.messages.push(msg);
  if (world.mission.messages.length > 60) world.mission.messages.shift();
  emit(world, EV.MISSION_MESSAGE, msg);
}

export function createWeatherModule() {
  let ctx = null;
  const unsub = [];

  function syncNav() {
    const nav = ctx.services.nav;
    if (nav && nav.isFrozen() !== !!ctx.world.weather.frozen) nav.setFrozen(ctx.world.weather.frozen);
  }

  function thaw(world) {
    const nav = ctx.services.nav;
    for (const kind of ['unit', 'settler']) {
      for (const e of all(world, kind)) {
        // every walker re-plans: paths across the ice are no longer valid
        stopWalking(e);
        if (nav.walkable(e.x, e.z)) continue;
        const p = nav.nearestWalkablePoint(e.x, e.z, 12);
        if (p) { e.x = p.x; e.z = p.z; e.px = p.x; e.pz = p.z; }
        if (e.hp > 0 && !e.downed) e.hp = Math.max(1, e.hp - e.maxHp * THAW_DAMAGE);
        emit(world, 'weather:soaked', { id: e.id, x: e.x, z: e.z });
      }
    }
  }

  return {
    id: 'weather',
    kind: 'sim',
    init(c) {
      ctx = c;
      unsub.push(c.bus.on('world:loaded', () => { ensureWeather(ctx.world); syncNav(); }));
    },
    update({ tick }) {
      const world = ctx.world;
      const w = ensureWeather(world);
      const s = seasonAt(tick);
      const keep = all(world, 'building').find((b) => b.type === 'keep' && b.owner === 'p1');
      const kx = keep ? keep.x : 0, kz = keep ? keep.z : 0;

      if (!s.winter && s.untilNext === 30 * 20) say(world, 'osric', 'The geese are flying south and the air smells of snow. Winter is coming, Warden — fill the stores while the fields still grow.');
      if (s.winter && w.season !== 'winter') {
        w.season = 'winter'; w.kind = 'snow'; w.intensity = 1;
        alert(world, 'warn', 'Winter has come: crops grow slowly until the thaw.', kx, kz);
        emit(world, 'weather:season', { season: 'winter' });
      } else if (!s.winter && w.season === 'winter') {
        w.season = 'summer'; w.kind = 'clear'; w.intensity = 0;
        emit(world, 'weather:season', { season: 'summer' });
      }
      // summer showers
      if (w.season !== 'winter') {
        const r = rainAt(tick);
        if (r > 0 && w.kind !== 'rain') {
          w.kind = 'rain';
          if (!w.rained) { w.rained = true; say(world, 'osric', 'Rain at last! The fields will drink deep, Warden — crops grow faster while it pours.'); }
          emit(world, 'weather:rain', { on: true });
        } else if (r === 0 && w.kind === 'rain') { w.kind = 'clear'; emit(world, 'weather:rain', { on: false }); }
        w.intensity = w.kind === 'rain' ? Math.round(r * 1000) / 1000 : 0;
      }
      // the ground stays wet for a while after a shower
      w.wet = Math.max(0, Math.min(1, (w.wet || 0) + (w.kind === 'rain' ? w.intensity / (20 * 20) : -1 / (60 * 20))));
      w.wet = Math.round(w.wet * 10000) / 10000;

      // snow cover builds up and melts smoothly
      if (w.season === 'winter') w.snow = Math.min(1, w.snow + 1 / SEASON.snowIn);
      else w.snow = Math.max(0, w.snow - 1 / SEASON.melt);
      // snowfall eases off in the last half minute of winter
      if (w.season === 'winter') w.intensity = s.untilEnd < 30 * 20 ? s.untilEnd / (30 * 20) : 1;

      const shouldFreeze = s.winter && s.sinceStart >= SEASON.freezeAfter;
      if (shouldFreeze && !w.frozen) {
        w.frozen = true;
        say(world, 'wren', 'The Harrow is frozen solid! We can cross the ice anywhere now — but so can the Rustfang. Watch the riverbank.');
        emit(world, 'weather:frozen', { frozen: true });
      }
      if (w.frozen && s.winter && s.untilEnd === SEASON.crackWarning) {
        alert(world, 'danger', 'The ice on the Harrow is cracking! Get everyone off the river.', kx, kz);
      }
      if (!shouldFreeze && w.frozen) {
        w.frozen = false;
        syncNav();
        thaw(world);
        alert(world, 'info', 'The ice has broken — the river can only be crossed at the fords again.', kx, kz);
        emit(world, 'weather:frozen', { frozen: false });
      }
      syncNav();
    },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
  };
}
