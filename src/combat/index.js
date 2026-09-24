// Combat: target acquisition, attack cooldowns, melee hits, projectiles, armour and
// counters, hero aura mitigation, towers, deaths and building destruction.
import { EV, PLAYER, DT } from '../core/contracts.js';
import { all, emit, remove, alert } from '../world/world.js';
import { UNITS, COUNTERS } from '../units/defs.js';
import { BUILDINGS } from '../buildings/defs.js';
import { TECH_EFFECTS, hasTech } from '../technology/defs.js';
import { isAlive, reachDistance } from '../units/sim.js';
import { destroyBuilding } from '../construction/index.js';

export const PROJECTILE_SPEED = 26; // m/s
export const HEARTHLIGHT_RADIUS = 10;
export const HEARTHLIGHT_REDUCTION = 0.1;
export const RANGED_VS_BUILDING = 0.35;

function classOf(e) {
  if (e.kind === 'unit') return UNITS[e.type].cls;
  if (e.kind === 'building') return 'building';
  return 'civilian';
}

/** Pure damage formula (exported for tests). */
export function computeDamage({ base, attackerCls, defenderCls, armor = 0, damageMult = 1 }) {
  const counter = (COUNTERS[attackerCls] && COUNTERS[attackerCls][defenderCls]) || 1;
  return Math.max(1, Math.round(base * counter * damageMult - armor));
}

function heroAuraProtects(world, target) {
  if (target.kind !== 'unit' || target.owner !== PLAYER) return false;
  for (const u of all(world, 'unit')) {
    if (u.hero && !u.downed && u.owner === target.owner && (u.x - target.x) ** 2 + (u.z - target.z) ** 2 <= HEARTHLIGHT_RADIUS ** 2) return true;
  }
  return false;
}

/**
 * Apply damage to any entity. Returns damage dealt.
 */
export function dealDamage(world, attacker, target, amount, kind = 'melee') {
  if (!isAlive(target)) return 0;
  let dmg = amount;
  if (target.kind === 'unit') {
    if (heroAuraProtects(world, target)) dmg = Math.max(1, Math.round(dmg * (1 - HEARTHLIGHT_REDUCTION)));
    if (target.ward > 0 && target.wardUntil > world.tick) {
      const absorbed = Math.min(target.ward, dmg);
      target.ward -= absorbed;
      dmg -= absorbed;
    }
  }
  if (target.kind === 'building') {
    if (target.state === 'site') dmg *= 1.2;
    target.lastHitTick = world.tick;
    if (target.owner === PLAYER && (!target.lastAlertTick || world.tick - target.lastAlertTick > 400)) {
      target.lastAlertTick = world.tick;
      alert(world, 'danger', `${BUILDINGS[target.type].name} is under attack!`, target.x, target.z);
    }
  }
  target.hp -= dmg;
  target.lastHitTick = world.tick;
  if (attacker && target.kind === 'unit' && target.owner !== attacker.owner && target.target == null && target.order && target.order.type !== 'move' && target.order.type !== 'hold') {
    target.target = attacker.id; // retaliate
  }
  emit(world, EV.COMBAT_HIT, { attacker: attacker ? attacker.id : null, target: target.id, damage: dmg, x: target.x, z: target.z, kind, targetKind: target.kind });
  if (target.hp <= 0) kill(world, target, attacker);
  return dmg;
}

function kill(world, target, attacker) {
  if (target.kind === 'building') { destroyBuilding(world, target, attacker && attacker.owner); return; }
  if (target.kind === 'unit' && target.hero) {
    target.hp = 0;
    target.downed = true;
    target.recoverTick = world.tick + 40 * 20;
    target.target = null;
    target.path = null;
    emit(world, 'hero:downed', { id: target.id, x: target.x, z: target.z });
    alert(world, 'danger', 'Maren has fallen! She will recover at the Keep.', target.x, target.z);
    return;
  }
  const info = { id: target.id, type: target.type, kind: target.kind, owner: target.owner, x: target.x, z: target.z, heading: target.heading || 0, by: attacker ? attacker.owner : null };
  if (target.kind === 'settler') emit(world, 'settler:killed', { id: target.id, entity: target });
  if (target.owner === PLAYER) world.stats.unitsLost++;
  else if (attacker && attacker.owner === PLAYER) world.stats.enemiesDefeated++;
  emit(world, EV.UNIT_DIED, info);
  remove(world, target.id, 'killed');
}

