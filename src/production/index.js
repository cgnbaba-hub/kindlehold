// Production: workers at workplaces run visible work cycles against deposits,
// fields or inputs, carry goods back, and report precise stall reasons.
import { EV, DT } from '../core/contracts.js';
import { all, emit, remove, alert } from '../world/world.js';
import { BUILDINGS, doorOf, workSpeedOf } from '../buildings/defs.js';
import { SETTLER } from '../units/defs.js';
import { stabilityFactor } from '../population/index.js';
import { walkTo, stopWalking } from '../navigation/agent.js';
import { TECH_EFFECTS, hasTech } from '../technology/defs.js';
import { growthFactor } from '../weather/index.js';
import { killAnimal } from '../wildlife/index.js';

export const WORK = {
  forester: { res: 'timber', perTrip: 4, work: 5.0, strike: 0.7, anim: 'chop' },
  quarrier: { res: 'stone', perTrip: 3, work: 6.0, strike: 0.8, anim: 'pick' },
  farmer: { res: 'provisions', perTrip: 4, sow: 2.5, harvest: 3.0, grow: 30, anim: 'farm' },
  miner: { res: 'iron', perCycle: 2, work: 8.0, provisionsPerCycle: 1, anim: 'mine' },
  hunter: { res: 'provisions', perTrip: 4, aim: 1.6, dress: 3.0, throwRange: 10, anim: 'cast' },
  cook: { perCycle: 3, provisionsPerCycle: 2, work: 7.0, anim: 'mine' },
  fisher: { res: 'provisions', perTrip: 3, fish: 7.0, strike: 2.2, frozenSpeed: 0.5, anim: 'fish' },
};

export const TREE_REGROW = 150 * 20; // a felled tree is replanted and stands again after 2.5 minutes

export const STALL_TEXT = {
  paused: 'Work paused — its workers help as labourers',
  noWorker: 'No worker — needs an idle settler (build Cottages for more people)',
  noDeposit: 'Nothing left to work within range',
  storageFull: 'Storage full — labourers must carry goods to the Keep',
  noInput: 'Waiting for provisions to be delivered',
  noAccess: 'Workers cannot reach the site',
  noSettler: 'Needs an idle settler to train — all settlers are working: pause a workplace or build Cottages',
  noGame: 'No deer within 45 m — build the hut nearer a herd, or wait for the herd to recover',
  mealsFull: 'Meal store full — the cook waits for the next mealtime',
};

const STALL_ALERT = { noGame: 'has no deer left in range', noDeposit: 'has nothing left to work nearby — build a new one closer to resources', noInput: 'is waiting for provisions', noAccess: 'cannot be reached by its workers' };

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

/** Where the fisher stands: the dry bank closest to the hut, facing the water. */
export function fishingSpot(services, b) {
  const terrain = services.terrain, nav = services.nav;
  const w = terrain.nearestWater(b.x, b.z, BUILDINGS[b.type].waterRange + 12);
  if (!w) return null;
  // walk from the water towards the hut until the ground is dry and walkable
  const len = Math.hypot(b.x - w.x, b.z - w.z) || 1;
  for (let s = 0; s <= len; s += 0.5) {
    const x = w.x + ((b.x - w.x) / len) * s, z = w.z + ((b.z - w.z) / len) * s;
    if (terrain.waterDepth(x, z) <= 0 && nav.walkable(x, z)) return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, wx: Math.round(w.x * 10) / 10, wz: Math.round(w.z * 10) / 10 };
  }
  return null;
}

