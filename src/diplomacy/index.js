// Diplomacy: relations between the factions of the valley. Each pair of players has a
// relation from -100 (blood feud) to +100 (sworn allies); the stance follows from it:
//   war      relation <= -30   (units fight on sight, raids)
//   neutral  -30 .. 60         (leave each other alone)
//   allied   >= 60             (allies help against the Rustfang, better trade)
// The Rustfang (p2) never make peace, but take a toll for a truce. The Greyfen brigands (p3)
// start neutral: gifts win them over, trespassing and attacks turn them hostile.
import { all, emit, alert } from '../world/world.js';
import { EV, PLAYER, ENEMY } from '../core/contracts.js';
import { canAfford, pay } from '../economy/stock.js';
import { enemyFaction } from '../ai/factions.js';

export const BRIGANDS = 'p3';
export const WAR_AT = -30;
export const ALLY_AT = 60;
export const TRUCE = { cost: { taler: 120 }, duration: 5 * 60 * 20 };
export const GIFT = { cost: { taler: 50 }, gain: 18, cooldown: 30 * 20 };
export const PEACE = { cost: { taler: 80 }, needs: -75 };
const DRIFT_TO = { [`${PLAYER}|${ENEMY}`]: -100, [`${PLAYER}|${BRIGANDS}`]: 0, [`${ENEMY}|${BRIGANDS}`]: -70 };

const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function ensureDiplomacy(world) {
  if (!world.diplomacy) world.diplomacy = { rel: { ...DRIFT_TO }, truceUntil: {}, giftTick: {} };
  return world.diplomacy;
}

export function relation(world, a, b) {
  if (a === b) return 100;
  const d = world.diplomacy;
  if (!d) return a === 'none' || b === 'none' ? 0 : -100; // before diplomacy existed everyone else was an enemy
  return d.rel[key(a, b)] ?? -100;
}

export function stance(world, a, b) {
  if (a === b) return 'allied';
  if (a === 'none' || b === 'none') return 'neutral';
  const d = world.diplomacy;
  if (d && (d.truceUntil[key(a, b)] || 0) > world.tick) return 'truce';
  const r = relation(world, a, b);
  return r <= WAR_AT ? 'war' : r >= ALLY_AT ? 'allied' : 'neutral';
}

/** Do units of these two owners fight on sight? */
export function hostile(world, a, b) {
  if (a === b || a === 'none' || b === 'none') return false;
  return stance(world, a, b) === 'war';
}

export function setRelation(world, a, b, value, reason = '') {
  const d = ensureDiplomacy(world);
  const k = key(a, b);
  const before = stance(world, a, b);
  d.rel[k] = Math.max(-100, Math.min(100, Math.round(value)));
  const after = stance(world, a, b);
  if (before !== after) emit(world, 'diplomacy:stance', { a, b, before, after, reason });
}

/** Someone struck a faction they were not at war with: that is war. */
export function provoke(world, attacker, victim) {
  if (!attacker || !victim || attacker === victim || attacker === 'none' || victim === 'none') return;
  const d = ensureDiplomacy(world);
  if ((d.truceUntil[key(attacker, victim)] || 0) > world.tick) d.truceUntil[key(attacker, victim)] = 0;
  if (relation(world, attacker, victim) > WAR_AT - 1) setRelation(world, attacker, victim, -80, 'attack');
}

