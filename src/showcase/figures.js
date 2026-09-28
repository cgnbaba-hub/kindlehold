// Figure studio: figure styles side by side playing one animation, driven by a studio clock —
// for judging models and motion up close (unit-builder).
//   ?showcase=figures&group=settlers|army|enemies|leaders&anim=mix|idle|walk|run|attack|work|die
//   window.__STUDIO__.time(t) pins the clock (screenshots of single frames).
import { createFigureRenderer } from '../units/figures.js';
import { UNITS } from '../units/defs.js';

const GROUPS = {
  settlers: [['forester', 'chop'], ['quarrier', 'pick'], ['farmer', 'farm'], ['miner', 'mine'], ['cook', 'stir'], ['fisher', 'fish'], [null, 'carry', 'timber'], [null, 'hammer']],
  army: ['shield', 'blade', 'fletcher', 'crossbow', 'halberd', 'sapper', 'maren', 'wren'],
  enemies: ['reaver', 'slinger', 'brute', 'varrspear', 'varrknight', 'staghalberd', 'stagarcher', 'ironguard', 'arbalest', 'delver'],
  leaders: ['vharek', 'morwen', 'ysolde', 'vane', 'ismay', 'brigand', 'poacher', 'stagwarden'],
};
const AT = { x: 22, z: 74 };

export default {
  caption: 'Figure studio: styles and animations side by side',
  cameraAt: [AT.x, AT.z, 0.05, 16], hour: 11, freezeTime: true, paused: true,
  setup(session, root, params) {
    const group = Object.hasOwn(GROUPS, params.get('group') || '') ? params.get('group') : 'army';
    const anim = params.get('anim') || 'mix';
    const figs = createFigureRenderer({ scene: session.rc.scene, maxFigures: 40 });
    session.setShroud(false);
    const terrain = session.sim.terrain;
    const list = GROUPS[group];
    let pinned = params.has('t') ? Number(params.get('t')) : null;
    const t0 = performance.now();
    const f = {};
    const yaw = 0.05;
    function drawFigures() {
      const t = pinned ?? (performance.now() - t0) / 1000;
      figs.begin();
      list.forEach((spec, i) => {
        const settler = group === 'settlers';
        const [job, work, carry] = settler ? spec : [null, null, null];
        const type = settler ? 'settler' : spec;
        const def = UNITS[type] || {};
        const x = AT.x + (i - (list.length - 1) / 2) * 2.3, z = AT.z;
        Object.assign(f, {
          x, z, y: terrain.height(x, z), heading: yaw + 0.55, style: type, scale: settler ? 1.25 : 1.3,
          tunic: settler ? figs.tunicFor(i + 3) : null, capColor: null, phase: settler ? i + 3 : i * 3 + 1, t: t + i * 0.37,
          job, tool: job ? figs.toolFor(job) : work === 'hammer' ? 'hammer' : null, carry: null, fallen: 0, kneel: false, lean: 0,
          hit: 0, rank: settler ? 0 : i % 3, ranged: def.cls === 'ranged' || !!def.ranged, bladeTint: null, blendFrom: null, blendW: 1, attack: null, walkPh: undefined,
        });
        let a = anim;
        if (a === 'mix' || a === 'work') a = settler ? work : 'attack';
        if (settler && a === 'carry') f.carry = carry;
        if (a === 'walk' || a === 'run') f.walkPh = f.t * (a === 'run' ? 11 : 10);
        if (a === 'attack') {
          const cd = def.cooldown || 1.2, c = (t + i * 0.23) % cd;
          f.attack = { since: c, until: cd - c, wind: Math.min(f.ranged ? 0.8 : 0.4, cd * (f.ranged ? 0.55 : 0.4)) };
        }
        if (a === 'die') { f.fallen = Math.min(1, (t % 2) / 0.85); a = 'idle'; }
        f.anim = a;
        figs.draw(f);
      });
      figs.end();
    }
    const orig = session.rc.draw.bind(session.rc);
    session.rc.draw = function studioDraw() { drawFigures(); return orig(); };
    window.__STUDIO__ = { time(t) { pinned = t; }, list };
  },
};
