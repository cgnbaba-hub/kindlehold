// Economy: labourers (settlers without a workplace) haul goods between the Keep store,
// construction sites and workplaces, build, and repair. All transport is physical.
import { EV, DT } from '../core/contracts.js';
import { all, emit, alert, spawn, remove } from '../world/world.js';
import { BUILDINGS, doorOf } from '../buildings/defs.js';
import { SETTLER } from '../units/defs.js';
import { addRes } from './stock.js';
import { siteNeeds, applyBuildWork, MAX_BUILDERS, PRIORITY } from '../construction/index.js';
import { isIdleLabourer, keepOf, stabilityFactor } from '../population/index.js';
import { walkTo, stopWalking } from '../navigation/agent.js';
import { TECH_EFFECTS, hasTech } from '../technology/defs.js';
import { hostile } from '../diplomacy/index.js';
import { DONKEYS, donkeysPerStable, donkeyFodder, donkeysSupplySites, donkeyWage } from '../transport/defs.js';

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
// Hearthhands gather on their own within `range` metres of the nearest store.
export const AUTO_GATHER = { range: 45 };
// Hand gathering is done by Hearthhands only (hired for Taler, fed and paid: see population).
// Townsfolk without a workplace no longer go felling on their own — free gathering made the game
// measurably easier (the bot won up to 9 minutes sooner). The hands stop once the store holds
// this much; the cap is lower on harder difficulties. See CLAUDE.md, "Schwierigkeit".
// Measured: with Story at 300/200 the bot won chapter one in 18 instead of 34 minutes; at 120/80
// (the old Story rule for townsfolk) in about 28. Normal and Hard sit below that.
export const AUTO_GATHER_RULES = { story: { timber: 120, stone: 80 }, normal: { timber: 100, stone: 70 }, hard: { timber: 80, stone: 50 } };
/** Up to which stock Hearthhands gather on their own in this game. */
export function autoGatherRules(world) {
  const d = world.meta && world.meta.difficulty;
  return Object.hasOwn(AUTO_GATHER_RULES, d) ? AUTO_GATHER_RULES[d] : AUTO_GATHER_RULES.normal;
}

function spotAround(b, id, extra = 1.2) {
  const def = BUILDINGS[b.type];
  const ang = (id * 2.399) % (Math.PI * 2);
  const r = def.radius + extra;
  return [b.x + Math.sin(ang) * r, b.z + Math.cos(ang) * r];
}

/** A place labourers fetch goods from and bring them to: the Keep, or a finished Storehouse. */
export function isStore(b, owner) {
  return !!b && b.kind === 'building' && b.owner === owner && ((b.type === 'keep' && b.state !== 'destroyed') || (b.type === 'storehouse' && b.state === 'active'));
}
/**
 * The store for one trip. 'fetch': the shortest way from the labourer via the store to the
 * target; 'drop': the store nearest to where the goods are (the target, or the labourer).
 */
