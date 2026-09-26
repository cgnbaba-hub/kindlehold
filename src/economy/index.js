// Economy: labourers (settlers without a workplace) haul goods between the Keep store,
// construction sites and workplaces, build, and repair. All transport is physical.
import { EV, DT } from '../core/contracts.js';
import { all, emit, alert } from '../world/world.js';
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
// Direct orders (like serfs in the old settler games): labourers can be sent to fell trees
// or cut stone by hand. Slower than a specialist at a Lodge or Quarry, but needs no building.
export const GATHER = {
  tree: { res: 'timber', perTrip: 2, work: 6.5, strike: 0.7, anim: 'chop', stand: 1.1 },
  rock: { res: 'stone', perTrip: 2, work: 7.5, strike: 0.8, anim: 'pick', stand: 2.2 },
};
export const GATHER_RADIUS = 16; // keeps working the same grove / outcrop within this range

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
            // an empty mine comes first; the Tavern's kitchen is a comfort and waits its turn
            const prio = b.type === 'canteen' ? 135 : have === 0 ? 70 : 110;
            consider(prio + d, { type: 'deliver', to: b.id, res: 'provisions', amt: DELIVER_LOAD, stage: 'toKeep' });
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

  /** Drop the deposit reservation (and, if `end`, the order itself). Hand-carried goods are kept. */
  function releaseGather(world, s, end = true) {
    const t = s.task;
    if (t && t.deposit) { const d = world.entities[t.deposit]; if (d && d.reservedBy === s.id) d.reservedBy = null; }
    if (s.task && s.task.type === 'gather') { s.task = null; stopWalking(s); }
    if (end) s.order = null;
  }

  function nextDeposit(world, s, o) {
    let best = null, bestD = Infinity;
    for (const d of all(world, 'deposit')) {
      if (d.type !== o.kind || d.amount <= 0) continue;
      if (d.reservedBy && d.reservedBy !== s.id && world.entities[d.reservedBy]) continue;
      if (Math.hypot(d.x - o.x, d.z - o.z) > GATHER_RADIUS) continue;
      const dd = Math.hypot(d.x - s.x, d.z - s.z);
      if (dd < bestD) { bestD = dd; best = d; }
    }
    return best;
  }

  function stepGatherer(world, s, keep) {
    const nav = ctx.services.nav;
    const o = s.order;
    const G = GATHER[o.kind];
    if (!G) { s.order = null; return; }
    if (!s.task || s.task.type !== 'gather') {
      // hand-carried goods from an interrupted trip go to the store first
      s.task = { type: 'gather', stage: s.carry ? 'toKeep' : 'find', timer: 0, nextStrike: 0 };
    }
    const t = s.task;
    const door = doorOf(keep);
    const walk = (x, z, arrive) => {
      const r = walkTo(nav, s, x, z, SETTLER.speed * (s.carry ? 0.9 : 1), DT, arrive);
      s.anim = r === 'walking' ? (s.carry ? 'carry' : 'walk') : 'idle';
      if (r === 'fail') {
        releaseGather(world, s);
        alert(world, 'warn', 'A labourer cannot reach that spot and has gone back to general work.', s.x, s.z, s.owner);
      }
      return r;
    };
    switch (t.stage) {
      case 'find': {
        const d = (o.deposit && world.entities[o.deposit] && world.entities[o.deposit].amount > 0 && (!world.entities[o.deposit].reservedBy || world.entities[o.deposit].reservedBy === s.id || !world.entities[world.entities[o.deposit].reservedBy]))
          ? world.entities[o.deposit] : nextDeposit(world, s, o);
        o.deposit = null;
        if (!d) {
          releaseGather(world, s);
          alert(world, 'info', `Nothing left to ${o.kind === 'tree' ? 'fell' : 'cut'} here — the labourer returns to general work.`, s.x, s.z, s.owner);
          return;
        }
        d.reservedBy = s.id;
        t.deposit = d.id;
        const dx = s.x - d.x, dz = s.z - d.z, len = Math.hypot(dx, dz) || 1;
        t.spot = [d.x + (dx / len) * G.stand, d.z + (dz / len) * G.stand];
        t.stage = 'toDeposit';
        break;
      }
      case 'toDeposit': {
        const d = world.entities[t.deposit];
        if (!d || d.amount <= 0) { t.stage = 'find'; return; }
        if (walk(t.spot[0], t.spot[1], 0.6) === 'arrived') { t.stage = 'work'; t.timer = 0; t.nextStrike = 0; }
        break;
      }
      case 'work': {
        const d = world.entities[t.deposit];
        if (!d || d.amount <= 0) { t.stage = 'find'; return; }
        s.anim = G.anim;
        s.heading = Math.atan2(d.x - s.x, d.z - s.z);
        t.timer += DT * stabilityFactor(world, s.owner);
        if (t.timer >= t.nextStrike) {
          t.nextStrike += G.strike;
          emit(world, EV.WORK_STRIKE, { id: s.id, kind: G.anim === 'chop' ? 'forester' : 'quarrier', x: d.x, z: d.z, deposit: d.id });
        }
        if (t.timer >= G.work) {
          const amt = Math.min(G.perTrip, d.amount);
          d.amount -= amt;
          if (d.amount <= 0) { d.depletedTick = world.tick; emit(world, 'deposit:depleted', { id: d.id, type: d.type, x: d.x, z: d.z }); }
          if (d.reservedBy === s.id) d.reservedBy = null;
          s.carry = { res: G.res, amt };
          t.stage = 'toKeep';
        }
        break;
      }
      case 'toKeep': {
        const spot = [door.x + ((s.id % 7) - 3) * 0.6, door.z + 0.8];
        if (walk(spot[0], spot[1], 0.8) === 'arrived') {
          if (s.carry) {
            addRes(world, s.owner, s.carry.res, s.carry.amt, 'gather');
            world.stats.produced[s.carry.res] += s.carry.amt;
            emit(world, 'goods:stored', { id: s.id, res: s.carry.res, amt: s.carry.amt, x: s.x, z: s.z });
            emit(world, EV.PRODUCTION_CYCLE, { id: s.id, res: s.carry.res, amount: s.carry.amt, x: s.x, z: s.z });
          }
          s.carry = null;
          t.stage = 'find';
        }
        break;
      }
      default: t.stage = 'find';
    }
  }

  function onCommand(cmd) {
    const world = ctx.world;
    if (cmd.type !== 'gather' && cmd.type !== 'release') return;
    if (!Array.isArray(cmd.ids)) return;
    const owner = cmd.owner || 'p1';
    const d = cmd.type === 'gather' ? world.entities[cmd.target] : null;
    if (cmd.type === 'gather' && (!d || d.kind !== 'deposit' || !GATHER[d.type] || d.amount <= 0)) return;
    for (const id of cmd.ids.slice(0, 200)) {
      const s = world.entities[id];
      if (!s || s.kind !== 'settler' || s.owner !== owner || s.arriving || s.leaving || s.enlisting) continue;
      if (cmd.type === 'release') { if (s.order) { releaseGather(world, s); } continue; }
      // take the settler off its workplace or current task
      if (s.job) {
        const t = s.task;
        if (t && t.deposit) { const dep = world.entities[t.deposit]; if (dep && dep.reservedBy === s.id) dep.reservedBy = null; }
        if (t && t.plot != null) { const b = world.entities[s.workplace]; if (b && b.plots && b.plots[t.plot]) b.plots[t.plot].tender = undefined; }
        s.job = null; s.workplace = null; s.task = null; s.carry = null; stopWalking(s);
      } else if (s.order) releaseGather(world, s, false);
      else if (s.task) abandonTask(world, s);
      s.order = { type: 'gather', kind: d.type, x: d.x, z: d.z, deposit: d.id };
      s.task = null;
    }
    emit(world, 'settlers:ordered', { ids: cmd.ids, type: cmd.type });
  }

  return {
    id: 'economy',
    kind: 'sim',
    init(c) {
      ctx = c;
      unsub.push(c.bus.on('command', onCommand));
      unsub.push(c.bus.on('settler:killed', ({ entity }) => {
        if (entity) { const carry = entity.carry; entity.carry = null; abandonTask(ctx.world, entity); if (carry) { /* goods are lost with the settler */ } }
      }));
    },
    update() {
      const world = ctx.world;
      for (const s of all(world, 'settler')) {
        if (s.job || s.arriving || s.leaving || s.sleep) continue;
        if (s.enlisting) continue; // handled by recruitment
        if (s.fleeing) { if (s.interrupted) { if (s.order) releaseGather(world, s, false); abandonTask(world, s); s.interrupted = false; } continue; }
        const keep = keepOf(world, s.owner);
        if (!keep) continue;
        if (s.order) { stepGatherer(world, s, keep); continue; }
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