export function createCombatModule() {
  let ctx = null;
  const buf = [];

  function hostileTo(owner) { return (e) => e.owner !== owner && e.owner !== 'none' && isAlive(e); }

  function acquire(world, u, radius) {
    const spatial = ctx.services.spatial;
    spatial.query(u.x, u.z, radius + 8, buf, hostileTo(u.owner));
    let best = null, bestScore = Infinity;
    for (const e of buf) {
      const d = reachDistance(u, e);
      if (d > radius) continue;
      // prefer units that can fight, then settlers, then buildings; nearer first
      let score = d;
      if (e.kind === 'unit') score += 0;
      else if (e.kind === 'settler') score += 8;
      else score += e.state === 'site' ? 12 : 18;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  function damageMult(world, u) {
    let m = 1;
    if (u.owner === PLAYER && !u.hero && hasTech(world, PLAYER, 'blades')) m *= TECH_EFFECTS.damage;
    if (u.rallyUntil > world.tick) m *= 1.2;
    return m;
  }

  function attack(world, u, t) {
    const def = UNITS[u.type];
    const dazzled = u.dazzleUntil > world.tick;
    u.cd = Math.round(def.cooldown * 20 * (dazzled ? 2.5 : 1));
    u.attackT = world.tick;
    const base = def.damage;
    const tcls = classOf(t);
    const armor = t.kind === 'unit' ? UNITS[t.type].armor : 0;
    let dmg = computeDamage({ base, attackerCls: def.cls, defenderCls: tcls, armor, damageMult: damageMult(world, u) });
    if (def.cls === 'ranged') {
      if (t.kind === 'building') dmg = Math.max(1, Math.round(dmg * RANGED_VS_BUILDING));
      const dist = Math.hypot(t.x - u.x, t.z - u.z);
      const flight = Math.max(2, Math.round((dist / PROJECTILE_SPEED) * 20));
      world.combat.pending.push({ from: u.id, owner: u.owner, target: t.id, damage: dmg, arrive: world.tick + flight, kind: u.owner === PLAYER ? 'arrow' : 'stone' });
      emit(world, EV.COMBAT_SHOT, { from: u.id, to: t.id, fx: u.x, fz: u.z, tx: t.x, tz: t.z, flightTicks: flight, kind: u.owner === PLAYER ? 'arrow' : 'stone' });
    } else {
      emit(world, 'combat:swing', { id: u.id, target: t.id });
      dealDamage(world, u, t, dmg, 'melee');
    }
  }

  return {
    id: 'combat',
    kind: 'sim',
    init(c) { ctx = c; },
    update() {
      const world = ctx.world;
      // projectiles in flight
      const pend = world.combat.pending;
      if (pend.length) {
        let w = 0;
        for (let i = 0; i < pend.length; i++) {
          const p = pend[i];
          if (p.arrive <= world.tick) {
            const t = world.entities[p.target];
            const src = world.entities[p.from] || { id: p.from, owner: p.owner };
            if (t && isAlive(t)) dealDamage(world, src, t, p.damage, p.kind);
          } else pend[w++] = p;
        }
        pend.length = w;
      }
      // units
      for (const u of all(world, 'unit')) {
        if (u.downed) continue;
        if (u.cd > 0) u.cd--;
        const def = UNITS[u.type];
        const o = u.order;
        let t = u.target != null ? world.entities[u.target] : null;
        if (t && !isAlive(t)) { u.target = null; t = null; }
        // acquisition (not while executing a plain move)
        if (!t && o.type !== 'move' && (world.tick + u.id) % 5 === 0) {
          const radius = o.type === 'hold' ? def.range + 0.5 : Math.max(def.sight, def.range + 1);
          t = acquire(world, u, radius);
          if (t) u.target = t.id;
        }
        if (t && u.cd <= 0 && o.type !== 'move' && reachDistance(u, t) <= def.range) attack(world, u, t);
      }
      // towers
      for (const b of all(world, 'building')) {
        const def = BUILDINGS[b.type];
        if (!def.attack || b.state !== 'active') continue;
        if (b.cooldown > 0) { b.cooldown--; continue; }
        if ((world.tick + b.id) % 4 !== 0) continue;
        ctx.services.spatial.query(b.x, b.z, def.attack.range, buf, (e) => e.kind === 'unit' && hostileTo(b.owner)(e));
        let best = null, bestD = Infinity;
        for (const e of buf) { const d = (e.x - b.x) ** 2 + (e.z - b.z) ** 2; if (d < bestD) { bestD = d; best = e; } }
        if (!best) continue;
        b.cooldown = Math.round(def.attack.cooldown * 20);
        const dist = Math.sqrt(bestD);
        const flight = Math.max(2, Math.round((dist / PROJECTILE_SPEED) * 20));
        const armor = UNITS[best.type].armor;
        const dmg = Math.max(1, def.attack.damage - Math.floor(armor / 2));
        world.combat.pending.push({ from: b.id, owner: b.owner, target: best.id, damage: dmg, arrive: world.tick + flight, kind: b.owner === PLAYER ? 'arrow' : 'stone' });
        emit(world, EV.COMBAT_SHOT, { from: b.id, to: best.id, fx: b.x, fz: b.z, fy: 7, tx: best.x, tz: best.z, flightTicks: flight, kind: b.owner === PLAYER ? 'arrow' : 'stone' });
      }
    },
    acquire: (u, r) => acquire(ctx.world, u, r),
  };
}