export function createProductionModule() {
  let ctx = null;

  function releaseDeposit(world, s) {
    const t = s.task;
    if (t && t.prey) { const a = world.entities[t.prey]; if (a && a.reservedBy === s.id) a.reservedBy = null; }
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
    const sf = stabilityFactor(world, s.owner) * workSpeedOf(b);
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
          if (!d) {
            const anyLeft = all(world, 'deposit').some((x) => x.type === depType && x.amount > 0 && Math.hypot(x.x - b.x, x.z - b.z) <= def.depositRange);
            if (!anyLeft) setStall(world, b, 'noDeposit');
            s.task = { stage: 'wait', timer: 4 };
            return;
          }
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

    if (s.job === 'hunter') {
      switch (t.stage) {
        case 'start': {
          if (outCount(b) >= def.outCap) { setStall(world, b, 'storageFull'); if (walk(door.x, door.z, 1.2) !== 'walking') s.anim = 'idle'; return; }
          let best = null, bd = Infinity;
          for (const a of all(world, 'animal')) {
            if (a.reservedBy && a.reservedBy !== s.id && world.entities[a.reservedBy]) continue;
            const d = Math.hypot(a.x - b.x, a.z - b.z);
            if (d <= def.huntRange && d < bd) { bd = d; best = a; }
          }
          if (!best) { setStall(world, b, 'noGame'); s.task = { stage: 'wait', timer: 5 }; return; }
          if (b.stall === 'noGame' || b.stall === 'noAccess') setStall(world, b, null);
          best.reservedBy = s.id;
          t.prey = best.id; t.stage = 'stalk'; t.repath = 0;
          break;
        }
        case 'stalk': {
          const a = world.entities[t.prey];
          if (!a) { s.task = null; return; }
          const d = Math.hypot(a.x - s.x, a.z - s.z);
          if (d <= W.throwRange) { stopWalking(s); t.stage = 'aim'; t.timer = 0; break; }
          if (Math.hypot(a.x - b.x, a.z - b.z) > def.huntRange + 15) { a.reservedBy = null; s.task = null; return; }
          // stalk to just outside the flight distance, re-aiming as the deer moves
          if (--t.repath <= 0) { t.repath = 30; stopWalking(s); }
          const ux = (s.x - a.x) / (d || 1), uz = (s.z - a.z) / (d || 1);
          walk(a.x + ux * (W.throwRange - 2), a.z + uz * (W.throwRange - 2), 0.8);
          break;
        }
        case 'aim': {
          const a = world.entities[t.prey];
          if (!a) { s.task = null; return; }
          s.anim = W.anim;
          s.heading = Math.atan2(a.x - s.x, a.z - s.z);
          t.timer += DT * sf;
          if (Math.hypot(a.x - s.x, a.z - s.z) > W.throwRange + 3) { t.stage = 'stalk'; break; }
          if (t.timer >= W.aim) {
            t.kill = [a.x, a.z];
            emit(world, EV.COMBAT_SHOT, { kind: 'arrow', fx: s.x, fz: s.z, tx: a.x, tz: a.z, flightTicks: 8, id: s.id });
            killAnimal(world, a.id, s.id);
            t.stage = 'toKill';
          }
          break;
        }
        case 'toKill': {
          if (walk(t.kill[0], t.kill[1], 1.0) === 'arrived') { t.stage = 'dress'; t.timer = 0; t.nextStrike = 0; }
          break;
        }
        case 'dress': {
          s.anim = 'harvest';
          t.timer += DT * sf;
          if (t.timer >= t.nextStrike) { t.nextStrike += 1; emit(world, EV.WORK_STRIKE, { id: s.id, kind: 'harvest', x: s.x, z: s.z }); }
          if (t.timer >= W.dress) { s.carry = { res: 'provisions', amt: W.perTrip }; t.stage = 'return'; }
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

    if (s.job === 'fisher') {
      switch (t.stage) {
        case 'start': {
          if (outCount(b) >= def.outCap) { setStall(world, b, 'storageFull'); if (walk(door.x, door.z, 1.2) !== 'walking') s.anim = 'idle'; return; }
          if (!b.fishSpot) b.fishSpot = fishingSpot(ctx.services, b);
          if (!b.fishSpot) { setStall(world, b, 'noDeposit'); s.task = { stage: 'wait', timer: 5 }; return; }
          if (b.stall === 'noDeposit' || b.stall === 'noAccess') setStall(world, b, null);
          t.stage = 'toSpot';
          break;
        }
        case 'toSpot': {
          if (walk(b.fishSpot.x, b.fishSpot.z, 0.7) === 'arrived') { t.stage = 'fish'; t.timer = 0; t.nextStrike = W.strike; }
          break;
        }
        case 'fish': {
          s.anim = W.anim;
          s.heading = Math.atan2(b.fishSpot.wx - s.x, b.fishSpot.wz - s.z);
          t.timer += DT * sf * (world.weather && world.weather.frozen ? W.frozenSpeed : 1);
          if (t.timer >= t.nextStrike) { t.nextStrike += W.strike; emit(world, EV.WORK_STRIKE, { id: s.id, kind: 'fish', x: b.fishSpot.wx, z: b.fishSpot.wz }); }
          if (t.timer >= W.fish) { s.carry = { res: 'provisions', amt: W.perTrip }; t.stage = 'return'; }
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

    if (s.job === 'cook') {
      switch (t.stage) {
        case 'start':
          if (walk(door.x, door.z, 0.8) === 'arrived') { t.stage = 'work'; t.timer = 0; t.nextStrike = 0; }
          break;
        case 'work': {
          s.heading = Math.atan2(b.x - s.x, b.z - s.z);
          if ((b.meals || 0) >= def.mealCap) { setStall(world, b, 'mealsFull'); s.anim = 'idle'; return; }
          if ((b.stock.in.provisions || 0) < W.provisionsPerCycle && t.timer === 0) { setStall(world, b, 'noInput'); s.anim = 'idle'; return; }
          if (b.stall) setStall(world, b, null);
          if (t.timer === 0) b.stock.in.provisions -= W.provisionsPerCycle;
          s.anim = W.anim;
          t.timer += DT * sf;
          if (t.timer >= t.nextStrike) { t.nextStrike += 1.4; emit(world, EV.WORK_STRIKE, { id: s.id, kind: 'cook', x: door.x, z: door.z, building: b.id }); }
          if (t.timer >= W.work) {
            b.meals = Math.min(def.mealCap, (b.meals || 0) + W.perCycle);
            emit(world, EV.PRODUCTION_CYCLE, { id: b.id, res: 'meals', amount: W.perCycle, x: door.x, z: door.z });
            t.timer = 0; t.nextStrike = 0;
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
          const rate = (5 * DT) / WORK.farmer.grow * stabilityFactor(world, b.owner) * growthFactor(world);
          for (const p of b.plots) if (p.state === 'growing') { p.growth = Math.min(1, p.growth + rate); if (p.growth >= 1) p.state = 'ripe'; }
        }
      }
      for (const s of all(world, 'settler')) {
        if (!s.job || s.fleeing || s.arriving || s.sleep || s.enlisting) continue;
        stepWorker(world, s);
      }
      // felled trees / exhausted rocks disappear after a while (stumps linger for 40 s)
      if (world.tick % 20 === 0) {
        for (const d of all(world, 'deposit')) {
          if (d.amount > 0 || d.depletedTick == null) continue;
          // forests are replanted: a sapling grows where the tree fell
          if (d.type === 'tree') {
            if (d.regrowAt == null) d.regrowAt = d.depletedTick + TREE_REGROW;
            if (world.tick >= d.regrowAt) { d.amount = d.maxAmount; d.depletedTick = null; d.regrowAt = null; emit(world, 'deposit:regrown', { id: d.id, x: d.x, z: d.z }); }
            continue;
          }
          if (world.tick - d.depletedTick > 800) remove(world, d.id, 'depleted');
        }
      }
    },
  };
}
