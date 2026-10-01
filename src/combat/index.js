// Combat: target acquisition, attack cooldowns, melee hits, projectiles, armour and
// counters, hero aura mitigation, towers, deaths and building destruction.
import { EV, PLAYER, DT } from '../core/contracts.js';
import { all, emit, remove, alert } from '../world/world.js';
import { UNITS, COUNTERS } from '../units/defs.js';
import { BUILDINGS, attackOf } from '../buildings/defs.js';
import { TECH_EFFECTS, hasTech, soldierMods } from '../technology/defs.js';
import { hostile, provoke } from '../diplomacy/index.js';
import { isAlive, reachDistance } from '../units/sim.js';
import { destroyBuilding } from '../construction/index.js';
import { enemyFaction } from '../ai/factions.js';

export const PROJECTILE_SPEED = 26; // m/s
export const HEARTHLIGHT_RADIUS = 10;
export const HEARTHLIGHT_REDUCTION = 0.1;
export const RANGED_VS_BUILDING = 0.25;
export const MELEE_VS_BUILDING = 0.5;
export const MARKED_BONUS = 0.3;

function classOf(e) {
  if (e.kind === 'unit') return UNITS[e.type].cls;
  if (e.kind === 'building') return 'building';
  return 'civilian';
}

/** Pure damage formula (exported for tests). */
export const ARMOR_PER_POINT = 0.05; // each armour point blocks 5% of incoming damage

export function counterOf(attackerCls, defenderCls) {
  return (COUNTERS[attackerCls] && COUNTERS[attackerCls][defenderCls]) || 1;
}

export function computeDamage({ base, attackerCls, defenderCls, armor = 0, damageMult = 1 }) {
  const counter = counterOf(attackerCls, defenderCls);
  return Math.max(1, Math.round(base * counter * damageMult * (1 - Math.min(0.75, armor * ARMOR_PER_POINT))));
}

function heroAuraProtects(world, target) {
  if (target.kind !== 'unit' || target.owner !== PLAYER) return false;
  for (const u of all(world, 'unit')) {
    if (u.hero && !u.downed && UNITS[u.type].passive === 'hearthlight' && u.owner === target.owner && (u.x - target.x) ** 2 + (u.z - target.z) ** 2 <= HEARTHLIGHT_RADIUS ** 2) return true;
  }
  return false;
}

/**
 * Apply damage to any entity. Returns damage dealt.
 */
