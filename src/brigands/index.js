// The Greyfen brigands (p3): a second faction in the northern fens under Morwen Greyfen.
// They start neutral towards Kindlehold and are at feud with the Rustfang.
//   neutral  guard their hold; building near it (trespass) sours the relation
//   war      raid Kindlehold every few minutes from a finite pool of fighters
//   allied   send fighters to help against Rustfang raids and share game every payday
// Deterministic, saved with the world; the camp is created on a new game and also added to
// saves made before the valley grew.
import { all, emit, alert, worldRng, addPlayer } from '../world/world.js';
import { EV, PLAYER } from '../core/contracts.js';
import { createBuildingEntity } from '../construction/index.js';
import { spawnUnit, isAlive } from '../units/sim.js';
import { doorOf, BUILDINGS } from '../buildings/defs.js';
import { addRes } from '../economy/stock.js';
import { BRIGANDS, stance, relation, setRelation, ensureDiplomacy } from '../diplomacy/index.js';
import { scenarioOf } from '../missions/index.js';

export const BRIGAND_AI = {
  spawnInterval: 40, garrisonCap: 9, reserves: 30,
  raidEvery: 5 * 60, raidSize: 5, trespassRadius: 48,
  helpSize: 4, gift: { timber: 12, provisions: 8 },
};
const CYCLE = ['brigand', 'poacher', 'brigand', 'brigand', 'poacher'];

function say(world, text) {
  const sc = scenarioOf(world);
  const sp = (sc.speakers && sc.speakers.morwen) || { name: 'Morwen Greyfen', role: 'Brigand chieftain' };
  const msg = { tick: world.tick, speaker: sp.name, role: sp.role, text, kind: 'dialogue', portrait: 'morwen' };
  world.mission.messages.push(msg);
  if (world.mission.messages.length > 60) world.mission.messages.shift();
  emit(world, EV.MISSION_MESSAGE, msg);
}

export function setupBrigands(world, terrain) {
  const camp = terrain.map.brigandCamp;
  if (!camp || world.players[BRIGANDS]) return;
  addPlayer(world, { id: BRIGANDS, name: 'Greyfen Brigands', faction: 'greyfen', color: '#4f6a3a', res: {}, stability: 100, ai: true });
  const start = terrain.map.playerStart;
  const rot = Math.atan2(start.x - camp.x, start.z - camp.z);
  createBuildingEntity(world, { type: 'brigandhall', owner: BRIGANDS, x: camp.x, z: camp.z, rot, state: 'active' });
  createBuildingEntity(world, { type: 'brigandtower', owner: BRIGANDS, x: camp.x + 14, z: camp.z + 12, rot, state: 'active' });
  createBuildingEntity(world, { type: 'brigandtower', owner: BRIGANDS, x: camp.x - 15, z: camp.z + 8, rot, state: 'active' });
  const rng = worldRng(world);
  const chief = spawnUnit(world, 'morwen', BRIGANDS, camp.x, camp.z + 8);
  if (chief) chief.order = { type: 'guard', ax: chief.x, az: chief.z, leash: 20 };
  for (let i = 0; i < 4; i++) {
    const u = spawnUnit(world, CYCLE[i], BRIGANDS, camp.x + rng.range(-8, 8), camp.z + 10 + rng.range(-3, 3));
    if (u) u.order = { type: 'guard', ax: u.x, az: u.z, leash: 26 };
  }
  world.brigands = { spawned: 4, nextSpawnTick: world.tick + BRIGAND_AI.spawnInterval * 20, nextRaidTick: null, raidIds: [], helpIds: [], trespassed: [], met: false };
  ensureDiplomacy(world);
}

