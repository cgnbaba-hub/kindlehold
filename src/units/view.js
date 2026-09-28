// Units view: draws settlers, soldiers, heroes and enemies with interpolated motion and
// state-driven animation; keeps short-lived fallen bodies after deaths.
import * as THREE from 'three';
import { all } from '../world/world.js';
import { EV } from '../core/contracts.js';
import { UNITS } from './defs.js';
import { createFigureRenderer } from './figures.js';

const CORPSE_SECONDS = 6;
const BLEND = 0.22; // seconds to cross-fade from one animation into the next
const STRIDE = 1.8; // metres per full stride cycle at figure scale 1: 4 x hip height x sin(swing 0.52), so feet do not slide

export function createUnitsView({ scene, terrain, world, bus, getZoom = () => 60 }) {
  const figs = createFigureRenderer({ scene });
  const corpses = [];
  const unsub = [];
  unsub.push(bus.on(EV.UNIT_DIED, (d) => {
    if (corpses.length > 60) corpses.shift();
    corpses.push({ ...d, t0: -1 });
    headings.delete(d.id); lastHp.delete(d.id); hitAt.delete(d.id); motion.delete(d.id); acks.delete(d.id);
  }));
  // the player's soldiers answer orders with a short gesture
  const acks = new Map();
  unsub.push(bus.on(EV.UNIT_ORDER, (d) => {
    if (d.owner !== 'p1') return;
    const kind = d.order === 'attack' || d.order === 'attackMove' ? 'attack' : 'move';
    d.ids.forEach((id, i) => acks.set(id, { t0: time + (i % 5) * 0.06, kind }));
  }));
  const ack = { kind: 'move', k: 0 };
  const f = { lanternOut: new THREE.Vector3() };
  const att = { since: 9, until: 9, wind: 0.4 };
  const heroLantern = new THREE.Vector3();
  let time = 0;

  function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  const headings = new Map();
  const talk = new Map(); // settler id -> heading towards a chatting neighbour (view only)
  // per figure: stride phase from the distance walked, and the animation cross-fade
  const motion = new Map();
  let prune = 0;
  function animate(e, x, z, anim, scale, dt) {
    let m = motion.get(e.id);
    if (!m) { m = { x, z, ph: (e.id % 7) * 0.9, anim, from: null, since: 1, seen: 0 }; motion.set(e.id, m); }
    m.seen = time;
    const d = Math.hypot(x - m.x, z - m.z);
    m.x = x; m.z = z;
    // one full cycle every STRIDE metres (longer strides when running); jumps (teleports) ignored
    if (d < 3) m.ph += (d / (STRIDE * scale * (anim === 'run' ? 1.35 : 1))) * Math.PI * 2;
    if (anim !== m.anim) { m.from = m.anim; m.anim = anim; m.since = 0; }
    else m.since += dt;
    f.walkPh = m.ph;
    f.blendFrom = m.since < BLEND ? m.from : null;
    f.blendW = Math.min(1, m.since / BLEND);
  }
  // hit flinch: remember each unit's health and when it last dropped (view time, seconds)
  const lastHp = new Map(), hitAt = new Map();
  function hitAmount(u) {
    const prev = lastHp.get(u.id);
    if (prev !== undefined && u.hp < prev - 0.5) hitAt.set(u.id, time);
    lastHp.set(u.id, u.hp);
    const t0 = hitAt.get(u.id);
    if (t0 === undefined) return 0;
    const k = (time - t0) / 0.28;
    return k >= 1 ? 0 : Math.sin(k * Math.PI);
  }

  function smoothHeading(e, dt, override) {
    const target = override !== undefined ? override : e.heading || 0;
    const cur = headings.has(e.id) ? headings.get(e.id) : target;
    const h = lerpAngle(cur, target, Math.min(1, dt * 12));
    headings.set(e.id, h);
    return h;
  }

  return {
    id: 'units-view',
    kind: 'view',
    heroLantern,
    render(alpha, frame) {
      time += frame.dt;
      // figures grow a little when zoomed out so they stay readable (and outlines thicken)
      const zk = 1 + Math.min(0.45, Math.max(0, (getZoom() - 45) / 110));
      figs.setOutline(0.025 + (zk - 1) * 0.06);
      const w = world();
      const tickTime = (w.tick + alpha) / 20;
      figs.begin();
      // idle neighbours turn to each other and chat
      const idle = [];
      for (const s of all(w, 'settler')) if (!s.hidden && (s.anim || 'idle') === 'idle' && !s.carry) idle.push(s);
      talk.clear();
      for (let i = 0; i < idle.length; i++) {
        const a = idle[i];
        if (talk.has(a.id)) continue;
        for (let j = i + 1; j < idle.length; j++) {
          const b = idle[j];
          if (talk.has(b.id) || (a.x - b.x) ** 2 + (a.z - b.z) ** 2 > 3.6 * 3.6) continue;
          talk.set(a.id, Math.atan2(b.x - a.x, b.z - a.z)); talk.set(b.id, Math.atan2(a.x - b.x, a.z - b.z));
          break;
        }
      }
      for (const s of all(w, 'settler')) {
        if (s.hidden) continue; // asleep indoors
        const x = s.px + (s.x - s.px) * alpha, z = s.pz + (s.z - s.pz) * alpha;
        f.x = x; f.z = z; f.y = terrain.height(x, z);
        const chat = talk.get(s.id);
        f.heading = smoothHeading(s, frame.dt, chat);
        f.style = 'settler'; f.scale = 1.25 * zk; f.tunic = figs.tunicFor(s.id); f.capColor = null;
        f.ack = null;
        f.anim = chat !== undefined ? 'talk' : s.anim || 'idle'; f.t = tickTime + s.id * 0.37; f.phase = s.id; f.job = s.job || null; f.hit = 0; f.rank = 0; f.attack = null; f.gestures = true;
        animate(s, x, z, f.anim, 1.25 * zk, frame.dt);
        f.tool = s.job ? figs.toolFor(s.job) : (s.anim === 'hammer' ? 'hammer' : null);
        f.carry = s.carry ? s.carry.res : null;
        f.fallen = 0; f.kneel = false; f.lean = 0; f.attackPhase = 0; f.ranged = false;
        f.bladeTint = s.job === 'forester' && w.players.p1 && w.players.p1.techs.axes ? '#fff0c0' : null;
        figs.draw(f);
      }
      for (const u of all(w, 'unit')) {
        const def = UNITS[u.type];
        const x = u.px + (u.x - u.px) * alpha, z = u.pz + (u.z - u.pz) * alpha;
        f.x = x; f.z = z; f.y = terrain.height(x, z);
        f.heading = smoothHeading(u, frame.dt);
        f.style = u.type; f.scale = 1.3 * zk; f.tunic = null; f.tool = null; f.carry = null; f.lean = 0;
        f.t = tickTime + u.id * 0.29; f.phase = u.id;
        f.kneel = !!u.downed; f.fallen = 0; f.job = null; f.hit = u.downed ? 0 : hitAmount(u); f.rank = u.rank || 0;
        f.ranged = def.cls === 'ranged' || !!def.ranged; f.attack = null; f.gestures = false; f.ack = null;
        const a = acks.get(u.id);
        if (a) {
          const k = (time - a.t0) / 0.55;
          if (k >= 1) acks.delete(u.id);
          else if (k > 0) { ack.kind = a.kind; ack.k = Math.sin(k * Math.PI); f.ack = ack; }
        }
        f.bladeTint = u.owner === 'p1' && w.players.p1 && w.players.p1.techs.blades ? '#9fc4e8' : null;
        const sinceAttack = w.tick - (u.attackT || -999);
        const cdTicks = def.cooldown * 20;
        // in a fight: blow, recover to guard, wind up as the cooldown runs out (the blow lands on the tick)
        const fighting = u.target != null && !u.moving && sinceAttack < cdTicks * 2.5 + 20;
        if (u.hero && w.tick - (u.castT || -999) < 16) f.anim = 'cast';
        else if (!u.downed && sinceAttack >= 0 && (sinceAttack < 12 || fighting)) {
          f.anim = 'attack';
          att.since = (sinceAttack + alpha) / 20;
          att.until = Math.max(0, (u.cd || 0) - alpha) / 20;
          att.wind = Math.min(f.ranged ? 0.8 : 0.4, def.cooldown * (f.ranged ? 0.55 : 0.4));
          f.attack = att;
        }
        else if (u.downed) f.anim = 'idle';
        else f.anim = u.moving ? (u.retreating ? 'run' : 'walk') : 'idle';
        animate(u, x, z, f.anim, 1.3 * zk, frame.dt);
        f.lanternOut = u.type === 'maren' ? heroLantern : null;
        figs.draw(f);
      }
      // fallen bodies
      for (let i = corpses.length - 1; i >= 0; i--) {
        const c = corpses[i];
        if (c.t0 < 0) c.t0 = time;
        const age = time - c.t0;
        if (age > CORPSE_SECONDS) { corpses.splice(i, 1); continue; }
        f.x = c.x; f.z = c.z; f.y = terrain.height(c.x, c.z) - Math.max(0, age - CORPSE_SECONDS + 1.5) * 0.35;
        f.heading = c.heading || 0; f.style = c.kind === 'settler' ? 'settler' : c.type; f.scale = (c.kind === 'settler' ? 1.25 : 1.3) * zk; f.job = null; f.hit = 0; f.rank = 0;
        f.tunic = c.kind === 'settler' ? figs.tunicFor(c.id) : null; f.tool = null; f.carry = null;
        f.anim = 'idle'; f.t = 0; f.kneel = false; f.lean = 0; f.ranged = false; f.bladeTint = null;
        f.ack = null; f.fallen = Math.min(1, age / 0.85); f.lanternOut = null; f.blendFrom = null; f.walkPh = 0; f.attack = null; f.phase = c.id || 0;
        figs.draw(f);
      }
      figs.end();
      if ((prune += frame.dt) > 5) { prune = 0; for (const [id, m] of motion) if (time - m.seen > 3) motion.delete(id); }
    },
    getHealthStatus() { return { status: 'ok' }; },
    dispose() { unsub.forEach((u) => u()); figs.dispose(); },
  };
}
