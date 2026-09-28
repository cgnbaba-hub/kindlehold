// Points of interest: places in the valley that reward exploring. Each is an entity of kind
// 'poi' with a small state machine (hidden -> found -> done). Deterministic and saved.
//   trader  Crossroads trader: once found, trades goods for Taler (and back)
//   cairn   Lookout cairn on a knoll: the first visitor sees far across the valley
//   ruin    Old watch ruins beyond the river: a buried cache of Taler and iron
//   hamlet  Millbrook: when Maren visits, the hamlet allies with Kindlehold (families + tithe)
import { all, spawn, emit, alert } from '../world/world.js';
import { EV, PLAYER } from '../core/contracts.js';
import { addRes, canAfford, pay } from '../economy/stock.js';
import { reveal, isExplored } from '../exploration/index.js';
import { spawnSettler, housingCap, populationOf } from '../population/index.js';
import { scenarioOf } from '../missions/index.js';

export const POI_INFO = {
  trader: { name: 'Crossroads Trader', desc: 'A travelling merchant who camps where the roads meet. Trades goods for Taler.', radius: 6 },
  cairn: { name: 'Lookout Cairn', desc: 'An old waymark on the knoll. From the top you can see far across the valley.', radius: 5 },
  ruin: { name: 'Old Watch Ruins', desc: 'The broken watch-house of the old kingdom. Something may still lie buried here.', radius: 6 },
  hamlet: { name: 'Millbrook', desc: 'A hamlet of river folk who hid through the Long Frost. Maren could win them over.', radius: 9 },
};

// Base trades; prices move with supply and demand (see priceOf) and relax back over time.
export const TRADES = [
  { id: 'buyTimber', label: 'Buy 20 timber', good: 'timber', give: { taler: 30 }, get: { timber: 20 } },
  { id: 'buyStone', label: 'Buy 20 stone', good: 'stone', give: { taler: 34 }, get: { stone: 20 } },
  { id: 'buyIron', label: 'Buy 10 iron', good: 'iron', give: { taler: 45 }, get: { iron: 10 } },
  { id: 'buyFood', label: 'Buy 20 provisions', good: 'provisions', give: { taler: 25 }, get: { provisions: 20 } },
  { id: 'sellTimber', label: 'Sell 20 timber', good: 'timber', give: { timber: 20 }, get: { taler: 18 } },
  { id: 'sellStone', label: 'Sell 20 stone', good: 'stone', give: { stone: 20 }, get: { taler: 18 } },
  { id: 'sellIron', label: 'Sell 10 iron', good: 'iron', give: { iron: 10 }, get: { taler: 28 } },
];
export const MARKET = { buyStep: 1.12, sellStep: 0.9, min: 0.5, max: 2.5, relaxPer10s: 0.02 };

export function ensureMarket(world) { return world.market || (world.market = { timber: 1, stone: 1, iron: 1, provisions: 1 }); }

/** Current terms of a deal at a trader: Taler scale with the market price of the good. */
export function priceOf(world, map, poi, deal) {
  const m = ensureMarket(world)[deal.good] || 1;
  const disc = (poiDef(map, poi).discount) || 1;
  const buying = !!deal.give.taler;
  if (buying) return { give: { taler: Math.max(1, Math.round(deal.give.taler * m * disc)) }, get: deal.get };
  return { give: deal.give, get: { taler: Math.max(1, Math.round(deal.get.taler * m / disc)) } };
}

export const HAMLET_TITHE = { provisions: 8, taler: 10 };

const FOUND_LINES = {
  trader: ['wren', 'A merchant\'s cart at the crossroads, Warden! He trades timber and iron for good Taler.'],
  cairn: ['wren', 'There is an old cairn on the eastern knoll. Anyone who climbs it would see half the valley.'],
  ruin: ['osric', 'The old watch-house across the Harrow… my grandfather swore the wardens buried their pay chest there.'],
  hamlet: ['wren', 'Smoke in the south-east — people! A hamlet called Millbrook. They will only trust the Warden herself.'],
};