export function createDiplomacyModule() {
  let ctx = null;
  const unsub = [];

  function onCommand(cmd) {
    const world = ctx.world;
    const d = ensureDiplomacy(world);
    const me = cmd.owner || PLAYER;
    const them = cmd.to;
    if (!['gift', 'truce', 'peace', 'declareWar'].includes(cmd.type)) return;
    if (!world.players[them] || them === me) return;
    const reject = (reason) => emit(world, EV.COMMAND_REJECTED, { type: cmd.type, reason });
    const k = key(me, them);
    if (cmd.type === 'gift') {
      if (them === ENEMY) return reject(`The ${enemyFaction(world).short} take tolls, not gifts`);
      if (world.tick - (d.giftTick[k] || -1e9) < GIFT.cooldown) return reject('Your last gift is still on its way');
      if (!pay(world, me, GIFT.cost, 'gift')) return reject('Not enough Taler');
      d.giftTick[k] = world.tick;
      setRelation(world, me, them, relation(world, me, them) + GIFT.gain, 'gift');
      emit(world, 'diplomacy:gift', { from: me, to: them });
    } else if (cmd.type === 'truce') {
      if (them !== ENEMY) return reject(`Only the ${enemyFaction(world).short} sell truces`);
      if ((d.truceUntil[k] || 0) > world.tick) return reject('A truce is already in force');
      if (world.ai && (world.ai.state === 'raid' || world.ai.state === 'gather')) return reject(`${enemyFaction(world).leaderShort} will not bargain while the ${enemyFaction(world).fighters} are on the march`);
      if (!pay(world, me, TRUCE.cost, 'toll')) return reject('Not enough Taler');
      d.truceUntil[k] = world.tick + TRUCE.duration;
      if (world.ai) {
        // no raids and no plunderers while the toll is paid
        if (world.ai.raidTick != null) world.ai.raidTick = Math.max(world.ai.raidTick, d.truceUntil[k] + 20 * 20);
        world.ai.nextHarassTick = Math.max(world.ai.nextHarassTick || 0, d.truceUntil[k]);
      }
      emit(world, 'diplomacy:truce', { from: me, to: them, until: d.truceUntil[k] });
    } else if (cmd.type === 'peace') {
      if (them === ENEMY) return reject(`${enemyFaction(world).leaderShort} does not make peace — only truces`);
      if (stance(world, me, them) !== 'war') return reject('You are not at war');
      if (!pay(world, me, PEACE.cost, 'peace')) return reject('Not enough Taler');
      setRelation(world, me, them, WAR_AT + 5, 'peace');
      emit(world, 'diplomacy:peace', { from: me, to: them });
    } else if (cmd.type === 'declareWar') {
      if (stance(world, me, them) === 'war') return;
      d.truceUntil[k] = 0;
      setRelation(world, me, them, -90, 'declared');
    }
  }

  return {
    id: 'diplomacy',
    kind: 'sim',
    init(c) {
      ctx = c;
      unsub.push(c.bus.on('command', onCommand));
      unsub.push(c.bus.on('world:setup-done', () => ensureDiplomacy(ctx.world)));
      unsub.push(c.bus.on('world:loaded', () => ensureDiplomacy(ctx.world)));
      unsub.push(c.bus.on('diplomacy:stance', ({ a, b, after, reason }) => {
        const world = ctx.world;
        const other = a === PLAYER ? b : b === PLAYER ? a : null;
        if (!other) return;
        const name = world.players[other] ? world.players[other].name : other;
        const text = { war: `${name} are now at war with Kindlehold${reason === 'attack' ? ' — you struck first' : reason === 'trespass' ? ' — you built on their land' : ''}.`, neutral: `${name} are now neutral towards Kindlehold.`, allied: `${name} have sworn friendship with Kindlehold!`, truce: `A truce with ${name}.` }[after];
        const keep = all(world, 'building').find((x) => x.type === 'keep' && x.owner === PLAYER);
        alert(world, after === 'war' ? 'danger' : after === 'allied' ? 'success' : 'info', text, keep ? keep.x : 0, keep ? keep.z : 0);
      }));
    },
    update({ tick }) {
      const world = ctx.world;
      const d = ensureDiplomacy(world);
      if (tick % 100 !== 0) return;
      // relations drift slowly back towards their natural level (grudges fade, friendship needs tending)
      for (const k in DRIFT_TO) {
        const r = d.rel[k] ?? DRIFT_TO[k];
        const target = DRIFT_TO[k];
        if (k === `${PLAYER}|${ENEMY}`) continue;
        // sworn friendship fades slowly (a point every 30 s), ordinary goodwill faster
        if (r > target && (r < ALLY_AT || tick % 600 === 0)) d.rel[k] = Math.max(target, r - 1);
        else if (r < target && r > WAR_AT) d.rel[k] = Math.min(target, r + 1);
      }
    },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
  };
}
