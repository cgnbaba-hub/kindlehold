// Economy: labourers (settlers without a workplace) haul goods between the Keep store,
// construction sites and workplaces, build, and repair. All transport is physical.
import { EV, DT } from '../core/contracts.js';
import { all, emit } from '../world/world.js';
import { BUILDINGS, doorOf } from '../buildings/defs.js';
import { SETTLER } from '../units/defs.js';
import { addRes } from './stock.js';
import { siteNeeds, applyBuildWork, MAX_BUILDERS } from '../construction/index.js';
import { isIdleLabourer, keepOf, stabilityFactor } from '../population/index.js';
import { walkTo, stopWalking } from '../navigation/agent.js';
import { TECH_EFFECTS, hasTech } from '../technology/defs.js';

export const SUPPLY_LOAD = 6;
export const HAUL_LOAD = 6;
export const DELIVER_LOAD = 3;
export const REPAIR_HP_PER_TIMBER = 30;
export const REPAIR_RATE = 14; // hp per second

function spotAround(b, id, extra = 1.2) {
  const def = BUILDINGS[b.type];
  const ang = (id * 2.399) % (Math.PI * 2);
  const r = def.radius + extra;
  return [b.x + Math.sin(ang) * r, b.z + Math.cos(ang) * r];
}

/** Undo reservations of a labourer's task; carried goods are returned to the store. */
export function abandonTask(world, s) {
  const t = s.task;
  if (t) {
    const target = world.entities[t.site ?? t.from ?? t.to ?? t.target];
    if (t.type === 'supply' && target && target.build) {
      target.build.incoming[t.res] = Math.max(0, (target.build.incoming[t.res] || 0) - t.amt);
    } else if (t.type === 'haul' && target && t.stage === 'toBuilding') {
      target.stock.outReserved = Math.max(0, target.stock.outReserved - t.amt);
    } else if (t.type === 'deliver' && target) {
      target.stock.inIncoming = Math.max(0, target.stock.inIncoming - t.amt);
    } else if (t.type === 'build' && target && target.build) {
      target.build.builders = target.build.builders.filter((id) => id !== s.id);
    } else if (t.type === 'repair' && target) {
      target.repairer = null;
    }
  }
  // Supply loads were already paid for when the site was placed (and are refunded by
  // cancel), so only hauled/delivered/repair goods return to the store.
  if (s.carry && s.carry.amt > 0 && !(t && t.type === 'supply')) addRes(world, s.owner, s.carry.res, s.carry.amt, 'recovered');
  s.carry = null;
  s.task = null;
  stopWalking(s);
}

