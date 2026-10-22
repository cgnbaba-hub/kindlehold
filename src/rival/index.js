// The rival town's mind (free play): the scripted bot of src/demo/bot.js plays its economy as
// owner p4 through the same commands as the player, and marches on the player's Keep in waves.
// Its phase and last order live in world.rival, so a save continues exactly as it would have.
import { PLAYER, RIVAL } from '../core/contracts.js';
import { all, alert } from '../world/world.js';
import { createBot } from '../demo/bot.js';
import { keepOf } from '../population/index.js';
import { rivalSettings, rivalOf } from './defs.js';

export function createRivalModule() {
  let ctx = null;
  let bot = null, botWorld = null;

  function brain(world) {
    if (bot && botWorld === world) return bot;
    // (a load replaces the world: the bot is rebuilt for it, its memory is in world.rival)
    botWorld = world;
    bot = createBot(ctx.sim, {
      owner: RIVAL, foe: PLAYER, state: (w) => w.rival,
      assault: (w) => {
        const cfg = rivalSettings(w);
        return { size: cfg.size + w.rival.waves * cfg.grow, regroup: cfg.regroup, notBefore: w.rival.firstAttackTick };
      },
    });
    return bot;
  }

  return {
    id: 'rival',
    kind: 'sim',
    init(c) { ctx = c; },
    update() {
      const world = ctx.world;
      if (!world.rival || !world.players[RIVAL] || world.mission.result || !keepOf(world, RIVAL)) return;
      const cfg = rivalSettings(world);
      // (on Story it thinks every other second only)
      if (Math.floor(world.tick / 20) % cfg.slow !== 0) return;
      const before = world.rival.phase;
      brain(world).step();
      if (before !== 'assault' && world.rival.phase === 'assault') {
        world.rival.waves++;
        const army = all(world, 'unit').filter((u) => u.owner === RIVAL && !u.downed);
        const r = rivalOf(world);
        let x = 0, z = 0; for (const u of army) { x += u.x; z += u.z; }
        alert(world, 'danger', `${r.town} marches on you! ${army.length} of ${r.lord}'s soldiers are on the way.`, x / (army.length || 1), z / (army.length || 1));
      }
    },
  };
}
