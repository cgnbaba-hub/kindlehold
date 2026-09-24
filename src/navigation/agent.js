// Walking helper for settlers and units: request path lazily, follow it, report state.
import { followPath } from './index.js';

/**
 * Move e towards (x,z). Returns 'arrived' | 'walking' | 'waiting' | 'fail'.
 * `arriveDist` is how close counts as arrived.
 */
export function walkTo(nav, e, x, z, speed, dt, arriveDist = 0.6) {
  const dx = x - e.x, dz = z - e.z;
  if (dx * dx + dz * dz <= arriveDist * arriveDist) { e.path = null; e.dest = null; e.moving = false; return 'arrived'; }
  if (!e.dest || Math.abs(e.dest[0] - x) > 0.5 || Math.abs(e.dest[1] - z) > 0.5 || (!e.path && !e.pathDone)) {
    const r = nav.requestPath(e, x, z);
    if (r === 'wait') { e.moving = false; return 'waiting'; }
    e.dest = [x, z];
    e.pathDone = false;
    if (r === 'fail') { e.moving = false; e.dest = null; return 'fail'; }
  }
  e.moving = true;
  const done = followPath(e, speed, dt);
  if (done) {
    e.pathDone = true;
    const ddx = x - e.x, ddz = z - e.z;
    if (ddx * ddx + ddz * ddz <= Math.max(arriveDist, 1.6) ** 2) { e.dest = null; e.moving = false; e.pathDone = false; return 'arrived'; }
    // path ended short (partial path / target unreachable)
    e.dest = null; e.moving = false; e.pathDone = false;
    return e.pathPartial ? 'fail' : 'arrived';
  }
  return 'walking';
}

export function stopWalking(e) { e.path = null; e.dest = null; e.moving = false; e.pathDone = false; }
