// Deterministic demo states for verification presets and showcases. Each state is
// produced by playing the real simulation through the command API (bot) and, for
// isolated combat views, by spawning units through the same helpers the game uses.
import { createBot, findSpot } from './bot.js';
import { spawnUnit } from '../units/sim.js';
import { spawnEnemy } from '../ai/index.js';
import { all } from '../world/world.js';
import { createBuildingEntity } from '../construction/index.js';

function playTo(sim, bot, tick) { while (sim.world.tick < tick && !sim.world.mission.result) { bot.step(); sim.step(); } }

function quietEnemy(sim) {
  sim.world.ai.nextScoutTick = 1e9;
  sim.world.mission.raidWarningTick = Math.max(sim.world.mission.raidWarningTick, sim.world.tick + 20 * 60 * 30);
}

export const DEMO_STATES = {
  /** a thriving settlement around minute 10 */
  midgame(sim) {
    const bot = createBot(sim);
    playTo(sim, bot, 10.5 * 1200);
    quietEnemy(sim);
  },
  /** several buildings under construction at different stages */
  construction(sim) {
    const bot = createBot(sim);
    playTo(sim, bot, 5 * 1200);
    quietEnemy(sim);
    const res = sim.world.players.p1.res;
    Object.assign(res, { timber: res.timber + 200, stone: res.stone + 200, iron: res.iron + 40 });
    for (const [type, x, z] of [['barracks', -30, 38], ['cottage', -36, 30], ['cottage', -24, 44]]) {
      const s = findSpot(sim.world, sim.services, type, x, z, 20);
      if (s) sim.issue({ type: 'place', buildingType: type, x: s.x, z: s.z, rot: 2.3 });
    }
  },
  /** two squads clash in front of the settlement */
  battle(sim) {
    const bot = createBot(sim);
    playTo(sim, bot, 6 * 1200);
    quietEnemy(sim);
    const ids = [];
    const types = ['shield', 'shield', 'shield', 'blade', 'blade', 'blade', 'fletcher', 'fletcher', 'fletcher', 'fletcher'];
    types.forEach((t, i) => { const u = spawnUnit(sim.world, t, 'p1', -34 + (i % 5) * 1.8, 32 - Math.floor(i / 5) * 2.2); if (u) ids.push(u.id); });
    const hero = all(sim.world, 'unit').find((u) => u.hero);
    if (hero) { hero.x = hero.px = -28; hero.z = hero.pz = 30; ids.push(hero.id); }
    const foes = ['reaver', 'reaver', 'reaver', 'brute', 'brute', 'slinger', 'slinger', 'reaver', 'reaver'];
    foes.forEach((t, i) => { const u = spawnEnemy(sim.world, t, -18 + (i % 5) * 1.8, 16 - Math.floor(i / 5) * 2); if (u) u.order = { type: 'attackMove', x: -30, z: 30, ax: u.x, az: u.z }; });
    sim.issue({ type: 'attackMove', ids, x: -22, z: 20 });
  },
  /** Maren casting Beacon Flare into a group of reavers */
  hero(sim) {
    DEMO_STATES.battle(sim);
    for (let i = 0; i < 60; i++) sim.step();
    const hero = all(sim.world, 'unit').find((u) => u.hero);
    const foes = all(sim.world, 'unit').filter((u) => u.owner === 'p2' && Math.hypot(u.x + 25, u.z - 25) < 20);
    if (hero && foes.length) {
      let cx = 0, cz = 0; foes.forEach((f) => { cx += f.x; cz += f.z; });
      sim.issue({ type: 'ability', heroId: hero.id, ability: 'flare', x: cx / foes.length, z: cz / foes.length });
    }
  },
  /** the settlement in deep winter: snow cover, the Harrow frozen over */
  winter(sim) {
    const bot = createBot(sim);
    playTo(sim, bot, 12.4 * 1200);
    quietEnemy(sim);
  },
  /** the first Rustfang raid hitting the settlement */
  raid(sim) {
    const bot = createBot(sim);
    playTo(sim, bot, 16.4 * 1200);
  },
};

