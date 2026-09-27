// Units view: draws settlers, soldiers, heroes and enemies with interpolated motion and
// state-driven animation; keeps short-lived fallen bodies after deaths.
import * as THREE from 'three';
import { all } from '../world/world.js';
import { EV } from '../core/contracts.js';
import { UNITS } from './defs.js';
import { createFigureRenderer } from './figures.js';

const CORPSE_SECONDS = 6;

export function createUnitsView({ scene, terrain, world, bus, getZoom = () => 60 }) {
  const figs = createFigureRenderer({ scene });
  const corpses = [];
  const unsub = [];
  unsub.push(bus.on(EV.UNIT_DIED, (d) => {
    if (corpses.length > 60) corpses.shift();
    corpses.push({ ...d, t0: -1 });
    headings.delete(d.id); lastHp.delete(d.id); hitAt.delete(d.id);
  }));
  const f = { lanternOut: new THREE.Vector3() };
  const heroLantern = new THREE.Vector3();
  let time = 0;

  function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  const headings = new Map();
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

  function smoothHeading(e, dt) {
    const target = e.heading || 0;
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
      for (const s of all(w, 'settler')) {
        if (s.hidden) continue; // asleep indoors
        const x = s.px + (s.x - s.px) * alpha, z = s.pz + (s.z - s.pz) * alpha;
        f.x = x; f.z = z; f.y = terrain.height(x, z);
        f.heading = smoothHeading(s, frame.dt);
        f.style = 'settler'; f.scale = 1.25 * zk; f.tunic = figs.tunicFor(s.id); f.capColor = null;
        f.anim = s.anim || 'idle'; f.t = tickTime + s.id * 0.37; f.phase = s.id; f.job = s.job || null; f.hit = 0; f.rank = 0;
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
        f.ranged = def.cls === 'ranged';
        f.bladeTint = u.owner === 'p1' && w.players.p1 && w.players.p1.techs.blades ? '#9fc4e8' : null;
        const sinceAttack = w.tick - (u.attackT || -999);
        const cdTicks = def.cooldown * 20;
        if (u.hero && w.tick - (u.castT || -999) < 16) f.anim = 'cast';
        else if (sinceAttack >= 0 && sinceAttack < Math.min(cdTicks, 18)) { f.anim = 'attack'; f.attackPhase = (sinceAttack + alpha) / Math.min(cdTicks, 18); }
        else if (u.downed) f.anim = 'idle';
        else f.anim = u.moving ? (u.retreating ? 'run' : 'walk') : 'idle';
        f.lanternOut = u.hero ? heroLantern : null;
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
        f.fallen = Math.min(1, age / 0.45); f.lanternOut = null;
        figs.draw(f);
      }
      figs.end();
    },
    getHealthStatus() { return { status: 'ok' }; },
    dispose() { unsub.forEach((u) => u()); figs.dispose(); },
  };
}