export function pickStore(world, s, target, mode) {
  let best = null, bestD = Infinity;
  const ref = target || s;
  for (const b of all(world, 'building')) {
    if (!isStore(b, s.owner)) continue;
    const d = mode === 'fetch' ? Math.hypot(b.x - s.x, b.z - s.z) + Math.hypot(b.x - ref.x, b.z - ref.z) : Math.hypot(b.x - ref.x, b.z - ref.z);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

/** Goods of one kind on their way to a workplace. */
export function incomingOf(b, res) { const inc = b.stock.inIncoming; return (inc && inc[res]) || 0; }
function unreserveIncoming(b, res, amt) {
  if (!b.stock.inIncoming || typeof b.stock.inIncoming !== 'object') b.stock.inIncoming = {};
  const left = Math.max(0, incomingOf(b, res) - amt);
  if (left > 0) b.stock.inIncoming[res] = left; else delete b.stock.inIncoming[res];
}
function reserveIncoming(b, res, amt) {
  if (!b.stock.inIncoming || typeof b.stock.inIncoming !== 'object') b.stock.inIncoming = {};
  b.stock.inIncoming[res] = incomingOf(b, res) + amt;
}

// Who is served first when several workplaces wait for goods (lower = sooner), and how much of
// a good stays in the Keep for building and meals before a workplace may take it.
const DELIVER_PRIO = { mine: 110, mill: 125, bakery: 120, smithy: 130, canteen: 135 };
const KEEP_BACK = { provisions: 2, timber: 12, iron: 4, flour: 0 };

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
      unreserveIncoming(target, t.res, t.amt);
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
    // pack donkeys only carry: no building, no repairs, but bigger loads (building sites only on Story)
    const beast = s.kind === 'donkey';
    const sites = !beast || donkeysSupplySites(world);
    const res = world.players[owner].res;
    let best = null, bestScore = Infinity;
    const consider = (score, task) => { if (score < bestScore) { bestScore = score; best = task; } };
    for (const b of all(world, 'building')) {
      if (b.owner !== owner) continue;
      // buildings with priority are served first (the distance still counts)
      const d = Math.hypot(b.x - s.x, b.z - s.z) - (b.priority ? PRIORITY.carry : 0);
      if (b.state === 'site') {
        const needs = siteNeeds(b);
        let needAny = false;
        for (const r in needs) {
          needAny = true;
          if (sites) consider(100 + d, { type: 'supply', site: b.id, res: r, amt: Math.min(beast ? DONKEYS.load : SUPPLY_LOAD, needs[r]), stage: 'toKeep' });
          break;
        }
        // builders can work up to what has been supplied so far
        let supplied = 0, required = 0;
        for (const r in b.build.required) { required += b.build.required[r]; supplied += Math.min(b.build.required[r], b.build.supplied[r] || 0); }
        const cap = required === 0 ? 1 : supplied / required;
        b.build.builders = b.build.builders.filter((id) => world.entities[id] && world.entities[id].task && world.entities[id].task.site === b.id);
        if (!beast && cap > b.build.progress + 0.001 && b.build.builders.length < MAX_BUILDERS) {
          consider((needAny ? 60 : 0) + d + b.build.builders.length * 15, { type: 'build', site: b.id, stage: 'toSite' });
        }
      } else if (b.state === 'active') {
        const def = BUILDINGS[b.type];
        if (def.outCap) {
          let out = 0;
          for (const r in b.stock.out) out += b.stock.out[r];
          const avail = out - b.stock.outReserved;
          const food = (b.stock.out.provisions > 0 || b.stock.out.bread > 0) && res.provisions + res.bread * 2 < world.players[owner].pop * 2;
          if (avail >= 2 || (avail >= 1 && out >= def.outCap - 1) || (food && avail >= 1)) {
            // haul what the Keep is short of first; a well-stocked good can wait
            let kind = null; for (const r in b.stock.out) if (b.stock.out[r] > 0) { kind = r; break; }
            const stock = kind ? res[kind] : 0;
            const need = stock < 30 ? -45 : stock > 250 ? 90 : stock > 120 ? 30 : 0;
            consider((food ? 40 : 150) + need + d - Math.min(60, avail * 8), { type: 'haul', from: b.id, amt: Math.min(beast ? DONKEYS.load : HAUL_LOAD, avail), stage: 'toBuilding' });
          }
        }
        if (def.inputs && !b.paused) {
          for (const r in def.inputs) {
            const have = (b.stock.in[r] || 0) + incomingOf(b, r);
            if (have > def.inputs[r] - DELIVER_LOAD) continue;
            const load = beast ? Math.min(DONKEYS.deliver, def.inputs[r] - have) : DELIVER_LOAD;
            // the Windmill only grinds grain the next meal does not need
            const keepBack = (KEEP_BACK[r] || 0) + (b.type === 'mill' ? world.players[owner].pop : 0);
            if (res[r] < load + keepBack) continue;
            // an empty mine comes first; the Tavern's kitchen is a comfort and waits its turn
            const prio = b.type === 'mine' && have === 0 ? 70 : (DELIVER_PRIO[b.type] || 120);
            consider(prio + d, { type: 'deliver', to: b.id, res: r, amt: load, stage: 'toKeep' });
          }
        }
        if (!beast && b.hp < b.maxHp * 0.75 && !b.repairer && world.tick - b.lastHitTick > 200 && res.timber >= 3) {
          consider(200 + d, { type: 'repair', target: b.id, amt: 3, stage: 'toKeep' });
        }
      }
    }
    if (!best) return null;
    // reserve
    const target = world.entities[best.site ?? best.from ?? best.to ?? best.target];
    if (best.type === 'supply') target.build.incoming[best.res] = (target.build.incoming[best.res] || 0) + best.amt;
    else if (best.type === 'haul') target.stock.outReserved += best.amt;
    else if (best.type === 'deliver') reserveIncoming(target, best.res, best.amt);
    else if (best.type === 'build') { target.build.builders.push(s.id); best.spot = spotAround(target, s.id); }
    else if (best.type === 'repair') { target.repairer = s.id; best.spot = spotAround(target, s.id); }
    return best;
  }

  function stepLabourer(world, s, keep) {
    const nav = ctx.services.nav;
    const speed = (s.kind === 'donkey' ? DONKEYS.speed : SETTLER.speed) * (s.carry ? 0.9 : 1);
    const t = s.task;
    const door = doorOf(keep);
    const keepSpot = [door.x + ((s.id % 7) - 3) * 0.6, door.z + 0.8];
    const target = t && t.type !== 'idle' ? world.entities[t.site ?? t.from ?? t.to ?? t.target] : null;
    // goods are fetched from and brought to the best store for this trip: the Keep or a Storehouse
    const storeSpot = (mode) => {
      let st = t.store != null ? world.entities[t.store] : null;
      if (!isStore(st, s.owner)) { st = pickStore(world, s, target, mode) || keep; t.store = st.id; }
      const d = doorOf(st);
      return [d.x + ((s.id % 7) - 3) * 0.6, d.z + 0.8];
    };
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
        const r = walkTo(nav, s, t.spot[0], t.spot[1], (s.kind === 'donkey' ? DONKEYS.speed : SETTLER.speed) * 0.6, DT, 0.8);
        s.anim = r === 'walking' ? 'walk' : 'idle';
        if (world.tick >= t.until) s.task = null;
        break;
      }
      case 'supply': {
        if (t.stage === 'toKeep') {
          const sp = storeSpot('fetch');
          if (walk(sp[0], sp[1]) === 'arrived') { s.carry = { res: t.res, amt: t.amt }; t.stage = 'toSite'; }
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
        } else if (walk(...storeSpot('drop')) === 'arrived') {
          addRes(world, s.owner, s.carry.res, s.carry.amt, 'haul');
          emit(world, 'goods:stored', { id: s.id, res: s.carry.res, amt: s.carry.amt, x: s.x, z: s.z });
          s.carry = null; s.task = null;
        }
        break;
      }
      case 'deliver': {
        if (t.stage === 'toKeep') {
          if (walk(...storeSpot('fetch')) === 'arrived') {
            const p = world.players[s.owner];
            const amt = Math.min(t.amt, Math.floor(p.res[t.res]));
            if (amt <= 0) { abandonTask(world, s); break; }
            addRes(world, s.owner, t.res, -amt, 'deliver');
            s.carry = { res: t.res, amt };
            unreserveIncoming(target, t.res, t.amt - amt);
            t.amt = amt;
            t.stage = 'toBuilding';
          }
        } else {
          const d = doorOf(target);
          if (walk(d.x, d.z, 1.0) === 'arrived') {
            target.stock.in[t.res] = (target.stock.in[t.res] || 0) + s.carry.amt;
            unreserveIncoming(target, t.res, t.amt);
            s.carry = null; s.task = null;
            if (target.stall === 'noInput') target.stall = null;
          }
        }
        break;
      }
      case 'repair': {
        if (t.stage === 'toKeep') {
          if (walk(...storeSpot('fetch')) === 'arrived') {
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
        // the nearest store (Keep or Storehouse)
        let st = t.store != null ? world.entities[t.store] : null;
        if (!isStore(st, s.owner)) { st = pickStore(world, s, null, 'drop') || keep; t.store = st.id; }
        const sd = st === keep ? door : doorOf(st);
        const spot = [sd.x + ((s.id % 7) - 3) * 0.6, sd.z + 0.8];
        if (walk(spot[0], spot[1], 0.8) === 'arrived') {
          if (s.carry) {
            addRes(world, s.owner, s.carry.res, s.carry.amt, 'gather');
            world.stats.produced[s.carry.res] += s.carry.amt;
            emit(world, 'goods:stored', { id: s.id, res: s.carry.res, amt: s.carry.amt, x: s.x, z: s.z });
            emit(world, EV.PRODUCTION_CYCLE, { id: s.id, res: s.carry.res, amount: s.carry.amt, x: s.x, z: s.z });
          }
          s.carry = null;
          t.store = null;
          // a labourer who went on their own does one trip, then looks for work again
          if (o.auto) { releaseGather(world, s); return; }
          t.stage = 'find';
        }
        break;
      }
      default: t.stage = 'find';
    }
  }

  /**
   * A Hearthhand with nothing to do fells a tree or cuts stone by hand while the store runs short,
   * one trip at a time (then the task board decides again: building and carrying come first).
   */
  function autoGather(world, s) {
    const p = world.players[s.owner];
    if (!s.hand || !p || p.autoGather === false) return false;
    const rules = autoGatherRules(world);
    const needT = p.res.timber / rules.timber, needS = p.res.stone / rules.stone;
    if (needT >= 1 && needS >= 1) return false;
    const kind = needT <= needS ? 'tree' : 'rock';
    const home = pickStore(world, s, null, 'drop') || s;
    let best = null, bestD = Infinity;
    for (const d of all(world, 'deposit')) {
      if (d.type !== kind || d.amount <= 0) continue;
      if (d.reservedBy && world.entities[d.reservedBy]) continue;
      const dh = Math.hypot(d.x - home.x, d.z - home.z);
      if (dh > AUTO_GATHER.range) continue;
      const dd = dh + Math.hypot(d.x - s.x, d.z - s.z) * 0.5;
      if (dd < bestD) { bestD = dd; best = d; }
    }
    if (!best) return false;
    stopWalking(s);
    s.task = null;
    s.order = { type: 'gather', kind, x: best.x, z: best.z, deposit: best.id, auto: true };
    return true;
  }

  /** Where a donkey stands when it has nothing to carry or rests: in front of its stable. */
  function stallSpot(stable, dn) {
    const d = doorOf(stable);
    const a = (dn.id * 2.399) % Math.PI - Math.PI / 2 + (stable.rot || 0);
    return [d.x + Math.sin(a) * 2.2, d.z + Math.cos(a) * 2.2];
  }

  const foes = [];
  function stepDonkey(world, dn, gone) {
    const stable = world.entities[dn.stable];
    if (!stable || stable.kind !== 'building' || stable.state !== 'active' || stable.owner !== dn.owner) { gone.push(dn); return; }
    const keep = keepOf(world, dn.owner);
    if (!keep) return;
    // enemies close by: the donkey bolts for its stable (checked every 10 ticks)
    const spatial = ctx.services.spatial;
    if ((world.tick + dn.id) % 10 === 0 && spatial) {
      spatial.query(dn.x, dn.z, 10, foes, (e) => e.kind === 'unit' && hostile(world, dn.owner, e.owner) && !e.downed);
      if (foes.length) dn.fleeUntil = world.tick + 160;
    }
    const fleeing = dn.fleeUntil > world.tick;
    // night, or no fodder at the last meal: back to the stable
    const h = world.time.hour;
    const rest = fleeing || h >= 22 + (dn.id % 5) * 0.2 || h < 5 + (dn.id % 4) * 0.15 || stable.hungry || stable.unpaid;
    if (rest) {
      if (dn.task && dn.task.type !== 'rest') abandonTask(world, dn);
      if (!dn.task) dn.task = { type: 'rest', spot: stallSpot(stable, dn) };
      const r = walkTo(ctx.services.nav, dn, dn.task.spot[0], dn.task.spot[1], DONKEYS.speed * (fleeing ? 1.2 : 0.6), DT, 0.8);
      dn.anim = r === 'walking' ? 'walk' : 'idle';
      return;
    }
    if (dn.task && dn.task.type === 'rest') { dn.task = null; stopWalking(dn); }
    if (!dn.task || (dn.task.type === 'idle' && (world.tick + dn.id) % 10 === 0)) {
      const task = chooseTask(world, dn, keep);
      if (task) { stopWalking(dn); dn.task = task; }
      else if (!dn.task) dn.task = { type: 'idle', until: world.tick + 80, spot: stallSpot(stable, dn) };
    }
    if (dn.task) stepLabourer(world, dn, keep);
  }

  /** After the people have eaten, the donkeys get their fodder from the provisions. */
  function feedDonkeys(world, owner) {
    const p = world.players[owner];
    if (!p) return;
    const per = donkeyFodder(world);
    for (const b of all(world, 'building')) {
      if (b.owner !== owner || b.type !== 'donkeystable' || b.state !== 'active') continue;
      const herd = all(world, 'donkey').filter((dn) => dn.stable === b.id).length;
      if (!herd) continue;
      const need = herd * per;
      const eat = Math.min(need, Math.floor(p.res.provisions));
      if (eat > 0) { addRes(world, owner, 'provisions', -eat, 'fodder'); world.stats.consumed.provisions += eat; }
      const was = !!b.hungry;
      b.hungry = eat < need;
      if (b.hungry && !was) alert(world, 'warn', 'The donkeys found no fodder and stay in their stable until the next meal.', b.x, b.z, owner);
    }
  }

  /** Payday: the drovers want their wage; unpaid, the donkeys stay in the stable until the next one. */
  function payDrovers(world, owner) {
    const p = world.players[owner];
    const wage = donkeyWage(world);
    if (!p) return;
    for (const b of all(world, 'building')) {
      if (b.owner !== owner || b.type !== 'donkeystable' || b.state !== 'active') continue;
      const due = wage * all(world, 'donkey').filter((dn) => dn.stable === b.id).length;
      if (!due) { b.unpaid = false; continue; }
      const paid = Math.min(due, Math.floor(p.res.taler));
      if (paid > 0) { addRes(world, owner, 'taler', -paid, 'drovers'); world.stats.consumed.taler = (world.stats.consumed.taler || 0) + paid; }
      const was = !!b.unpaid;
      b.unpaid = paid < due;
      if (b.unpaid && !was) alert(world, 'warn', `The drovers want ${due} Taler: the donkeys stay in the stable until the next payday.`, b.x, b.z, owner);
    }
  }

  function onCommand(cmd) {
    const world = ctx.world;
    if (cmd.type === 'setAutoGather') {
      const p = world.players[cmd.owner || 'p1'];
      if (p) p.autoGather = !!cmd.on;
      return;
    }
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
      unsub.push(c.bus.on(EV.BUILDING_COMPLETED, ({ id, type }) => {
        if (type !== 'donkeystable') return;
        const world = ctx.world, b = world.entities[id];
        if (!b) return;
        const d = doorOf(b);
        for (let i = 0; i < donkeysPerStable(world); i++) {
          spawn(world, { kind: 'donkey', owner: b.owner, x: d.x + (i - 1) * 1.6, z: d.z + 1.2, heading: b.rot || 0, stable: b.id, task: null, carry: null, anim: 'idle' });
        }
      }));
      unsub.push(c.bus.on('population:meal', ({ owner }) => feedDonkeys(ctx.world, owner)));
      unsub.push(c.bus.on('population:payday', ({ owner }) => payDrovers(ctx.world, owner)));
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
          else if (s.hand && s.task && (world.tick + s.id) % 40 === 0 && autoGather(world, s)) continue;
          else if (!s.task) {
            const door = doorOf(keep);
            const ang = (s.id * 1.7 + Math.floor(world.tick / 400)) % (Math.PI * 2);
            s.task = { type: 'idle', until: world.tick + 80, spot: [door.x + Math.sin(ang) * (5 + (s.id % 4) * 2), door.z + 4 + Math.cos(ang) * (4 + (s.id % 3) * 2)] };
          }
        }
        if (s.task) stepLabourer(world, s, keep);
      }
      // a stable that lost a donkey buys a new one while the treasury allows
      if (world.tick % 200 === 37) {
        for (const b of all(world, 'building')) {
          if (b.type !== 'donkeystable' || b.state !== 'active') continue;
          const p = world.players[b.owner];
          const herd = all(world, 'donkey').filter((d) => d.stable === b.id).length;
          if (herd >= donkeysPerStable(world) || !p || p.res.taler < DONKEYS.price + 20) continue;
          addRes(world, b.owner, 'taler', -DONKEYS.price, 'donkey');
          const d = doorOf(b);
          spawn(world, { kind: 'donkey', owner: b.owner, x: d.x, z: d.z + 1.2, heading: b.rot || 0, stable: b.id, task: null, carry: null, anim: 'idle' });
          alert(world, 'info', `The Donkey Stable bought a new donkey for ${DONKEYS.price} Taler.`, b.x, b.z, b.owner);
        }
      }
      const gone = [];
      for (const dn of all(world, 'donkey')) { dn.px = dn.x; dn.pz = dn.z; stepDonkey(world, dn, gone); }
      // a stable that burnt down, was taken down or moved: its donkeys run off
      for (const dn of gone) { abandonTask(world, dn); remove(world, dn.id, 'stable gone'); }
    },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
  };
}