/** Showcase: every building type, finished, plus construction stages and rubble. */
DEMO_STATES.buildingLineup = (sim) => {
  quietEnemy(sim);
  const w = sim.world;
  const row = [['cottage', 0], ['lodge', 10], ['quarry', 21], ['farm', 33], ['mine', 46], ['barracks', 60], ['tower', 72], ['warhall', 86], ['reavertower', 100]];
  for (const [type, dx] of row) createBuildingEntity(w, { type, owner: type === 'warhall' || type === 'reavertower' ? 'p2' : 'p1', x: -20 + dx, z: 62, rot: 0.2, state: 'active' });
  const stages = [0.05, 0.35, 0.7];
  stages.forEach((p, i) => { const b = createBuildingEntity(w, { type: 'cottage', owner: 'p1', x: -10 + i * 12, z: 80, rot: 0.2 }); b.build.progress = p; b.build.supplied = { ...b.build.required }; });
  const r = createBuildingEntity(w, { type: 'barracks', owner: 'p1', x: 34, z: 82, rot: 0.2, state: 'active' });
  r.state = 'destroyed'; r.hp = 0; r.destroyedTick = w.tick + 1e6;
  const f = all(w, 'building').find((b) => b.type === 'farm' && b.x > -30);
  if (f) { f.plots = [0, 1, 2, 3, 4, 5].map((i) => ({ x: f.x + Math.sin(i + 0.5) * 9.5, z: f.z + Math.cos(i + 0.5) * 9.5, growth: i / 5, state: i === 5 ? 'ripe' : 'growing' })); }
  w.players.p1.techs.charter = true;
  sim.issue({ type: 'rekindle' });
};

/** Showcase: upgrade levels — Fortress keep, cottage levels 1-3, workshops at level 2. */
DEMO_STATES.levels = (sim) => {
  quietEnemy(sim);
  const w = sim.world;
  w.players.p1.techs.charter = true;
  const keep = all(w, 'building').find((b) => b.type === 'keep' && b.owner === 'p1');
  if (keep) { keep.level = 3; keep.lit = true; w.mission.flags.keepLit = true; }
  [[-30, 60, 1], [-22, 62, 2], [-14, 64, 3]].forEach(([x, z, level]) => { const b = createBuildingEntity(w, { type: 'cottage', owner: 'p1', x, z, rot: 0.9, state: 'active' }); b.level = level; });
  [['lodge', -30, 40], ['quarry', -20, 46]].forEach(([type, x, z]) => { const b = createBuildingEntity(w, { type, owner: 'p1', x, z, rot: 0.9, state: 'active' }); b.level = 2; });
  sim.run(20);
};

/** Showcase: every unit type standing in a row. */
DEMO_STATES.unitLineup = (sim) => {
  quietEnemy(sim);
  const types = ['shield', 'blade', 'fletcher', 'maren', 'reaver', 'slinger', 'brute', 'vharek'];
  for (const u of all(sim.world, 'unit').slice()) if (u.owner === 'p2') u.order = { type: 'hold', ax: u.x, az: u.z };
  types.forEach((t, i) => {
    if (t === 'maren') { const h = all(sim.world, 'unit').find((u) => u.hero); if (h) { h.x = h.px = -40 + i * 2.6; h.z = h.pz = 36; h.heading = 0.4; } return; }
    const u = (t === 'shield' || t === 'blade' || t === 'fletcher') ? spawnUnit(sim.world, t, 'p1', -40 + i * 2.6, 36) : spawnEnemy(sim.world, t, -40 + i * 2.6, 36);
    if (u) { u.order = { type: 'hold', ax: u.x, az: u.z }; u.heading = 0.4; }
  });
};

export function applyDemoState(sim, name) {
  const fn = Object.hasOwn(DEMO_STATES, name) ? DEMO_STATES[name] : null;
  if (!fn) return false;
  fn(sim);
  return true;
}