export function createEconomyModule() {
  let ctx = null;
  const unsub = [];

  function chooseTask(world, s, keep) {
    const owner = s.owner;
    const res = world.players[owner].res;
    let best = null, bestScore = Infinity;
    const consider = (score, task) => { if (score < bestScore) { bestScore = score; best = task; } };
    for (const b of all(world, 'building')) {
      if (b.owner !== owner) continue;
      const d = Math.hypot(b.x - s.x, b.z - s.z);
      if (b.state === 'site') {
        const needs = siteNeeds(b);
        let needAny = false;
        for (const r in needs) {
          needAny = true;
          consider(100 + d, { type: 'supply', site: b.id, res: r, amt: Math.min(SUPPLY_LOAD, needs[r]), stage: 'toKeep' });
          break;
        }
        // builders can work up to what has been supplied so far
        let supplied = 0, required = 0;
        for (const r in b.build.required) { required += b.build.required[r]; supplied += Math.min(b.build.required[r], b.build.supplied[r] || 0); }
        const cap = required === 0 ? 1 : supplied / required;
        b.build.builders = b.build.builders.filter((id) => world.entities[id] && world.entities[id].task && world.entities[id].task.site === b.id);
        if (cap > b.build.progress + 0.001 && b.build.builders.length < MAX_BUILDERS) {
          consider((needAny ? 60 : 0) + d + b.build.builders.length * 15, { type: 'build', site: b.id, stage: 'toSite' });
        }
      } else if (b.state === 'active') {
        const def = BUILDINGS[b.type];
        if (def.outCap) {
          let out = 0;
          for (const r in b.stock.out) out += b.stock.out[r];
          const avail = out - b.stock.outReserved;
          const food = b.stock.out.provisions > 0 && res.provisions < world.players[owner].pop * 2;
          if (avail >= 2 || (avail >= 1 && out >= def.outCap - 1) || (food && avail >= 1)) {
            consider((food ? 40 : 150) + d - Math.min(60, avail * 8), { type: 'haul', from: b.id, amt: Math.min(HAUL_LOAD, avail), stage: 'toBuilding' });
          }
        }
        if (def.inCap) {
          const have = (b.stock.in.provisions || 0) + b.stock.inIncoming;
          if (have <= def.inCap - DELIVER_LOAD && res.provisions >= DELIVER_LOAD + 2) {
            consider(110 + d, { type: 'deliver', to: b.id, res: 'provisions', amt: DELIVER_LOAD, stage: 'toKeep' });
          }
        }
        if (b.hp < b.maxHp * 0.75 && !b.repairer && world.tick - b.lastHitTick > 200 && res.timber >= 3) {
          consider(200 + d, { type: 'repair', target: b.id, amt: 3, stage: 'toKeep' });
        }
      }
    }
    if (!best) return null;
    // reserve
    const target = world.entities[best.site ?? best.from ?? best.to ?? best.target];
    if (best.type === 'supply') target.build.incoming[best.res] = (target.build.incoming[best.res] || 0) + best.amt;
    else if (best.type === 'haul') target.stock.outReserved += best.amt;
    else if (best.type === 'deliver') target.stock.inIncoming += best.amt;
    else if (best.type === 'build') { target.build.builders.push(s.id); best.spot = spotAround(target, s.id); }
    else if (best.type === 'repair') { target.repairer = s.id; best.spot = spotAround(target, s.id); }
    return best;
  }

  function stepLabourer(world, s, keep) {
    const nav = ctx.services.nav;
    const speed = SETTLER.speed * (s.carry ? 0.9 : 1);
    const t = s.task;
    const door = doorOf(keep);
    const keepSpot = [door.x + ((s.id % 7) - 3) * 0.6, door.z + 0.8];
    const target = t && t.type !== 'idle' ? world.entities[t.site ?? t.from ?? t.to ?? t.target] : null;
    if (t && t.type !== 'idle' && (!target || target.state === 'destroyed' || (t.type === 'build' && target.state !== 'site') || (t.type === 'supply' && target.state !== 'site'))) {
      abandonTask(world, s);
      return;
    }
    const walk = (x, z, arrive = 0.8) => {
      const r = walkTo(nav, s, x, z, speed, DT, arrive);
      s.anim = r === 'walking' ? (s.carry ? 'carry' : 'walk') : (s.carry ? 'carryIdle' : 'idle');
      if (r === 'fail') {
        if (target && target.kind === 'building' && target.stall !== 'noAccess') {
          target.stall = 'noAccess';
          emit(world, EV.PRODUCTION_STALLED, { id: target.id, reason: 'noAccess' });
        }
        abandonTask(world, s);
        s.task = { type: 'idle', until: world.tick + 60, spot: keepSpot };
      }
      return r;
    };

    switch (t.type) {
      case 'idle': {
        const r = walkTo(nav, s, t.spot[0], t.spot[1], SETTLER.speed * 0.6, DT, 0.8);
        s.anim = r === 'walking' ? 'walk' : 'idle';
        if (world.tick >= t.until) s.task = null;
        break;
      }
      case 'supply': {
        if (t.stage === 'toKeep') {
          if (walk(keepSpot[0], keepSpot[1]) === 'arrived') { s.carry = { res: t.res, amt: t.amt }; t.stage = 'toSite'; }
        } else {
          const [x, z] = spotAround(target, s.id, 0.9);
          if (walk(x, z, 1.0) === 'arrived') {
            target.build.supplied[t.res] = (target.build.supplied[t.res] || 0) + t.amt;
            target.build.incoming[t.res] = Math.max(0, (target.build.incoming[t.res] || 0) - t.amt);
            emit(world, 'construction:supplied', { id: target.id, res: t.res, amt: t.amt, x: s.x, z: s.z });
            s.carry = null; s.task = null;
          }
        }
        break;
      }
      case 'build': {
        if (t.stage === 'toSite') {
          if (walk(t.spot[0], t.spot[1], 0.7) === 'arrived') t.stage = 'work';
        } else {
          s.anim = 'hammer';
          s.heading = Math.atan2(target.x - s.x, target.z - s.z);
          applyBuildWork(world, target, DT * stabilityFactor(world, s.owner));
          s.animT = (s.animT || 0) + DT;
          if ((world.tick + s.id) % 12 === 0) emit(world, EV.WORK_STRIKE, { id: s.id, kind: 'build', x: s.x, z: s.z, building: target.id });
          if (!world.entities[target.id] || target.state !== 'site') { s.task = null; break; }
          // ran out of supplied material: stop and let the task board re-evaluate
          let supplied = 0, required = 0;
          for (const r in target.build.required) { required += target.build.required[r]; supplied += Math.min(target.build.required[r], target.build.supplied[r] || 0); }
          if (required > 0 && target.build.progress >= supplied / required - 1e-6) abandonTask(world, s);
        }
        break;
      }
      case 'haul': {
        if (t.stage === 'toBuilding') {
          const d = doorOf(target);
          if (walk(d.x, d.z, 1.0) === 'arrived') {
            let res = null;
            for (const r in target.stock.out) if (target.stock.out[r] > 0) { res = r; break; }
            const amt = res ? Math.min(t.amt, target.stock.out[res]) : 0;
            target.stock.outReserved = Math.max(0, target.stock.outReserved - t.amt);
            if (!res || amt <= 0) { s.task = null; break; }
            target.stock.out[res] -= amt;
            s.carry = { res, amt };
            t.stage = 'toKeep';
            if (target.stall === 'storageFull') target.stall = null;
          }
        } else if (walk(keepSpot[0], keepSpot[1]) === 'arrived') {
          addRes(world, s.owner, s.carry.res, s.carry.amt, 'haul');
          emit(world, 'goods:stored', { id: s.id, res: s.carry.res, amt: s.carry.amt, x: s.x, z: s.z });
          s.carry = null; s.task = null;
        }
        break;
      }
      case 'deliver': {
        if (t.stage === 'toKeep') {
          if (walk(keepSpot[0], keepSpot[1]) === 'arrived') {
            const p = world.players[s.owner];
            const amt = Math.min(t.amt, Math.floor(p.res[t.res]));
            if (amt <= 0) { abandonTask(world, s); break; }
            addRes(world, s.owner, t.res, -amt, 'deliver');
            s.carry = { res: t.res, amt };
            target.stock.inIncoming = Math.max(0, target.stock.inIncoming - t.amt + amt);
            t.amt = amt;
            t.stage = 'toBuilding';
          }
        } else {
          const d = doorOf(target);
          if (walk(d.x, d.z, 1.0) === 'arrived') {
            target.stock.in[t.res] = (target.stock.in[t.res] || 0) + s.carry.amt;
            target.stock.inIncoming = Math.max(0, target.stock.inIncoming - t.amt);
            s.carry = null; s.task = null;
            if (target.stall === 'noInput') target.stall = null;
          }
        }
        break;
      }
      case 'repair': {
        if (t.stage === 'toKeep') {
          if (walk(keepSpot[0], keepSpot[1]) === 'arrived') {
            const p = world.players[s.owner];
            if (p.res.timber < t.amt) { abandonTask(world, s); break; }
            addRes(world, s.owner, 'timber', -t.amt, 'repair');
            world.stats.consumed.timber += t.amt;
            s.carry = { res: 'timber', amt: t.amt };
            t.stage = 'toTarget';
          }
        } else if (t.stage === 'toTarget') {
          if (walk(t.spot[0], t.spot[1], 0.8) === 'arrived') { t.stage = 'work'; t.pool = s.carry.amt * REPAIR_HP_PER_TIMBER; s.carry = null; }
        } else {
          s.anim = 'hammer';
          s.heading = Math.atan2(target.x - s.x, target.z - s.z);
          const rate = REPAIR_RATE * (hasTech(world, s.owner, 'bracing') ? TECH_EFFECTS.buildSpeed : 1) * DT;
          const heal = Math.min(rate, t.pool, target.maxHp - target.hp);
          target.hp += heal; t.pool -= heal;
          if ((world.tick + s.id) % 12 === 0) emit(world, EV.WORK_STRIKE, { id: s.id, kind: 'repair', x: s.x, z: s.z, building: target.id });
          if (t.pool <= 0.01 || target.hp >= target.maxHp - 0.01) { target.repairer = null; s.task = null; }
        }
        break;
      }
      default:
        s.task = null;
    }
  }

  return {
    id: 'economy',
    kind: 'sim',
    init(c) {
      ctx = c;
      unsub.push(c.bus.on('settler:killed', ({ entity }) => {
        if (entity) { const carry = entity.carry; entity.carry = null; abandonTask(ctx.world, entity); if (carry) { /* goods are lost with the settler */ } }
      }));
    },
    update() {
      const world = ctx.world;
      for (const s of all(world, 'settler')) {
        if (s.job || s.arriving || s.leaving) continue;
        if (s.enlisting) continue; // handled by recruitment
        if (s.fleeing) { if (s.interrupted) { abandonTask(world, s); s.interrupted = false; } continue; }
        const keep = keepOf(world, s.owner);
        if (!keep) continue;
        if (!s.task || (s.task.type === 'idle' && (world.tick + s.id) % 10 === 0)) {
          const task = isIdleLabourer(s) || s.task === null ? chooseTask(world, s, keep) : null;
          if (task) { stopWalking(s); s.task = task; }
          else if (!s.task) {
            const door = doorOf(keep);
            const ang = (s.id * 1.7 + Math.floor(world.tick / 400)) % (Math.PI * 2);
            s.task = { type: 'idle', until: world.tick + 80, spot: [door.x + Math.sin(ang) * (5 + (s.id % 4) * 2), door.z + 4 + Math.cos(ang) * (4 + (s.id % 3) * 2)] };
          }
        }
        if (s.task) stepLabourer(world, s, keep);
      }
    },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
  };
}
