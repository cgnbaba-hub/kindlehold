// Heroes: Maren Ashgrove's passive (Hearthlight) and Wren Fenmore's bow, active abilities with
// cooldowns and cast ranges (two per hero, keys F and G), downed/recovery. Also Vharek's War Horn
// (enemy commander ability).
import { hostile } from '../diplomacy/index.js';
import { EV, PLAYER, DT } from '../core/contracts.js';
import { all, emit } from '../world/world.js';

import { dealDamage, HEARTHLIGHT_RADIUS } from '../combat/index.js';
import { keepOf } from '../population/index.js';
import { doorOf } from '../buildings/defs.js';
import { stopWalking } from '../navigation/agent.js';
import { UNITS } from '../units/defs.js';
import { reveal } from '../exploration/index.js';
import { PROJECTILE_SPEED } from '../combat/index.js';


export const ABILITIES = {
  flare: { id: 'flare', name: 'Beacon Flare', binding: 'abilityFlare', cooldown: 30, range: 14, radius: 6, damage: 40, dazzle: 5, target: 'ground',
    desc: 'The lantern bursts: 40 damage to enemies in a 6 m circle, and they attack 60% slower for 5 s.' },
  kindle: { id: 'kindle', name: 'Kindle the Line', binding: 'abilityKindle', cooldown: 45, range: 0, radius: 9, ward: 60, duration: 8, haste: 0.2, target: 'self',
    desc: 'Allies within 9 m gain a 60-point ward for 8 s and move 20% faster.' },
  // Wren Fenmore, scout of the March
  volley: { id: 'volley', name: 'Arrow Storm', binding: 'abilityFlare', cooldown: 28, range: 20, radius: 5, damage: 34, arrows: 10, target: 'ground',
    desc: 'Wren looses ten arrows in a heartbeat: 34 damage to every enemy in a 5 m circle.' },
  mark: { id: 'mark', name: 'Hunter\'s Mark', binding: 'abilityKindle', cooldown: 40, range: 24, radius: 7, duration: 10, bonus: 0.3, reveal: 26, target: 'ground',
    desc: 'Marks enemies in a 7 m circle for 10 s: they take 30% more damage. Also reveals the land 26 m around.' },
};
/** The abilities of a hero, in key order (F, G). */
export function heroAbilities(hero) { return ((hero && UNITS[hero.type] && UNITS[hero.type].abilities) || []).map((id) => ABILITIES[id]); }
export const HORN = { cooldown: 40, radius: 10, duration: 8 };
export const HERO_REGEN = 1; // hp/s to allies inside Hearthlight

export function abilityReady(world, hero, id) { return !hero.downed && (hero.abilityCd?.[id] || 0) <= world.tick; }