export function dealDamage(world, attacker, target, amount, kind = 'melee') {
  // striking a faction you are not at war with starts one
  if (attacker && attacker.owner && target.owner && attacker.owner !== target.owner && !hostile(world, attacker.owner, target.owner)) provoke(world, attacker.owner, target.owner);
  if (!isAlive(target)) return 0;
  let dmg = amount;
  if (target.kind === 'unit') {
    if (heroAuraProtects(world, target)) dmg = Math.max(1, Math.round(dmg * (1 - HEARTHLIGHT_REDUCTION)));
    // Hunter's Mark (Wren): marked enemies take more damage
    if (target.markedUntil > world.tick) dmg = Math.round(dmg * (1 + MARKED_BONUS));
    if (target.ward > 0 && target.wardUntil > world.tick) {
      const absorbed = Math.min(target.ward, dmg);
      target.ward -= absorbed;
      dmg -= absorbed;
    }
  }
  if (target.kind === 'building') {
    // story: a barred fort (the last chapter) cannot be stormed before its host is broken
    if (target.type === enemyFaction(world).hall && target.owner !== PLAYER && world.mission.flags.hallBarred) {
      if (!target.barredNoticeTick || world.tick - target.barredNoticeTick > 600) {
        target.barredNoticeTick = world.tick;
        if (attacker && attacker.owner === PLAYER) alert(world, 'warn', `The ${enemyFaction(world).hallName}'s gates are barred and its walls manned. Break the ${enemyFaction(world).short} host in the field first.`, target.x, target.z);
      }
      return 0;
    }
    if (target.state === 'site') dmg *= 1.2;
    const bdef = BUILDINGS[target.type];
    if (kind === 'melee' || kind === 'strong') dmg *= MELEE_VS_BUILDING;
    if (bdef.damageTaken) dmg *= bdef.damageTaken;
    // stone walls: only siege work (Sappers) gets through them properly
    if (bdef.walls && kind !== 'siege') dmg *= bdef.walls;
    dmg = Math.max(1, Math.round(dmg));
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

// Veterans: soldiers who survive and win become stronger. Kills needed for each rank.
export const RANKS = [
  { name: 'Recruit', kills: 0, damage: 1, hp: 1 },
  { name: 'Veteran', kills: 3, damage: 1.1, hp: 1.1 },
  { name: 'Elite', kills: 8, damage: 1.2, hp: 1.2 },
];

export function rankOf(u) { return (u && u.rank) || 0; }

/** Credit a kill to the attacker; promote when it has earned the next rank. */
export function creditKill(world, attacker) {
  if (!attacker || attacker.kind !== 'unit' || attacker.hero || attacker.commander || !isAlive(attacker)) return;
  attacker.xp = (attacker.xp || 0) + 1;
  const r = rankOf(attacker);
  const next = RANKS[r + 1];
  if (!next || attacker.xp < next.kills) return;
  attacker.rank = r + 1;
  // more health, and the gain is healed at once
  const grow = next.hp / RANKS[r].hp;
  const add = Math.round(attacker.maxHp * grow) - attacker.maxHp;
  attacker.maxHp += add; attacker.hp += add;
  emit(world, 'unit:promoted', { id: attacker.id, type: attacker.type, owner: attacker.owner, rank: attacker.rank, x: attacker.x, z: attacker.z });
  if (attacker.owner === PLAYER) alert(world, 'success', `A ${UNITS[attacker.type].name} has become ${next.name === 'Elite' ? 'one of the Elite' : 'a Veteran'}!`, attacker.x, attacker.z);
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
    const first = UNITS[target.type].name.split(' ')[0];
    alert(world, 'danger', `${first} has fallen! She will recover at the Keep.`, target.x, target.z);
    return;
  }
  const info = { id: target.id, type: target.type, kind: target.kind, owner: target.owner, x: target.x, z: target.z, heading: target.heading || 0, by: attacker ? attacker.owner : null };
  if (target.kind === 'settler') emit(world, 'settler:killed', { id: target.id, entity: target });
  if (target.owner === PLAYER) world.stats.unitsLost++;
  else if (attacker && attacker.owner === PLAYER) world.stats.enemiesDefeated++;
  if (target.kind === 'unit') creditKill(world, attacker);
  emit(world, EV.UNIT_DIED, info);
  remove(world, target.id, 'killed');
}

export function createCombatModule() {
  let ctx = null;
  const buf = [];

  function hostileTo(owner) { return (e) => hostile(ctx.world, owner, e.owner) && isAlive(e); }

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
      else {
        // raiders marching on a target building do not stop at every wall they pass
        if (u.order.targetBuilding && e.id !== u.order.targetBuilding && d > 2.5) continue;
        score += e.state === 'site' ? 12 : 18;
      }
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  function damageMult(world, u) {
    let m = 1;
    if (u.owner === PLAYER && !u.hero && hasTech(world, PLAYER, 'blades')) m *= TECH_EFFECTS.damage;
    if (u.rallyUntil > world.tick) m *= 1.2;
    m *= RANKS[rankOf(u)].damage;
    return m;
  }

  function attack(world, u, t) {
    const def = UNITS[u.type];
    const dazzled = u.dazzleUntil > world.tick;
    u.cd = Math.round(def.cooldown * 20 * (dazzled ? 2.5 : 1) * soldierMods(world, u).cooldown);
    u.attackT = world.tick;
    const base = def.damage;
    const tcls = classOf(t);
    // crossbow bolts ignore part of the armour
    const armor = t.kind === 'unit' ? (UNITS[t.type].armor + soldierMods(world, t).armor) * (1 - (def.pierce || 0)) : 0;
    let dmg = computeDamage({ base, attackerCls: def.cls, defenderCls: tcls, armor, damageMult: damageMult(world, u) });
    const strong = counterOf(def.cls, tcls) > 1;
    if (def.cls === 'ranged' || def.ranged) {
      if (t.kind === 'building') dmg = Math.max(1, Math.round(dmg * RANGED_VS_BUILDING));
      const dist = Math.hypot(t.x - u.x, t.z - u.z);
      const flight = Math.max(2, Math.round((dist / PROJECTILE_SPEED) * 20));
      world.combat.pending.push({ from: u.id, owner: u.owner, target: t.id, damage: dmg, arrive: world.tick + flight, kind: u.owner === PLAYER ? 'arrow' : 'stone', strong });
      emit(world, EV.COMBAT_SHOT, { from: u.id, to: t.id, fx: u.x, fz: u.z, tx: t.x, tz: t.z, flightTicks: flight, kind: u.owner === PLAYER ? 'arrow' : 'stone' });
    } else {
      emit(world, 'combat:swing', { id: u.id, target: t.id });
      if (t.kind === 'building' && def.vsBuildings) dealDamage(world, u, t, dmg * def.vsBuildings, 'siege');
      else dealDamage(world, u, t, dmg, strong ? 'strong' : 'melee');
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
            if (t && isAlive(t)) dealDamage(world, src, t, p.damage, p.strong ? 'strong' : p.kind);
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
        if (!def.attack || b.state !== 'active' || (def.attack.requiresLit && !b.lit)) continue;
        if (b.cooldown > 0) { b.cooldown--; continue; }
        if ((world.tick + b.id) % 4 !== 0) continue;
        const shot = attackOf(b);
        ctx.services.spatial.query(b.x, b.z, shot.range, buf, (e) => e.kind === 'unit' && hostileTo(b.owner)(e));
        let best = null, bestD = Infinity;
        for (const e of buf) { const d = (e.x - b.x) ** 2 + (e.z - b.z) ** 2; if (d < bestD) { bestD = d; best = e; } }
        if (!best) continue;
        b.cooldown = Math.round(shot.cooldown * 20);
        const dist = Math.sqrt(bestD);
        const flight = Math.max(2, Math.round((dist / PROJECTILE_SPEED) * 20));
        const armor = UNITS[best.type].armor + soldierMods(world, best).armor;
        const dmg = Math.max(1, Math.round(shot.damage * (1 - armor * 0.05)));
        world.combat.pending.push({ from: b.id, owner: b.owner, target: best.id, damage: dmg, arrive: world.tick + flight, kind: b.owner === PLAYER ? 'arrow' : 'stone' });
        emit(world, EV.COMBAT_SHOT, { from: b.id, to: best.id, fx: b.x, fz: b.z, fy: 7, tx: best.x, tz: best.z, flightTicks: flight, kind: b.owner === PLAYER ? 'arrow' : 'stone' });
      }
    },
    acquire: (u, r) => acquire(ctx.world, u, r),
  };
}
