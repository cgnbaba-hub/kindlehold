// Audio showcase: buttons that trigger every sound through the real event bus (audio-builder).
import { h } from '../ui/dom.js';
import { EV } from '../core/contracts.js';

export default {
  caption: 'Click anywhere once to enable audio, then trigger sounds',
  camera: 'settlement', hour: 11,
  setup(session, root) {
    const bus = session.sim.bus;
    const x = -46, z = 50;
    const sounds = [
      ['Chop', () => bus.emit(EV.WORK_STRIKE, { kind: 'forester', x, z })],
      ['Pick', () => bus.emit(EV.WORK_STRIKE, { kind: 'quarrier', x, z })],
      ['Anvil', () => bus.emit(EV.WORK_STRIKE, { kind: 'mine', x, z })],
      ['Hammer', () => bus.emit(EV.WORK_STRIKE, { kind: 'build', x, z })],
      ['Clash', () => bus.emit(EV.COMBAT_HIT, { x, z, targetKind: 'unit', kind: 'melee' })],
      ['Arrow', () => bus.emit(EV.COMBAT_SHOT, { fx: x, fz: z, tx: x + 10, tz: z, flightTicks: 10, kind: 'arrow' })],
      ['Beacon Flare', () => bus.emit(EV.HERO_ABILITY, { ability: 'flare', x, z, radius: 6 })],
      ['Kindle the Line', () => bus.emit(EV.HERO_ABILITY, { ability: 'kindle', x, z, radius: 9 })],
      ['War horn', () => bus.emit(EV.AI_WAVE, { wave: 1, size: 9, x, z })],
      ['Objective', () => bus.emit(EV.MISSION_OBJECTIVE, { id: 'x', state: 'done' })],
      ['Collapse', () => bus.emit(EV.BUILDING_DESTROYED, { x, z, type: 'cottage', owner: 'p1' })],
      ['Victory', () => bus.emit(EV.MISSION_ENDED, { result: 'victory' })],
    ];
    const panel = h('div.showcase-audio.panel', {}, sounds.map(([label, fn]) => { const b = h('button.menu-btn', { type: 'button' }, [label]); b.addEventListener('click', () => { session.audio.unlock(); fn(); }); return b; }));
    root.append(panel);
  },
  health: (session) => session.audio.getHealthStatus(),
};
