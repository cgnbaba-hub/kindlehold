// Repeatable verification presets. `demo` selects a deterministic scripted state
// (src/demo/), `camera` a camera preset, `hour` the time of day, `ticks` extra
// simulation ticks run before capture.
export const PRESETS = [
  { name: 'dawn-overview', camera: 'overview', hour: 6.4, demo: 'midgame', ticks: 40 },
  { name: 'midday-overview', camera: 'overview', hour: 12, demo: 'midgame', ticks: 40 },
  { name: 'sunset-overview', camera: 'overview', hour: 18.3, demo: 'midgame', ticks: 40 },
  { name: 'night-overview', camera: 'settlement', hour: 22.5, demo: 'midgame', ticks: 40 },
  { name: 'settlement-closeup', camera: 'settlement-close', hour: 10.5, demo: 'midgame', ticks: 60 },
  { name: 'production-closeup', camera: 'production', hour: 9.5, demo: 'midgame', ticks: 80 },
  { name: 'construction-closeup', camera: 'construction', hour: 15, demo: 'construction', ticks: 200 },
  { name: 'combat-overview', camera: 'combat', hour: 13, demo: 'battle', ticks: 120 },
  { name: 'hero-ability', camera: 'hero', hour: 16, demo: 'battle', ticks: 70, action: 'flare' },
  { name: 'enemy-raid', camera: 'raid', hour: 11, demo: 'raid', ticks: 160, perf: true },
  { name: 'winter-overview', camera: 'overview', hour: 11.5, demo: 'winter', ticks: 40 },
  { name: 'winter-settlement', camera: 'settlement-close', hour: 10.5, demo: 'winter', ticks: 40 },
  { name: 'figures-settlers', camera: 'figures', hour: 11, demo: 'midgame', ticks: 30 },
  { name: 'figures-soldiers', camera: 'squad', hour: 11, demo: 'battle', ticks: 20 },
  { name: 'greyfen-hold', camera: 'greyfen', hour: 14, demo: 'greyfen', ticks: 60 },
  { name: 'ui-1920', camera: 'settlement', hour: 11, demo: 'midgame', ticks: 40, ui: true, viewport: { width: 1920, height: 1080 } },
  { name: 'ui-1280', camera: 'settlement', hour: 11, demo: 'midgame', ticks: 40, ui: true, viewport: { width: 1280, height: 720 } },
];

export const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };
