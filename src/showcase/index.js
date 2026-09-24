// Showcase router: ?showcase=<id> lazily loads an isolated deterministic subsystem scene.
const SHOWCASES = {};

export function listShowcases() { return Object.keys(SHOWCASES); }

export async function runShowcase(id, params) {
  const loader = SHOWCASES[id];
  if (!loader) throw new Error(`Unknown showcase "${id}". Available: ${listShowcases().join(', ') || 'none yet'}`);
  const mod = await loader();
  return mod.default(params);
}