export function createBrigandsModule() {
  let ctx = null;
  const unsub = [];

  function hall(world) { return all(world, 'building').find((b) => b.type === 'brigandhall' && b.owner === BRIGANDS && b.state !== 'destroyed'); }
  function garrison(world, st) {
    return all(world, 'unit').filter((u) => u.owner === BRIGANDS && !u.commander && !u.downed && !st.raidIds.includes(u.id) && !st.helpIds.includes(u.id));
  }
  function guard(u, h) {
    const ang = (u.id * 2.399) % (Math.PI * 2);
    const r = 10 + (u.id % 3) * 2.5;
    u.order = { type: 'guard', ax: h.x + Math.sin(ang) * r, az: h.z + Math.cos(ang) * r, leash: 26 };
    u.path = null; u.dest = null; u.target = null;
  }

  function step(world) {
    const st = world.brigands;
    const h = hall(world);
    if (!st || !h) return;
    const toPlayer = stance(world, PLAYER, BRIGANDS);
    // muster
    if (world.tick >= st.nextSpawnTick) {
      st.nextSpawnTick = world.tick + BRIGAND_AI.spawnInterval * 20;
      if (st.spawned < BRIGAND_AI.reserves && garrison(world, st).length < BRIGAND_AI.garrisonCap && h.hp > h.maxHp * 0.5) {
        const d = doorOf(h);
        const u = spawnUnit(world, CYCLE[st.spawned % CYCLE.length], BRIGANDS, d.x, d.z);
        st.spawned++;
        if (u) guard(u, h);
      }
    }
    // first sight: Morwen introduces herself
    if (!st.met && all(world, 'unit').some((u) => u.owner === PLAYER && Math.hypot(u.x - h.x, u.z - h.z) < 60)) {
      st.met = true;
      say(world, 'You walk in the Greyfen now, Warden. We have no quarrel with you — our feud is with Vharek. Bring gifts, not blades, and we may even be friends.');
    }
    // trespass: player buildings close to the hold sour the mood (once per building)
    if (toPlayer !== 'war' && world.tick % 40 === 4) {
      for (const b of all(world, 'building')) {
        if (b.owner !== PLAYER || st.trespassed.includes(b.id) || Math.hypot(b.x - h.x, b.z - h.z) > BRIGAND_AI.trespassRadius) continue;
        st.trespassed.push(b.id);
        setRelation(world, PLAYER, BRIGANDS, relation(world, PLAYER, BRIGANDS) - 30, 'trespass');
        say(world, 'That is Greyfen land you are building on, Warden. Take it away, or we will take it down.');
      }
    }
    // war: raids on Kindlehold
    if (toPlayer === 'war') {
      if (st.nextRaidTick == null) st.nextRaidTick = world.tick + 90 * 20;
      if (!st.raidIds.length && world.tick >= st.nextRaidTick) {
        st.nextRaidTick = world.tick + BRIGAND_AI.raidEvery * 20;
        const pool = garrison(world, st).slice(0, BRIGAND_AI.raidSize);
        let target = null, bd = Infinity;
        for (const b of all(world, 'building')) {
          if (b.owner !== PLAYER || b.state === 'destroyed') continue;
          const d = Math.hypot(b.x - h.x, b.z - h.z) + (b.type === 'keep' ? 200 : 0);
          if (d < bd) { bd = d; target = b; }
        }
        if (pool.length >= 3 && target) {
          const d = doorOf(target);
          pool.forEach((u, i) => { u.order = { type: 'attackMove', x: d.x + i, z: d.z + 1, ax: u.x, az: u.z, targetBuilding: target.id }; u.path = null; u.dest = null; u.target = null; });
          st.raidIds = pool.map((u) => u.id);
          st.raidStart = pool.length;
          alert(world, 'danger', `Greyfen brigands are raiding your ${BUILDINGS[target.type].name}!`, target.x, target.z);
          emit(world, 'brigands:raid', { size: pool.length, target: target.id });
        }
      }
    } else st.nextRaidTick = null;
    // raiders and helpers come home when their job is done or they are beaten
    for (const k of ['raidIds', 'helpIds']) {
      const alive = st[k].map((id) => world.entities[id]).filter((u) => u && isAlive(u));
      const busy = alive.some((u) => u.order && u.order.type === 'attackMove');
      if (alive.length && (alive.length <= (k === 'raidIds' ? Math.ceil((st.raidStart || 1) * 0.4) : 1) || !busy || (k === 'raidIds' && toPlayer !== 'war'))) { for (const u of alive) guard(u, h); st[k] = []; }
      else st[k] = alive.map((u) => u.id);
    }
  }

  return {
    id: 'brigands',
    kind: 'sim',
    init(c) {
      ctx = c;
      // the camp's footprints must block the nav grid exactly as after a load (determinism)
      const setup = () => { const had = !!ctx.world.players[BRIGANDS]; setupBrigands(ctx.world, ctx.services.terrain); if (!had && ctx.services.nav) ctx.services.nav.rebuildDynamic(); };
      unsub.push(c.bus.on('world:setup-done', setup));
      unsub.push(c.bus.on('world:loaded', setup));
      // allies ride out when the Rustfang march on Kindlehold
      unsub.push(c.bus.on(EV.AI_WAVE, ({ x, z }) => {
        const world = ctx.world;
        const st = world.brigands;
        if (!st || stance(world, PLAYER, BRIGANDS) !== 'allied' || st.helpIds.length) return;
        const pool = garrison(world, st).slice(0, BRIGAND_AI.helpSize);
        pool.forEach((u, i) => { u.order = { type: 'attackMove', x: x + i, z: z + 2, ax: u.x, az: u.z }; u.path = null; u.dest = null; u.target = null; });
        st.helpIds = pool.map((u) => u.id);
        if (pool.length) say(world, `Vharek's dogs are loose again. ${pool.length} of my people are on their way to help you, Warden.`);
      }));
      // allies share game and timber every payday
      unsub.push(c.bus.on('population:payday', ({ owner }) => {
        const world = ctx.world;
        if (owner !== PLAYER || stance(world, PLAYER, BRIGANDS) !== 'allied') return;
        for (const r in BRIGAND_AI.gift) addRes(world, PLAYER, r, BRIGAND_AI.gift[r], 'ally');
      }));
      unsub.push(c.bus.on('diplomacy:stance', ({ a, b, after }) => {
        const world = ctx.world;
        if (!((a === PLAYER && b === BRIGANDS) || (a === BRIGANDS && b === PLAYER))) return;
        if (after === 'war') say(world, 'So be it, Warden. The fens remember every insult.');
        else if (after === 'allied') say(world, 'You have been generous, Warden. The Greyfen stand with Kindlehold — against Vharek, and anyone else.');
        else if (after === 'neutral') say(world, 'We will let bygones be bygones. For now.');
      }));
      unsub.push(c.bus.on(EV.BUILDING_DESTROYED, ({ type }) => {
        if (type !== 'brigandhall') return;
        const world = ctx.world;
        addRes(world, PLAYER, 'taler', 150, 'plunder');
        const k = all(world, 'building').find((b) => b.type === 'keep' && b.owner === PLAYER);
        alert(world, 'success', 'The Greyfen Hold has fallen. Its hoard of 150 Taler is yours.', k ? k.x : 0, k ? k.z : 0);
      }));
    },
    update({ tick }) { if (tick % 10 === 4) step(ctx.world); },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
  };
}

