// Daily rhythm: in the evening settlers finish what they carry, walk to the nearest house and
// sleep; at dawn they come out and go back to work. Sleepers are safe indoors and do not eat.
// Soldiers and the hero keep watch through the night.
import { all, emit } from '../world/world.js';
import { DT } from '../core/contracts.js';
import { SETTLER } from '../units/defs.js';
import { doorOf } from '../buildings/defs.js';
import { walkTo, stopWalking } from '../navigation/agent.js';
import { abandonTask } from '../economy/index.js';

export const NIGHT = { start: 22, end: 5 };

/** Is this settler's bedtime? Staggered a little per settler so the village empties gradually. */
export function bedtime(s, hour) {
  return hour >= NIGHT.start + (s.id % 5) * 0.2 || hour < NIGHT.end + (s.id % 4) * 0.15;
}
export function isNight(world) { const h = world.time.hour; return h >= NIGHT.start || h < NIGHT.end; }
export function isAsleep(s) { return !!(s.sleep && s.sleep.in); }

function homeFor(world, s) {
  let best = null, bd = Infinity;
  for (const b of all(world, 'building')) {
    if (b.owner !== s.owner || b.state !== 'active' || (b.type !== 'cottage' && b.type !== 'keep')) continue;
    const d = Math.hypot(b.x - s.x, b.z - s.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/** Let go of everything a settler had reserved, so work can be picked up by others. */
function putDownWork(world, s) {
  const t = s.task;
  if (s.job) {
    if (t) {
      if (t.deposit) { const d = world.entities[t.deposit]; if (d && d.reservedBy === s.id) d.reservedBy = null; }
      if (t.prey) { const a = world.entities[t.prey]; if (a && a.reservedBy === s.id) a.reservedBy = null; }
      if (t.plot != null) { const b = world.entities[s.workplace]; if (b && b.plots && b.plots[t.plot]) b.plots[t.plot].tender = undefined; }
    }
    s.task = null;
    stopWalking(s);
  } else if (s.order) {
    if (t && t.deposit) { const d = world.entities[t.deposit]; if (d && d.reservedBy === s.id) d.reservedBy = null; }
    s.task = null;
    stopWalking(s);
  } else abandonTask(world, s);
}

export function createDailyModule() {
  let ctx = null;
  return {
    id: 'daily',
    kind: 'sim',
    init(c) { ctx = c; },
    update() {
      const world = ctx.world;
      const nav = ctx.services.nav;
      const hour = world.time.hour;
      for (const s of all(world, 'settler')) {
        if (s.arriving || s.leaving || s.enlisting || s.fleeing) continue;
        const want = bedtime(s, hour);
        if (!s.sleep) {
          if (!want) continue;
          // finish a delivery first: workers bring their load home, gatherers to the Keep
          if (s.carry && (s.job || s.order)) continue;
          const home = homeFor(world, s);
          if (!home) continue;
          putDownWork(world, s);
          s.sleep = { home: home.id, in: false };
          emit(world, 'settler:bedtime', { id: s.id, home: home.id });
          continue;
        }
        const home = world.entities[s.sleep.home];
        if (!want || !home || home.state !== 'active') {
          // morning (or the house is gone): step outside and get back to work
          s.sleep = null;
          s.hidden = false;
          s.task = null;
          stopWalking(s);
          continue;
        }
        if (!s.sleep.in) {
          const door = doorOf(home);
          const r = walkTo(nav, s, door.x, door.z, SETTLER.speed, DT, 1.0);
          s.anim = r === 'walking' ? 'walk' : 'idle';
          if (r === 'arrived' || r === 'fail') { s.sleep.in = true; s.hidden = true; s.anim = 'idle'; stopWalking(s); s.x = s.px = door.x; s.z = s.pz = door.z; }
        } else { s.px = s.x; s.pz = s.z; }
      }
    },
  };
}