export function createHeroesModule() {
  let ctx = null;
  const unsub = [];

  function cast(world, hero, ab, x, z) {
    hero.abilityCd = hero.abilityCd || {};
    hero.abilityCd[ab.id] = world.tick + ab.cooldown * 20;
    hero.castT = world.tick;
    hero.castAbility = ab.id;
    if (ab.id === 'flare') {
      let hits = 0;
      for (const e of all(world, 'unit')) {
        if (!hostile(world, hero.owner, e.owner) || e.downed) continue;
        if ((e.x - x) ** 2 + (e.z - z) ** 2 <= ab.radius ** 2) {
          e.dazzleUntil = world.tick + ab.dazzle * 20;
          dealDamage(world, hero, e, ab.damage, 'flare');
          hits++;
        }
      }
      emit(world, EV.HERO_ABILITY, { heroId: hero.id, ability: 'flare', x, z, radius: ab.radius, hits });
    } else if (ab.id === 'volley') {
      // arrows in flight: the damage lands when they do
      const flight = Math.max(4, Math.round((Math.hypot(x - hero.x, z - hero.z) / PROJECTILE_SPEED) * 20)) + 4;
      let hits = 0;
      for (const e of all(world, 'unit')) {
        if (!hostile(world, hero.owner, e.owner) || e.downed) continue;
        if ((e.x - x) ** 2 + (e.z - z) ** 2 > ab.radius ** 2) continue;
        world.combat.pending.push({ from: hero.id, owner: hero.owner, target: e.id, damage: ab.damage, arrive: world.tick + flight, kind: 'arrow', strong: false });
        hits++;
      }
      for (let i = 0; i < ab.arrows; i++) {
        const a = i * 2.39996, r = ab.radius * Math.sqrt((i + 0.5) / ab.arrows);
        emit(world, EV.COMBAT_SHOT, { from: hero.id, to: null, fx: hero.x, fz: hero.z, tx: x + Math.cos(a) * r, tz: z + Math.sin(a) * r, flightTicks: flight - (i % 3), kind: 'arrow' });
      }
      emit(world, EV.HERO_ABILITY, { heroId: hero.id, ability: 'volley', x, z, radius: ab.radius, hits });
    } else if (ab.id === 'mark') {
      let n = 0;
      for (const e of all(world, 'unit')) {
        if (!hostile(world, hero.owner, e.owner) || e.downed) continue;
        if ((e.x - x) ** 2 + (e.z - z) ** 2 <= ab.radius ** 2) { e.markedUntil = world.tick + ab.duration * 20; n++; }
      }
      reveal(world, ctx.services.terrain.half, x, z, ab.reveal);
      emit(world, EV.HERO_ABILITY, { heroId: hero.id, ability: 'mark', x, z, radius: ab.radius, marked: n });
    } else if (ab.id === 'kindle') {
      let n = 0;
      for (const e of all(world, 'unit')) {
        if (e.owner !== hero.owner || e.downed) continue;
        if ((e.x - hero.x) ** 2 + (e.z - hero.z) ** 2 <= ab.radius ** 2) {
          e.ward = ab.ward; e.wardUntil = world.tick + ab.duration * 20; e.hasteUntil = world.tick + ab.duration * 20; n++;
        }
      }
      emit(world, EV.HERO_ABILITY, { heroId: hero.id, ability: 'kindle', x: hero.x, z: hero.z, radius: ab.radius, affected: n });
    }
  }

  function onCommand(cmd) {
    if (cmd.type !== 'ability') return;
    const world = ctx.world;
    const hero = world.entities[cmd.heroId];
    const ab = ABILITIES[cmd.ability];
    const reject = (reason) => emit(world, EV.COMMAND_REJECTED, { type: 'ability', reason });
    if (!hero || !hero.hero || hero.owner !== (cmd.owner || PLAYER) || !ab) return reject('No hero');
    if (!heroAbilities(hero).includes(ab)) return reject(`${UNITS[hero.type].name} cannot do that`);
    if (hero.downed) return reject(`${UNITS[hero.type].name.split(' ')[0]} is recovering`);
    if (!abilityReady(world, hero, ab.id)) return reject(`${ab.name} is not ready`);
    if (ab.target === 'self') { cast(world, hero, ab, hero.x, hero.z); return; }
    const x = Number(cmd.x), z = Number(cmd.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return reject('Invalid target');
    const d = Math.hypot(x - hero.x, z - hero.z);
    if (d <= ab.range) cast(world, hero, ab, x, z);
    else { hero.pendingCast = { ability: ab.id, x, z }; hero.order = { type: 'move', x, z, ax: hero.x, az: hero.z }; hero.target = null; stopWalking(hero); }
  }

  return {
    id: 'heroes',
    kind: 'sim',
    init(c) { ctx = c; unsub.push(c.bus.on('command', onCommand)); },
    update() {
      const world = ctx.world;
      for (const hero of all(world, 'unit')) {
        if (hero.hero) {
          if (hero.downed) {
            if (world.tick >= hero.recoverTick) {
              const keep = keepOf(world, hero.owner);
              const door = keep ? doorOf(keep) : { x: hero.x, z: hero.z };
              hero.downed = false; hero.hp = hero.maxHp; hero.x = hero.px = door.x + 2; hero.z = hero.pz = door.z + 2;
              hero.order = { type: 'idle', ax: hero.x, az: hero.z }; hero.target = null; stopWalking(hero);
              emit(world, 'hero:recovered', { id: hero.id });
            }
            continue;
          }
          // queued cast once within range
          if (hero.pendingCast) {
            const pc = hero.pendingCast;
            const ab = ABILITIES[pc.ability];
            if (Math.hypot(pc.x - hero.x, pc.z - hero.z) <= ab.range) {
              hero.pendingCast = null;
              hero.order = { type: 'idle', ax: hero.x, az: hero.z };
              stopWalking(hero);
              if (abilityReady(world, hero, ab.id)) cast(world, hero, ab, pc.x, pc.z);
            } else if (hero.order.type !== 'move') hero.pendingCast = null;
          }
          // Hearthlight (Maren): allies regenerate once per second
          if (world.tick % 20 === 0 && UNITS[hero.type].passive === 'hearthlight') {
            for (const u of all(world, 'unit')) {
              if (u.owner !== hero.owner || u.downed || u.hp >= u.maxHp) continue;
              if ((u.x - hero.x) ** 2 + (u.z - hero.z) ** 2 <= HEARTHLIGHT_RADIUS ** 2) u.hp = Math.min(u.maxHp, u.hp + HERO_REGEN);
            }
          }
        } else if (hero.commander && !hero.downed) {
          // Vharek's War Horn when enemies are close
          if ((hero.hornCd || 0) <= world.tick && hero.target != null) {
            hero.hornCd = world.tick + HORN.cooldown * 20;
            for (const u of all(world, 'unit')) {
              if (u.owner === hero.owner && (u.x - hero.x) ** 2 + (u.z - hero.z) ** 2 <= HORN.radius ** 2) u.rallyUntil = world.tick + HORN.duration * 20;
            }
            emit(world, EV.HERO_ABILITY, { heroId: hero.id, ability: 'horn', x: hero.x, z: hero.z, radius: HORN.radius });
          }
        }
      }
      // enemy camp healing handled by AI
    },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
  };
}