function say(world, speaker, text) {
  const sc = scenarioOf(world);
  const sp = (sc.speakers && sc.speakers[speaker]) || { name: speaker, role: '' };
  const msg = { tick: world.tick, speaker: sp.name, role: sp.role, text, kind: 'dialogue', portrait: speaker };
  world.mission.messages.push(msg);
  if (world.mission.messages.length > 60) world.mission.messages.shift();
  emit(world, EV.MISSION_MESSAGE, msg);
}

/** Enemy (p2) soldiers or buildings within r metres of a village: it is occupied. */
export function occupiedBy(world, poi, r = 24) {
  for (const u of all(world, 'unit')) if (u.owner === 'p2' && !u.downed && Math.hypot(u.x - poi.x, u.z - poi.z) < r) return true;
  for (const b of all(world, 'building')) if (b.owner === 'p2' && b.state !== 'destroyed' && Math.hypot(b.x - poi.x, b.z - poi.z) < r) return true;
  return false;
}

/** The map's definition of a point of interest (custom name, discovery line, reward). */
export function poiDef(map, poi) { return (map.pois && map.pois[poi.mapIndex]) || {}; }
export function poiName(map, poi) { return poiDef(map, poi).label || POI_INFO[poi.type].name; }

export function setupPois(world, services) {
  if (world.poisPlaced || all(world, 'poi').length) {
    // saves from the smaller valley: add the places of the wider map that are missing
    const map = services.terrain.map;
    if (!world.poisWide && map.pois) {
      world.poisWide = true;
      const have = all(world, 'poi');
      map.pois.forEach((d, i) => {
        if (have.some((p) => p.mapIndex === i || (p.mapIndex == null && Math.hypot(p.x - d.x, p.z - d.z) < 10))) return;
        const p = services.nav.nearestWalkablePoint(d.x, d.z, 8) || d;
        spawn(world, { kind: 'poi', type: d.type, owner: 'none', x: p.x, z: p.z, state: 'hidden', mapIndex: i });
      });
    }
    return;
  }
  world.poisWide = true;
  world.poisPlaced = true;
  (services.terrain.map.pois || []).forEach((d, i) => {
    const p = services.nav.nearestWalkablePoint(d.x, d.z, 8) || d;
    spawn(world, { kind: 'poi', type: d.type, owner: 'none', x: p.x, z: p.z, state: 'hidden', mapIndex: i });
  });
}

