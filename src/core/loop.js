// Fixed-timestep loop driver. Simulation advances in whole ticks of DT seconds,
// independent of frame rate. Rendering receives an interpolation factor.
import { DT } from './contracts.js';

export const MAX_STEPS_PER_FRAME = 5;

/**
 * @param {{ step: () => void, render: (alpha:number, frameDt:number) => void }} hooks
 */
export function createFixedLoop(hooks) {
  let acc = 0;
  let speed = 1;
  let paused = false;
  let droppedTime = 0;

  return {
    /** Advance by real elapsed seconds; returns number of ticks simulated. */
    advance(elapsed) {
      // clamp huge gaps (tab switch) to avoid spiral of death
      const e = Math.min(Math.max(elapsed, 0), 0.25);
      let steps = 0;
      if (!paused) {
        acc += e * speed;
        while (acc >= DT && steps < MAX_STEPS_PER_FRAME) {
          hooks.step();
          acc -= DT;
          steps++;
        }
        if (acc >= DT) { droppedTime += acc - (acc % DT); acc %= DT; }
      }
      hooks.render(paused ? 1 : acc / DT, e);
      return steps;
    },
    setSpeed(s) { speed = Math.max(0, Math.min(4, s)); },
    getSpeed: () => speed,
    pause() { paused = true; },
    resume() { paused = false; },
    isPaused: () => paused,
    droppedTime: () => droppedTime,
    reset() { acc = 0; },
  };
}
