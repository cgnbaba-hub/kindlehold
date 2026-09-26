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

export const TRADES = [
  { id: 'buyTimber', label: 'Buy 20 timber', give: { taler: 30 }, get: { timber: 20 } },
  { id: 'buyIron', label: 'Buy 10 iron', give: { taler: 45 }, get: { iron: 10 } },
  { id: 'buyFood', label: 'Buy 20 provisions', give: { taler: 25 }, get: { provisions: 20 } },
  { id: 'sellStone', label: 'Sell 20 stone', give: { stone: 20 }, get: { taler: 18 } },
];

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

export function setupPois(world, services) {
  if (world.poisPlaced || all(world, 'poi').length) return;
  world.poisPlaced = true;
  for (const d of services.terrain.map.pois || []) {
    const p = services.nav.nearestWalkablePoint(d.x, d.z, 8) || d;
    spawn(world, { kind: 'poi', type: d.type, owner: 'none', x: p.x, z: p.z, state: 'hidden' });
  }
}

export function createPoisModule() {
  let ctx = null;
  const unsub = [];

  function visitor(world, poi, heroOnly) {
    const r = POI_INFO[poi.type].radius;
    for (const u of all(world, 'unit')) if (u.owner === PLAYER && !u.downed && (!heroOnly || u.hero) && Math.hypot(u.x - poi.x, u.z - poi.z) <= r) return u;
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
        const line = FOUND_LINES[poi.type];
        if (line) say(world, line[0], line[1]);
        alert(world, 'info', `Discovered: ${POI_INFO[poi.type].name}.`, poi.x, poi.z);
      }
      if (poi.state !== 'found') continue;
      if (poi.type === 'cairn' && visitor(world, poi, false)) {
        poi.state = 'done';
        reveal(world, half, poi.x, poi.z, 70);
        say(world, 'maren', 'From the cairn the whole eastern valley lies open — the Tollford, the downs, even the smoke of the Rustfang fires.');
        emit(world, 'poi:done', { id: poi.id, type: poi.type });
      } else if (poi.type === 'ruin' && visitor(world, poi, false)) {
        poi.state = 'done';
        addRes(world, PLAYER, 'taler', 120, 'treasure');
        addRes(world, PLAYER, 'iron', 25, 'treasure');
        world.stats.produced.taler = (world.stats.produced.taler || 0) + 120;
        say(world, 'osric', 'The wardens\' pay chest — still sealed! One hundred and twenty Taler and good bar iron. Grandfather was right.');
        emit(world, 'poi:done', { id: poi.id, type: poi.type });
      } else if (poi.type === 'hamlet' && visitor(world, poi, true)) {
        poi.state = 'done';
        world.mission.flags.millbrookAllied = true;
        say(world, 'maren', 'Millbrook stands with Kindlehold. Their families may settle with us, and they will send a share of every harvest.');
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
    const deal = TRADES.find((t) => t.id === cmd.deal);
    if (!poi || poi.kind !== 'poi' || poi.type !== 'trader' || poi.state === 'hidden' || !deal) return;
    if (!canAfford(world, PLAYER, deal.give)) { emit(world, EV.COMMAND_REJECTED, { type: 'trade', reason: 'Not enough to trade' }); return; }
    pay(world, PLAYER, deal.give, 'trade');
    for (const r in deal.get) addRes(world, PLAYER, r, deal.get[r], 'trade');
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
        for (const r in HAMLET_TITHE) addRes(ctx.world, PLAYER, r, HAMLET_TITHE[r], 'tithe');
      }));
    },
    update({ tick }) { if (tick % 10 === 6) step(ctx.world); },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
  };
}
