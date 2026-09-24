// Production: workers at workplaces run visible work cycles against deposits,
// fields or inputs, carry goods back, and report precise stall reasons.
import { EV, DT } from '../core/contracts.js';
import { all, emit, remove, alert } from '../world/world.js';
import { BUILDINGS, doorOf } from '../buildings/defs.js';
import { SETTLER } from '../units/defs.js';
import { stabilityFactor } from '../population/index.js';
import { walkTo, stopWalking } from '../navigation/agent.js';
import { TECH_EFFECTS, hasTech } from '../technology/defs.js';

export const WORK = {
  forester: { res: 'timber', perTrip: 3, work: 5.0, strike: 0.7, anim: 'chop' },
  quarrier: { res: 'stone', perTrip: 3, work: 6.0, strike: 0.8, anim: 'pick' },
  farmer: { res: 'provisions', perTrip: 4, sow: 2.5, harvest: 3.0, grow: 30, anim: 'farm' },
  miner: { res: 'iron', perCycle: 2, work: 8.0, provisionsPerCycle: 1, anim: 'mine' },
};

export const STALL_TEXT = {
  paused: 'Work paused — its workers help as labourers',
  noWorker: 'No worker — needs an idle settler (build Cottages for more people)',
  noDeposit: 'Nothing left to work within range',
  storageFull: 'Storage full — labourers must carry goods to the Keep',
  noInput: 'Waiting for provisions to be delivered',
  noAccess: 'Workers cannot reach the site',
  noSettler: 'Needs an idle settler to train',
};

const STALL_ALERT = { noDeposit: 'has nothing left to work nearby — build a new one closer to resources', noInput: 'is waiting for provisions', noAccess: 'cannot be reached by its workers' };

function setStall(world, b, reason) {
  if (b.stall === reason) return;
  b.stall = reason;
  if (!reason) return;
  emit(world, EV.PRODUCTION_STALLED, { id: b.id, reason });
  // tell the player (at most once per building per 90 s), with a jump-to location
  if (b.owner === 'p1' && STALL_ALERT[reason] && world.tick - (b.stallAlertTick ?? -1e9) > 1800) {
    b.stallAlertTick = world.tick;
    alert(world, 'warn', `${BUILDINGS[b.type].name} ${STALL_ALERT[reason]}.`, b.x, b.z);
  }
  // goods piling up: one combined hint at most every 3 minutes
  if (b.owner === 'p1' && reason === 'storageFull' && world.tick - (world.stats.lastFullAlert ?? -1e9) > 3600) {
    world.stats.lastFullAlert = world.tick;
    alert(world, 'info', `Goods are piling up at the ${BUILDINGS[b.type].name}: labourers are busy. Pause a workplace or build Cottages for more people.`, b.x, b.z);
  }
}

function outCount(b) { let n = 0; for (const r in b.stock.out) n += b.stock.out[r]; return n; }

