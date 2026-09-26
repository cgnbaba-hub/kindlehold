// Technology: research queue (one at a time per player, at the Keep).
import { EV, PLAYER, DT } from '../core/contracts.js';
import { emit, all } from '../world/world.js';
import { TECHS } from './defs.js';
import { pay, refund } from '../economy/stock.js';
import { keepOf } from '../population/index.js';

/** Why a tech cannot be researched right now (null when it can). */
export function researchBlocker(world, owner, techId) {
  const tech = TECHS[techId];
  if (!tech) return 'Unknown technology';
  const p = world.players[owner];
  if (p.techs[techId]) return 'Already researched';
  if (p.research) return 'Another study is in progress';
  const keep = keepOf(world, owner);
  if (!keep || keep.state !== 'active') return 'Needs the Keep';
  if (!keep.lit) return 'Rekindle the Keep hearth first';
  for (const r of tech.requires) if (!p.techs[r]) return `Requires ${TECHS[r].name}`;
  if (tech.requiresBuilding && !all(world, 'building').some((b) => b.owner === owner && b.type === tech.requiresBuilding && b.state === 'active')) return 'Requires a Barracks';
  if (tech.requiresKeep && !all(world, 'building').some((b) => b.owner === owner && b.type === 'keep' && (b.level || 1) >= tech.requiresKeep)) return 'Requires the Castle (upgrade the Keep)';
  for (const r in tech.cost) if ((p.res[r] || 0) < tech.cost[r]) return 'Not enough resources';
  return null;
}

export function createTechnologyModule() {
  let ctx = null;
  const unsub = [];
  return {
    id: 'technology',
    kind: 'sim',
    init(c) {
      ctx = c;
      unsub.push(c.bus.on('command', (cmd) => {
        const world = ctx.world;
        const owner = cmd.owner || PLAYER;
        if (cmd.type === 'research') {
          const why = researchBlocker(world, owner, cmd.techId);
          if (why) { emit(world, EV.COMMAND_REJECTED, { type: cmd.type, reason: why }); return; }
          pay(world, owner, TECHS[cmd.techId].cost, `research ${cmd.techId}`);
          world.players[owner].research = { techId: cmd.techId, progress: 0 };
          emit(world, EV.TECH_STARTED, { owner, techId: cmd.techId });
        } else if (cmd.type === 'cancelResearch') {
          const p = world.players[owner];
          if (!p.research) return;
          refund(world, owner, TECHS[p.research.techId].cost, 1, 'cancel research');
          p.research = null;
        }
      }));
    },
    update() {
      const world = ctx.world;
      for (const owner in world.players) {
        const p = world.players[owner];
        if (!p.research) continue;
        const tech = TECHS[p.research.techId];
        p.research.progress = Math.min(1, p.research.progress + DT / tech.time);
        if (p.research.progress >= 1) {
          p.techs[tech.id] = true;
          p.research = null;
          emit(world, EV.TECH_COMPLETED, { owner, techId: tech.id });
        }
      }
    },
    dispose() { unsub.forEach((u) => u()); unsub.length = 0; },
  };
}
