// The day's clock, shared by the simulation loop and the modules that plan around it.
export const NIGHT_PACE = 6;
/** The dark hours (dusk to dawn) that pass at NIGHT_PACE. */
export function isFastHour(h) { return h >= 20 || h < 6; }