export function createPoisModule() {
  let ctx = null;
  const unsub = [];

  function visitor(world, poi, heroOnly) {
    const r = POI_INFO[poi.type].radius;
    for (const u of all(world, 'unit')) if (u.owner === PLAYER && !u.downed && (!heroOnly || u.type === 'maren') && Math.hypot(u.x - poi.x, u.z - poi.z) <= r) return u;
    if (!heroOnly) for (const s of all(world, 'settler')) if (s.owner === PLAYER && !s.hidden && Math.hypot(s.x - poi.x, s.z - poi.z) <= r) return s;
    return null;
  }

  function step(world) {
    const half = ctx.services.terrain.half;
    for (const poi of all(world, 'poi')) {
      if (poi.state === 'done') continue;
      if (poi.state === 'hidden' && isExplored(world, half, poi.x, poi.z)) {
        poi.state = 'found';
        emit(world, 'poi:found', { id: poi.id, type: poi.type });
        const map = ctx.services.terrain.map;
        const line = poiDef(map, poi).line || FOUND_LINES[poi.type];
        if (line) say(world, line[0], line[1]);
        alert(world, 'info', `Discovered: ${poiName(map, poi)}.`, poi.x, poi.z);
      }
      if (poi.state !== 'found') continue;
      if (poi.type === 'cairn' && visitor(world, poi, false)) {
        poi.state = 'done';
        reveal(world, half, poi.x, poi.z, 70);
        say(world, 'maren', 'From the cairn the whole eastern valley lies open — the Tollford, the downs, even the smoke of the Rustfang fires.');
        emit(world, 'poi:done', { id: poi.id, type: poi.type });
      } else if (poi.type === 'ruin' && visitor(world, poi, false)) {
        poi.state = 'done';
        const reward = poiDef(ctx.services.terrain.map, poi).reward || { taler: 120, iron: 25 };
        for (const r in reward) addRes(world, PLAYER, r, reward[r], 'treasure');
        world.stats.produced.taler = (world.stats.produced.taler || 0) + (reward.taler || 0);
        say(world, 'osric', `A sealed chest — still full! ${reward.taler || 0} Taler${reward.iron ? ` and ${reward.iron} bars of iron` : ''}.`);
        emit(world, 'poi:done', { id: poi.id, type: poi.type });
      } else if (poi.type === 'hamlet' && visitor(world, poi, true)) {
        // an occupied village cannot side with Kindlehold while enemy soldiers or towers stand in it
        if (occupiedBy(world, poi)) {
          if (!poi.occupiedNotice || world.tick - poi.occupiedNotice > 900) {
            poi.occupiedNotice = world.tick;
            say(world, 'maren', `Enemy soldiers still hold ${poiName(ctx.services.terrain.map, poi)}. Drive them out first — nobody will speak to us while their tower stands.`);
          }
          continue;
        }
        poi.state = 'done';
        world.mission.flags.millbrookAllied = true;
        const name = poiName(ctx.services.terrain.map, poi);
        say(world, 'maren', `${name} stands with ${world.meta.scenarioId === 'harrowmere' || world.meta.scenarioId === 'greyfen' || world.meta.scenarioId === 'tollbreaker' ? 'Kindlehold' : 'us'}. Their families may settle with us, and they will send a share of every harvest.`);
        const free = Math.max(0, housingCap(world, PLAYER) - populationOf(world, PLAYER));
        for (let i = 0; i < Math.min(3, free); i++) spawnSettler(world, PLAYER, poi.x + i * 1.2, poi.z + 1.5, { arriving: true });
        addRes(world, PLAYER, 'provisions', 30, 'gift');
        emit(world, 'poi:done', { id: poi.id, type: poi.type });
      }
    }
  }

  function onCommand(cmd) {
    if (cmd.type !== 'trade') return;
    const world = ctx.world;
    const poi = world.entities[cmd.id];
    const base = TRADES.find((t) => t.id === cmd.deal);
    if (!poi || poi.kind !== 'poi' || poi.type !== 'trader' || poi.state === 'hidden' || !base) return;
    const deal = priceOf(world, ctx.services.terrain.map, poi, base);
    if (!canAfford(world, PLAYER, deal.give)) { emit(world, EV.COMMAND_REJECTED, { type: 'trade', reason: 'Not enough to trade' }); return; }
    pay(world, PLAYER, deal.give, 'trade');
    for (const r in deal.get) addRes(world, PLAYER, r, deal.get[r], 'trade');
    // demand moves the price: buying makes a good dearer, selling floods the market
    const m = ensureMarket(world);
    m[base.good] = Math.max(MARKET.min, Math.min(MARKET.max, (m[base.good] || 1) * (base.give.taler ? MARKET.buyStep : MARKET.sellStep)));
    emit(world, 'poi:trade', { id: poi.id, deal: deal.id });
  }

  return {
    id: 'pois',
    kind: 'sim',
    init(c) {
      ctx = c;
      unsub.push(c.bus.on('command', onCommand));
      unsub.push(c.bus.on('world:setup-done', () => setupPois(ctx.world, ctx.services)));
      unsub.push(c.bus.on('world:loaded', () => setupPois(ctx.world, ctx.services)));
      // Millbrook's tithe arrives with every payday
      unsub.push(c.bus.on('population:payday', ({ owner }) => {
        if (owner !== PLAYER || !ctx.world.mission.flags.millbrookAllied) return;
        // every allied village sends its share
        const villages = Math.max(1, all(ctx.world, 'poi').filter((p) => p.type === 'hamlet' && p.state === 'done').length);
        for (const r in HAMLET_TITHE) addRes(ctx.world, PLAYER, r, HAMLET_TITHE[r] * villages, 'tithe');
      }));
    },
    update({ tick }) {
      if (tick % 10 === 6) step(ctx.world);
      if (tick % 200 === 17) { // prices relax towards normal
        const m = ensureMarket(ctx.world);
        for (const g in m) m[g] = m[g] > 1 ? Math.max(1, m[g] - MARKET.relaxPer10s) : Math.min(1, m[g] + MARKET.relaxPer10s);
      }
    },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
  };
}