function findDeposit(world, b, type, range, workerId) {
  let best = null, bestD = Infinity;
  for (const d of all(world, 'deposit')) {
    if (d.type !== type || d.amount <= 0) continue;
    if (d.reservedBy && d.reservedBy !== workerId && world.entities[d.reservedBy]) continue;
    const dd = Math.hypot(d.x - b.x, d.z - b.z);
    if (dd <= range && dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

export function createProductionModule() {
  let ctx = null;

  function releaseDeposit(world, s) {
    const t = s.task;
    if (t && t.deposit) {
      const d = world.entities[t.deposit];
      if (d && d.reservedBy === s.id) d.reservedBy = null;
    }
  }

  function stepWorker(world, s) {
    const nav = ctx.services.nav;
    const b = world.entities[s.workplace];
    if (!b || b.state !== 'active') { releaseDeposit(world, s); s.job = null; s.workplace = null; s.task = null; s.carry = null; return; }
    const def = BUILDINGS[b.type];
    const W = WORK[s.job];
    const door = doorOf(b);
    const sf = stabilityFactor(world, s.owner);
    if (!s.task) s.task = { stage: 'start', timer: 0 };
    const t = s.task;
    const walk = (x, z, arrive = 0.8) => {
      const r = walkTo(nav, s, x, z, SETTLER.speed, DT, arrive);
      s.anim = r === 'walking' ? (s.carry ? 'carry' : 'walk') : 'idle';
      if (r === 'fail') { releaseDeposit(world, s); setStall(world, b, 'noAccess'); s.task = { stage: 'wait', timer: 3 }; stopWalking(s); }
      return r;
    };

    if (t.stage === 'wait') {
      s.anim = 'idle';
      t.timer -= DT;
      if (t.timer <= 0) s.task = { stage: 'start', timer: 0 };
      return;
    }

    if (s.job === 'forester' || s.job === 'quarrier') {
      const depType = def.deposit;
      switch (t.stage) {
        case 'start': {
          if (outCount(b) >= def.outCap) {
            setStall(world, b, 'storageFull');
            if (walk(door.x, door.z, 1.2) !== 'walking') s.anim = 'idle';
            return;
          }
          const d = findDeposit(world, b, depType, def.depositRange, s.id);
          if (!d) { setStall(world, b, 'noDeposit'); s.task = { stage: 'wait', timer: 4 }; return; }
          d.reservedBy = s.id;
          t.deposit = d.id;
          // stand on the side of the deposit facing the workplace
          const dx = b.x - d.x, dz = b.z - d.z, len = Math.hypot(dx, dz) || 1;
          const stand = d.type === 'tree' ? 1.1 : 2.2;
          t.spot = [d.x + (dx / len) * stand, d.z + (dz / len) * stand];
          t.stage = 'toDeposit';
          if (b.stall === 'noDeposit' || b.stall === 'noAccess') setStall(world, b, null);
          break;
        }
        case 'toDeposit': {
          const d = world.entities[t.deposit];
          if (!d || d.amount <= 0) { s.task = null; return; }
          if (walk(t.spot[0], t.spot[1], 0.6) === 'arrived') { t.stage = 'work'; t.timer = 0; t.nextStrike = 0; }
          break;
        }
        case 'work': {
          const d = world.entities[t.deposit];
          if (!d || d.amount <= 0) { s.task = null; return; }
          s.anim = W.anim;
          s.heading = Math.atan2(d.x - s.x, d.z - s.z);
          const speed = sf * (s.job === 'forester' && hasTech(world, s.owner, 'axes') ? TECH_EFFECTS.chopSpeed : 1);
          t.timer += DT * speed;
          if (t.timer >= t.nextStrike) {
            t.nextStrike += W.strike;
            emit(world, EV.WORK_STRIKE, { id: s.id, kind: s.job, x: d.x, z: d.z, deposit: d.id });
          }
          if (t.timer >= W.work) {
            const amt = Math.min(W.perTrip, d.amount);
            d.amount -= amt;
            d.reservedBy = null;
            s.carry = { res: W.res, amt };
            if (d.amount <= 0) {
              d.depletedTick = world.tick;
              emit(world, 'deposit:depleted', { id: d.id, type: d.type, x: d.x, z: d.z });
            }
            t.stage = 'return';
          }
          break;
        }
        case 'return': {
          if (walk(door.x, door.z, 1.0) === 'arrived') {
            b.stock.out[W.res] = (b.stock.out[W.res] || 0) + s.carry.amt;
            world.stats.produced[W.res] += s.carry.amt;
            emit(world, EV.PRODUCTION_CYCLE, { id: b.id, res: W.res, amount: s.carry.amt, x: door.x, z: door.z });
            s.carry = null;
            s.task = null;
            if (b.stall === 'noAccess') setStall(world, b, null);
          }
          break;
        }
        default: s.task = null;
      }
      return;
    }

    if (s.job === 'farmer') {
      const plots = b.plots || [];
      switch (t.stage) {
        case 'start': {
          if (outCount(b) >= def.outCap) { setStall(world, b, 'storageFull'); walk(door.x, door.z, 1.2); return; }
          if (b.stall === 'storageFull') setStall(world, b, null);
          // prefer ripe plots, then fallow plots; skip plots another farmer handles
          const busy = (p) => p.tender && p.tender !== s.id && world.entities[p.tender];
          let pick = plots.findIndex((p) => p.state === 'ripe' && !busy(p));
          if (pick < 0) pick = plots.findIndex((p) => p.state === 'fallow' && !busy(p));
          if (pick < 0) { s.task = { stage: 'wait', timer: 2 }; walk(door.x, door.z, 1.5); return; }
          plots[pick].tender = s.id;
          t.plot = pick;
          t.stage = 'toPlot';
          break;
        }
        case 'toPlot': {
          const p = plots[t.plot];
          if (walk(p.x, p.z, 1.0) === 'arrived') { t.stage = p.state === 'ripe' ? 'harvest' : 'sow'; t.timer = 0; t.nextStrike = 0; }
          break;
        }
        case 'sow':
        case 'harvest': {
          const p = plots[t.plot];
          s.anim = t.stage === 'sow' ? 'sow' : 'harvest';
          t.timer += DT * sf;
          if (t.timer >= t.nextStrike) { t.nextStrike += 1; emit(world, EV.WORK_STRIKE, { id: s.id, kind: t.stage, x: p.x, z: p.z }); }
          const need = t.stage === 'sow' ? W.sow : W.harvest;
          if (t.timer >= need) {
            p.tender = undefined;
            if (t.stage === 'sow') { p.state = 'growing'; p.growth = 0; s.task = null; }
            else { p.state = 'fallow'; p.growth = 0; s.carry = { res: 'provisions', amt: W.perTrip }; t.stage = 'return'; }
          }
          break;
        }
        case 'return': {
          if (walk(door.x, door.z, 1.0) === 'arrived') {
            b.stock.out.provisions = (b.stock.out.provisions || 0) + s.carry.amt;
            world.stats.produced.provisions += s.carry.amt;
            emit(world, EV.PRODUCTION_CYCLE, { id: b.id, res: 'provisions', amount: s.carry.amt, x: door.x, z: door.z });
            s.carry = null; s.task = null;
          }
          break;
        }
        default: s.task = null;
      }
      return;
    }

    if (s.job === 'miner') {
      switch (t.stage) {
        case 'start':
          if (walk(door.x, door.z, 0.8) === 'arrived') { t.stage = 'work'; t.timer = 0; t.nextStrike = 0; }
          break;
        case 'work': {
          s.heading = Math.atan2(b.x - s.x, b.z - s.z);
          if (outCount(b) >= def.outCap) { setStall(world, b, 'storageFull'); s.anim = 'idle'; return; }
          if ((b.stock.in.provisions || 0) < W.provisionsPerCycle && t.timer === 0) { setStall(world, b, 'noInput'); s.anim = 'idle'; return; }
          if (b.stall === 'noInput' || b.stall === 'storageFull' || b.stall === 'noAccess') setStall(world, b, null);
          if (t.timer === 0) { b.stock.in.provisions -= W.provisionsPerCycle; world.stats.consumed.provisions += W.provisionsPerCycle; }
          s.anim = W.anim;
          t.timer += DT * sf;
          if (t.timer >= t.nextStrike) { t.nextStrike += 1.1; emit(world, EV.WORK_STRIKE, { id: s.id, kind: 'mine', x: door.x, z: door.z, building: b.id }); }
          if (t.timer >= W.work) {
            b.stock.out.iron = (b.stock.out.iron || 0) + W.perCycle;
            world.stats.produced.iron += W.perCycle;
            emit(world, EV.PRODUCTION_CYCLE, { id: b.id, res: 'iron', amount: W.perCycle, x: door.x, z: door.z });
            t.timer = 0; t.nextStrike = 0;
          }
          break;
        }
        default: s.task = null;
      }
    }
  }

  return {
    id: 'production',
    kind: 'sim',
    init(c) { ctx = c; },
    update() {
      const world = ctx.world;
      // crops grow
      if (world.tick % 5 === 0) {
        for (const b of all(world, 'building')) {
          if (b.type !== 'farm' || b.state !== 'active' || !b.plots) continue;
          const rate = (5 * DT) / WORK.farmer.grow * stabilityFactor(world, b.owner);
          for (const p of b.plots) if (p.state === 'growing') { p.growth = Math.min(1, p.growth + rate); if (p.growth >= 1) p.state = 'ripe'; }
        }
      }
      for (const s of all(world, 'settler')) {
        if (!s.job || s.fleeing || s.arriving) continue;
        stepWorker(world, s);
      }
      // felled trees / exhausted rocks disappear after a while (stumps linger for 40 s)
      if (world.tick % 20 === 0) {
        for (const d of all(world, 'deposit')) if (d.amount <= 0 && d.depletedTick != null && world.tick - d.depletedTick > 800) remove(world, d.id, 'depleted');
      }
    },
  };
}
