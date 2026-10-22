// Stone roads: the player lays them in stretches from point to point. They live in
// world.roads.cells (nav-grid cell indices); the nav grid is told on every change and after a
// load, so routes follow the roads and walkers speed up on them (navigation/agent.js).
import { PLAYER, EV } from '../core/contracts.js';
import { all, emit } from '../world/world.js';
import { territorySources, territoryOwner } from '../world/territory.js';
import { pay, refund } from '../economy/stock.js';
import { CELL } from '../navigation/nav-grid.js';
import { ROADS, roadCellCost } from './defs.js';

function roadsOf(world) {
  if (!world.roads || !Array.isArray(world.roads.cells)) world.roads = { cells: [] };
  return world.roads;
}

/** The cells a straight stretch from A to B crosses, in order, without repeats. */
export function stretchCells(grid, ax, az, bx, bz) {
  const out = [];
  const seen = new Set();
  const d = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(d / (CELL * 0.35)));
  let last = -1;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const k = grid.cellIndex(ax + (bx - ax) * t, az + (bz - az) * t);
    if (k === last || seen.has(k)) continue;
    // a diagonal step through a corner would leave a gap: add the cell beside it
    if (last >= 0) {
      const w = grid.width, li = last % w, lj = (last / w) | 0, i = k % w, j = (k / w) | 0;
      if (li !== i && lj !== j) {
        const side = lj * w + i;
        if (!seen.has(side)) { seen.add(side); out.push(side); }
      }
    }
    seen.add(k); out.push(k); last = k;
  }
  return out;
}

/**
 * Check a stretch for the player (shared by the simulation and the preview).
 * @returns {{ok:boolean, reason?:string, cells:number[], stone:number, cost:object}}
 */
export function checkStretch(world, services, owner, ax, az, bx, bz) {
  const grid = services.nav.grid();
  const cells = stretchCells(grid, ax, az, bx, bz).filter((k) => !grid.isRoadCell(k));
  const per = roadCellCost(world);
  const cost = {};
  for (const r in per) cost[r] = per[r] * cells.length;
  const res = { ok: false, cells, stone: cost.stone, cost };
  if (!cells.length) return { ...res, reason: 'Already a road' };
  if (cells.length > ROADS.perCommand) return { ...res, reason: `Too long: at most ${ROADS.perCommand * CELL} m at a time` };
  if (((world.roads && world.roads.cells.length) || 0) + cells.length > ROADS.maxCells) return { ...res, reason: 'The town has as many roads as it can keep' };
  const src = territorySources(world);
  const deposits = all(world, 'deposit').filter((dp) => dp.amount > 0 && (dp.type === 'tree' || dp.type === 'rock'));
  for (const k of cells) {
    const [x, z] = grid.cellCentre(k);
    if (!grid.roadable(k)) return { ...res, reason: 'The way is blocked' };
    if (territoryOwner(world, x, z, src) !== owner) return { ...res, reason: 'Outside your territory' };
    for (const dp of deposits) {
      const r = ROADS.clearOfDeposits + (dp.type === 'rock' ? 1.2 : 0);
      if ((dp.x - x) ** 2 + (dp.z - z) ** 2 < r * r) return { ...res, reason: dp.type === 'tree' ? 'Trees are in the way' : 'Rocks are in the way' };
    }
  }
  const p = world.players[owner];
  if (!p || p.res.stone < cost.stone) return { ...res, reason: `Needs ${cost.stone} stone` };
  if (cost.taler && p.res.taler < cost.taler) return { ...res, reason: `Needs ${cost.taler} Taler` };
  return { ...res, ok: true };
}

export function createRoadsModule() {
  let ctx = null;
  const unsub = [];

  function sync() {
    const nav = ctx.services.nav;
    if (!nav) return;
    const grid = nav.grid();
    const roads = ctx.world.roads;
    // a road under a new building (or a cell that is no longer open ground) is gone
    if (roads && Array.isArray(roads.cells)) roads.cells = roads.cells.filter((k) => Number.isInteger(k) && grid.roadable(k));
    grid.setRoads(roads ? roads.cells : [], 1 / ROADS.speed);
  }

  function reject(reason, cmd) { emit(ctx.world, EV.COMMAND_REJECTED, { type: cmd.type, reason }); }

  function onCommand(cmd) {
    if (cmd.type !== 'buildRoad' && cmd.type !== 'removeRoad' && cmd.type !== 'undoRoad') return;
    const world = ctx.world;
    const owner = cmd.owner || PLAYER;
    if (cmd.type === 'undoRoad') {
      // take back the stretch just laid, stones and wages returned (only a misclick: it expires fast)
      const roads = roadsOf(world);
      const last = roads.last;
      if (!last || last.owner !== owner || world.tick - last.tick > ROADS.undoTicks) return reject('Nothing to undo', cmd);
      const lift = new Set(last.cells);
      const before = roads.cells.length;
      roads.cells = roads.cells.filter((k) => !lift.has(k));
      delete roads.last;
      // cells a building has covered since are already gone and return nothing
      const lifted = before - roads.cells.length;
      if (!lifted) return reject('Nothing to undo', cmd);
      refund(world, owner, last.cost, lifted / lift.size, 'undo road');
      sync();
      emit(world, 'road:removed', { owner, cells: lifted, undo: true });
      return;
    }
    const ax = Number(cmd.ax), az = Number(cmd.az), bx = Number(cmd.bx), bz = Number(cmd.bz);
    if (![ax, az, bx, bz].every(Number.isFinite)) return reject('Invalid position', cmd);
    const grid = ctx.services.nav.grid();
    const roads = roadsOf(world);
    if (cmd.type === 'buildRoad') {
      const chk = checkStretch(world, ctx.services, owner, ax, az, bx, bz);
      if (!chk.ok) return reject(chk.reason, cmd);
      if (!pay(world, owner, chk.cost, 'road')) return reject('Not enough resources', cmd);
      roads.cells.push(...chk.cells);
      // (only the player's stretch can be taken back: a rival's roads never touch the player's undo)
      if (owner === PLAYER) roads.last = { owner, tick: world.tick, cells: chk.cells.slice(), cost: { ...chk.cost } };
      sync();
      emit(world, 'road:built', { owner, cells: chk.cells.length, cost: chk.cost, ax, az, bx, bz });
    } else {
      // lifting a road returns nothing: the stones are set
      const lift = new Set(stretchCells(grid, ax, az, bx, bz));
      const before = roads.cells.length;
      roads.cells = roads.cells.filter((k) => !lift.has(k));
      if (roads.cells.length === before) return reject('No road there', cmd);
      delete roads.last;
      sync();
      emit(world, 'road:removed', { owner, cells: before - roads.cells.length });
    }
  }

  return {
    id: 'roads',
    kind: 'sim',
    init(c) {
      ctx = c;
      unsub.push(c.bus.on('command', onCommand));
      unsub.push(c.bus.on(EV.BUILDING_PLACED, sync));
      unsub.push(c.bus.on('world:loaded', sync));
      unsub.push(c.bus.on('world:setup-done', sync));
      sync();
    },
    update() {},
    deserialize() { if (ctx) sync(); },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
  };
}
