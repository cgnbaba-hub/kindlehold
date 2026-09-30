// Showcase router: ?showcase=<id> loads an isolated, deterministic subsystem scene
// (fixed seed, scripted state, fixed camera/time). Each showcase lives in its own file.
const SHOWCASES = {
  terrain: () => import('./terrain.js'),
  environment: () => import('./environment.js'),
  buildings: () => import('./buildings.js'),
  economy: () => import('./economy.js'),
  chains: () => import('./chains.js'),
  population: () => import('./population.js'),
  units: () => import('./units.js'),
  figures: () => import('./figures.js'),
  combat: () => import('./combat.js'),
  effects: () => import('./effects.js'),
  audio: () => import('./audio.js'),
  ui: () => import('./ui.js'),
  scenario: () => import('./scenario.js'),
};

export function listShowcases() { return Object.keys(SHOWCASES); }

export async function runShowcase(id, params) {
  const loader = Object.hasOwn(SHOWCASES, id) ? SHOWCASES[id] : null;
  if (!loader) throw new Error(`Unknown showcase "${id}". Available: ${listShowcases().join(', ')}`);
  const mod = await loader();
  const { startShowcase } = await import('./runner.js');
  return startShowcase(id, mod.default, params);
}
