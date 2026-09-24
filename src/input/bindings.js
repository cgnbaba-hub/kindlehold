// Default key bindings (rebindable in Settings -> Controls). Values are KeyboardEvent.code.

export const DEFAULT_BINDINGS = {
  panUp: 'ArrowUp', panDown: 'ArrowDown', panLeft: 'ArrowLeft', panRight: 'ArrowRight',
  rotateLeft: 'KeyQ', rotateRight: 'KeyE', zoomIn: 'Equal', zoomOut: 'Minus',
  attackMove: 'KeyA', patrol: 'KeyP', stop: 'KeyS', hold: 'KeyH',
  abilityFlare: 'KeyF', abilityKindle: 'KeyG',
  buildMenu: 'KeyB', focusSelection: 'Space', focusKeep: 'Home',
  quickSave: 'F5', quickLoad: 'F9', pause: 'Escape', speedUp: 'BracketRight', speedDown: 'BracketLeft',
};

export const BINDING_LABELS = {
  panUp: 'Pan camera up', panDown: 'Pan camera down', panLeft: 'Pan camera left', panRight: 'Pan camera right',
  rotateLeft: 'Rotate camera left', rotateRight: 'Rotate camera right', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
  attackMove: 'Attack-move', patrol: 'Patrol', stop: 'Stop', hold: 'Hold position',
  abilityFlare: 'Maren: Beacon Flare', abilityKindle: 'Maren: Kindle the Line',
  buildMenu: 'Open build menu', focusSelection: 'Centre on selection', focusKeep: 'Centre on the Keep',
  quickSave: 'Quick save', quickLoad: 'Quick load', pause: 'Pause / menu', speedUp: 'Faster game speed', speedDown: 'Slower game speed',
};

export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Equal: '+', Minus: '−', Space: 'Space', Escape: 'Esc', BracketLeft: '[', BracketRight: ']' }[code] || code;
}
