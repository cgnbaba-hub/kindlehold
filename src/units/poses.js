// Procedural poses for the segmented figures (see figures.js). A pose is a flat set of joint
// angles; animations are functions of time (or, for walking, of the distance travelled, so feet
// do not slide), and switching animations cross-fades between two poses instead of snapping.
//
// Conventions (figure faces +Z, +X is its right-hand side as drawn):
//   legs/arms: rotation about X; negative swings forward (arms up), positive backward.
//   knees bend positive, elbows negative. armRz > 0 lifts the right arm outwards, armLz < 0 the left.
//   twist > 0 turns the chest so the right shoulder goes back and the left comes forward.
//   itemT/itemW: the right-hand item's pitch in the world (radians about X), blended in by itemW
//   (0 = the item simply follows the forearm). Pole-type items point along +Y (T = PI/2 is level
//   forward), blades along -Y (T = -PI/2 is level forward).

export const POSE_KEYS = ['legA', 'hipR', 'hipL', 'kneeL', 'kneeR', 'armL', 'armR', 'armLz', 'armRz', 'elbowL', 'elbowR', 'bob', 'lean', 'twist', 'sway', 'nod', 'headYaw', 'cape', 'itemT', 'itemW', 'itemRoll', 'bowT'];

export function neutralPose(out = {}) {
  for (const k of POSE_KEYS) out[k] = 0;
  out.kneeL = out.kneeR = 0.05; out.elbowL = out.elbowR = -0.15; out.cape = 0.14;
  return out;
}

export function lerpPose(a, b, w, out) {
  for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * w;
  return out;
}

const smooth = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
const POLES = new Set(['spear', 'pole', 'halberd']);

/** How a weapon is swung: slash, heavy (two-handed overhead), thrust, bow, crossbow, sling. */
export function weaponClass(right, left) {
  if (left === 'bow') return 'bow';
  if (right === 'crossbow') return 'crossbow';
  if (right === 'sling') return 'sling';
  if (POLES.has(right)) return 'thrust';
  if (right === 'maul' || right === 'greataxe' || right === 'pick') return 'heavy';
  return 'slash';
}

// key poses for combat: guard, wind-up and the moment of the blow (partial: unset keys stay neutral)
const KEYS = {
  slash: {
    guard: { armR: -0.75, elbowR: -1.0, armRz: 0.15, armL: -0.7, elbowL: -1.2, armLz: -0.15, kneeL: 0.25, kneeR: 0.2, hipR: 0.2, hipL: -0.15, twist: 0.1, lean: 0.08, itemT: -1.15, itemW: 1 },
    wind: { armR: -2.5, elbowR: -0.9, armRz: 0.55, armL: -0.9, elbowL: -1.3, armLz: -0.2, twist: 0.45, kneeL: 0.3, kneeR: 0.2, hipR: 0.25, hipL: -0.15, lean: -0.05, nod: -0.05, itemT: -3.4, itemW: 1 },
    hit: { armR: -0.6, elbowR: -0.05, armRz: -0.55, armL: -0.6, elbowL: -1.2, armLz: -0.1, twist: -0.45, kneeL: 0.4, kneeR: 0.15, hipR: 0.35, hipL: -0.3, lean: 0.3, nod: 0.12, itemRoll: 0.4, itemT: -0.9, itemW: 1 },
  },
  heavy: {
    guard: { armR: -0.9, elbowR: -0.7, armL: -0.95, elbowL: -0.8, armLz: 0.15, armRz: -0.1, kneeL: 0.25, kneeR: 0.25, hipR: 0.22, hipL: -0.2, lean: 0.12, itemT: -1.2, itemW: 1 },
    wind: { armR: -2.9, elbowR: -0.55, armL: -2.8, elbowL: -0.6, armLz: 0.25, armRz: -0.15, lean: -0.15, nod: -0.12, kneeL: 0.15, kneeR: 0.15, hipR: 0.25, hipL: -0.25, bob: 0.03, itemT: -3.6, itemW: 1 },
    hit: { armR: -0.35, elbowR: -0.05, armL: -0.4, elbowL: -0.1, armLz: 0.2, armRz: -0.15, lean: 0.45, nod: 0.18, kneeL: 0.55, kneeR: 0.45, hipR: 0.35, hipL: -0.35, bob: -0.08, itemT: -0.6, itemW: 1 },
  },
  thrust: {
    guard: { armR: -0.55, elbowR: -1.35, armL: -0.9, elbowL: -1.1, armLz: -0.1, kneeL: 0.3, kneeR: 0.2, hipR: 0.25, hipL: -0.2, twist: 0.15, lean: 0.1, itemT: 1.2, itemW: 1 },
    wind: { armR: -0.2, elbowR: -1.75, armL: -0.9, elbowL: -1.2, armLz: -0.1, twist: 0.35, lean: -0.05, kneeL: 0.25, kneeR: 0.35, hipR: 0.35, hipL: -0.1, itemT: 1.35, itemW: 1 },
    hit: { armR: -1.35, elbowR: -0.1, armL: -0.7, elbowL: -1.0, armLz: -0.05, twist: -0.25, lean: 0.35, kneeL: 0.45, kneeR: 0.1, hipR: 0.4, hipL: -0.4, itemT: 1.55, itemW: 1 },
  },
  bow: {
    guard: { armL: -1.25, elbowL: -0.25, armLz: -0.05, armR: -1.1, elbowR: -1.3, armRz: 0.15, twist: 0.65, headYaw: -0.45, hipR: 0.2, hipL: -0.2, kneeL: 0.12, kneeR: 0.12 },
    wind: { armL: -1.55, elbowL: -0.02, armLz: -0.05, armR: -1.35, elbowR: -2.3, armRz: 0.45, twist: 0.75, headYaw: -0.6, hipR: 0.22, hipL: -0.22, kneeL: 0.15, kneeR: 0.15, lean: -0.04 },
    hit: { armL: -1.5, elbowL: -0.02, armLz: -0.05, armR: -0.9, elbowR: -0.6, armRz: 0.75, twist: 0.8, headYaw: -0.6, hipR: 0.22, hipL: -0.22, kneeL: 0.15, kneeR: 0.15, lean: -0.08 },
  },
  crossbow: {
    guard: { armR: -1.0, elbowR: -1.1, armL: -0.9, elbowL: -1.3, armLz: 0.2, twist: 0.2, kneeL: 0.2, kneeR: 0.2, hipR: 0.2, hipL: -0.15, itemT: 1.0, itemW: 1 },
    wind: { armR: -1.45, elbowR: -0.75, armL: -1.35, elbowL: -1.0, armLz: 0.25, twist: 0.3, nod: 0.1, kneeL: 0.3, kneeR: 0.25, hipR: 0.25, hipL: -0.2, lean: 0.08, itemT: 1.5, itemW: 1 },
    hit: { armR: -1.7, elbowR: -0.7, armL: -1.55, elbowL: -1.0, armLz: 0.25, twist: 0.3, nod: -0.05, lean: -0.14, kneeL: 0.3, kneeR: 0.25, hipR: 0.25, hipL: -0.2, itemT: 1.4, itemW: 1 },
  },
  sling: {
    guard: { armR: -0.4, elbowR: -0.5, armRz: 0.2, armL: -0.5, elbowL: -0.6, twist: 0.2, kneeL: 0.15, kneeR: 0.15 },
    wind: { armR: -3.0, elbowR: -0.2, armRz: 0.4, armL: -1.0, elbowL: -0.3, twist: 0.5, lean: -0.1, kneeL: 0.2, kneeR: 0.3, hipR: 0.25, hipL: -0.2 },
    hit: { armR: -1.1, elbowR: -0.05, armRz: -0.1, armL: -0.4, elbowL: -0.5, twist: -0.35, lean: 0.25, kneeL: 0.35, kneeR: 0.1, hipR: 0.35, hipL: -0.3 },
  },
};
const _a = neutralPose(), _b = neutralPose();

/** Now and then someone idle stretches, wipes the brow or scratches the head (1.4 s every 9 s). */
function idleGesture(P, t, ph0) {
  const c = t % 9;
  if (c > 1.4) return;
  const k = Math.sin((c / 1.4) * Math.PI); // in and out
  switch (Math.floor(t / 9 + ph0) % 3) {
    case 0: P.armL += (-2.8 - P.armL) * k; P.armR += (-2.8 - P.armR) * k; P.armLz = -0.2 * k; P.armRz = 0.2 * k; P.elbowL = P.elbowR = -0.3; P.lean -= 0.12 * k; P.nod -= 0.2 * k; break; // stretch
    case 1: P.armR += (-1.9 - P.armR) * k; P.elbowR = -0.2 - 2.0 * k; P.armRz = 0.3 * k; P.nod += 0.12 * k; break; // wipe the brow
    default: P.armL += (-2.2 - P.armL) * k; P.elbowL = -0.2 - 2.1 * k; P.armLz = -0.45 * k; P.headYaw += 0.2 * k; // scratch the head
  }
}

/**
 * Arms for carrying goods: a log rests on the right shoulder, a sack over the left one (the
 * other arm keeps swinging), stone and iron are held in both arms before the chest.
 */
function carryArms(P, good) {
  if (good === 'timber') { P.armR = -1.35; P.armRz = 0.5; P.elbowR = -2.15; P.twist *= 0.5; }
  else if (good === 'provisions') { P.armL = -1.35; P.armLz = -0.5; P.elbowL = -2.15; P.twist *= 0.5; }
  else { P.armL = P.armR = -0.72; P.elbowL = P.elbowR = -1.3; P.armLz = 0.18; P.armRz = -0.18; P.lean -= 0.05; P.twist *= 0.3; }
}
function keyPose(cls, name, out) { neutralPose(out); Object.assign(out, KEYS[cls][name]); return out; }

/**
 * Fill `P` with the pose of animation `anim` for figure `f`.
 * f: { t (s), phase, walkPh (radians of the stride cycle), anim, lean, tool, carry,
 *      right, left, weapon (class), attack: { since, until, wind } (s), pole }
 */
export function computePose(anim, f, P) {
  neutralPose(P);
  const t = f.t || 0, ph0 = f.phase || 0;
  P.lean = f.lean || 0;
  switch (anim) {
    case 'walk': case 'run': case 'carry': {
      const run = anim === 'run';
      const ph = f.walkPh !== undefined ? f.walkPh : t * (run ? 11 : 8.5);
      const amp = run ? 0.72 : 0.52;
      const s = Math.sin(ph), c = Math.cos(ph);
      P.legA = s * amp;
      // the leg swinging forward folds at the knee; the planted one stays nearly straight
      P.kneeR = 0.12 + Math.max(0, -Math.cos(ph - 0.35)) * (run ? 1.35 : 0.9);
      P.kneeL = 0.12 + Math.max(0, Math.cos(ph - 0.35)) * (run ? 1.35 : 0.9);
      // arms swing against the legs; the forward arm bends more
      P.armR = -s * (run ? 0.75 : 0.55); P.armL = s * (run ? 0.75 : 0.55);
      P.elbowR = (run ? -1.35 : -0.25) - Math.max(0, s) * 0.35;
      P.elbowL = (run ? -1.35 : -0.25) - Math.max(0, -s) * 0.35;
      // lowest while both feet are down, highest over the planted foot
      P.bob = (Math.abs(c) - 0.5) * (run ? 0.1 : 0.05);
      P.twist = -P.legA * 0.22; // shoulders turn against the hips
      P.sway = s * 0.05; P.nod = 0.02 + Math.abs(s) * 0.04;
      if (run) { P.lean += 0.22; P.nod -= 0.05; }
      if (anim === 'carry') carryArms(P, f.carry);
      // soldiers march with the spear upright instead of swinging it about
      else if (f.pole) { P.armR = -0.35 + P.legA * 0.08; P.elbowR = -0.9; }
      else if (f.weapon === 'bow') { P.armL = -0.3 + s * 0.2; P.elbowL = -0.5; } // the bow is carried, not swung
      P.cape = (run ? 0.8 : 0.38) + Math.sin(ph * 2) * 0.06;
      break;
    }
    case 'carryIdle': carryArms(P, f.carry); P.armL += 0; P.nod = Math.sin(t * 1.3 + ph0) * 0.03; P.bob = Math.sin(t * 1.6 + ph0) * 0.008; break;
    case 'chop': case 'pick': case 'hammer': {
      const hammer = anim === 'hammer';
      const c = (t * (hammer ? 2.2 : 1.45)) % 1;
      // slow wind-up, fast blow, a short rest
      const up = c < 0.55 ? smooth(c / 0.55) : c < 0.66 ? 1 - (c - 0.55) / 0.11 : 0;
      const hit = c >= 0.6 && c < 0.8 ? 1 - Math.abs(c - 0.66) / 0.14 : 0;
      P.armR = 0.35 - up * 3.0; P.elbowR = -0.2 - up * 0.7;
      P.armL = hammer ? -0.7 : P.armR * 0.92 - 0.05; P.elbowL = hammer ? -1.2 : P.elbowR;
      P.armLz = hammer ? -0.15 : 0.12; P.armRz = hammer ? 0.05 : -0.1;
      P.twist = hammer ? 0 : 0.25 - up * 0.3;
      P.lean += 0.2 + hit * 0.16 - up * 0.08; P.nod = 0.12 + hit * 0.1;
      P.hipR = 0.25; P.hipL = -0.2; P.kneeL = P.kneeR = 0.2 + hit * 0.18; P.bob = -0.03 * hit;
      break;
    }
    case 'sow': case 'harvest': case 'farm': {
      const c = Math.sin(t * 3.2 + ph0);
      P.lean += 0.55; P.armR = -0.9 + c * 0.5; P.armL = -0.5 - c * 0.3; P.elbowR = -0.5 + c * 0.3; P.elbowL = -0.7;
      P.kneeL = P.kneeR = 0.45; P.nod = 0.2; P.hipR = 0.15; P.hipL = -0.15; P.twist = c * 0.08;
      break;
    }
    case 'mine': {
      // at the rock face: short two-handed pick strokes at chest height, one per anvil ring
      const c = (t / 1.1) % 1;
      const up = c < 0.55 ? Math.sin((c / 0.55) * Math.PI * 0.5) : c < 0.68 ? 1 - (c - 0.55) / 0.13 : 0;
      P.armR = -0.95 - up * 1.25; P.armL = -0.85 - up * 1.15; P.elbowR = P.elbowL = -0.3 - up * 0.8;
      const hit = c >= 0.62 && c < 0.8 ? 1 - Math.abs(c - 0.68) / 0.12 : 0;
      P.lean += 0.2 + hit * 0.14 - up * 0.08; P.nod = 0.12 + hit * 0.08;
      P.hipR = 0.28; P.hipL = -0.22; P.kneeL = 0.3 + hit * 0.08; P.kneeR = 0.18 + hit * 0.08; P.bob = -0.03 * hit;
      break;
    }
    case 'stir': { // at the pot: the ladle turns slow circles, the other hand steadies the rim
      const a = t * 2.4 + ph0;
      P.armR = -0.95 + Math.sin(a) * 0.14; P.armRz = 0.12 + Math.cos(a) * 0.14; P.elbowR = -0.95;
      P.armL = -0.7; P.elbowL = -1.1; P.armLz = -0.1; P.lean += 0.18; P.nod = 0.18; P.kneeL = P.kneeR = 0.1;
      P.sway = Math.sin(a) * 0.02; P.twist = Math.sin(a) * 0.05;
      P.itemT = 0.12; P.itemW = 1; // the ladle points down into the kettle
      break;
    }
    case 'fish': { // rod held out over the water, a patient twitch now and then
      const tw = Math.max(0, Math.sin(t * 0.9 + ph0)) ** 8;
      P.armR = -1.0 - tw * 0.35; P.elbowR = -0.4; P.armL = -0.8; P.elbowL = -1.1; P.armLz = 0.25; P.kneeL = P.kneeR = 0.12; P.nod = 0.12;
      P.itemT = 0.95 - tw * 0.3; P.itemW = 1; // the rod reaches out over the water
      P.headYaw = Math.sin(t * 0.2 + ph0) * 0.2;
      break;
    }
    case 'cast':
      if (f.weapon === 'bow') { // an arrow storm: the bow tilted at the sky, the string drawn to the cheek
        P.armL = -2.35; P.elbowL = -0.05; P.armLz = -0.1; P.armR = -2.05; P.elbowR = -1.75; P.armRz = 0.35;
        P.twist = 0.55; P.lean = -0.18; P.nod = -0.3; P.headYaw = -0.35; P.bowT = 0.8;
        P.kneeL = 0.25; P.kneeR = 0.1; P.hipR = 0.25; P.hipL = -0.15; P.cape = 0.3;
        break;
      }
      P.armR = -2.9; P.armL = -0.5; P.armLz = -0.35; P.lean = -0.1; P.elbowR = -0.15; P.elbowL = -0.4; P.nod = -0.15; P.kneeL = 0.2; P.kneeR = 0.1; P.hipR = 0.2; P.hipL = -0.1; P.cape = 0.3; P.itemT = 0.15; P.itemW = 1; break;
    case 'talk': {
      // two idle neighbours chatting: they take turns, the speaker gestures, the listener nods
      const speaking = Math.sin(t * 0.45 + ph0 * 2.1) > 0;
      if (speaking) {
        const g = Math.sin(t * 2.6 + ph0);
        P.armR = -0.75 + g * 0.3; P.elbowR = -1.25 - g * 0.3; P.armRz = 0.25 + Math.sin(t * 1.7) * 0.1;
        P.armL = -0.25 + Math.max(0, -g) * 0.3; P.elbowL = -0.6; P.nod = Math.sin(t * 3.1 + ph0) * 0.06; P.headYaw = Math.sin(t * 0.9) * 0.15;
      } else if (ph0 % 2) { // arms folded
        P.armL = -0.55; P.armR = -0.55; P.elbowL = P.elbowR = -1.9; P.armLz = 0.32; P.armRz = -0.32; P.nod = Math.max(0, Math.sin(t * 2.2 + ph0)) * 0.12;
      } else { // hands on the hips
        P.armL = 0.1; P.armR = 0.1; P.armLz = -0.55; P.armRz = 0.55; P.elbowL = P.elbowR = -1.4; P.nod = Math.max(0, Math.sin(t * 1.9 + ph0)) * 0.1;
      }
      const shift = Math.sin(t * 0.3 + ph0);
      P.sway = shift * 0.03; P.kneeL = 0.05 + Math.max(0, shift) * 0.12; P.kneeR = 0.05 + Math.max(0, -shift) * 0.12;
      break;
    }
    case 'cower': P.lean += 0.4; P.armL = -1.8; P.armR = -1.8; P.armLz = -0.4; P.armRz = 0.4; P.bob = -0.12; P.elbowL = P.elbowR = -1.6; P.kneeL = P.kneeR = 0.8; P.nod = 0.3; break;
    case 'attack': {
      const cls = f.weapon || 'slash', a = f.attack || { since: 9, until: 9, wind: 0.4 };
      const hitT = cls === 'bow' || cls === 'crossbow' ? 0.18 : 0.12;
      if (a.since < hitT) keyPose(cls, 'hit', P); // the blow lands
      else if (a.since < hitT + 0.35 && a.until > a.wind) lerpPose(keyPose(cls, 'hit', _a), keyPose(cls, 'guard', _b), smooth((a.since - hitT) / 0.35), P);
      else if (a.until < a.wind) lerpPose(keyPose(cls, 'guard', _a), keyPose(cls, 'wind', _b), smooth(1 - a.until / a.wind), P);
      else keyPose(cls, 'guard', P);
      // a little life while waiting on guard
      P.bob += Math.sin(t * 2.2 + ph0) * 0.01; P.nod += Math.sin(t * 1.7 + ph0) * 0.02;
      P.lean += f.lean || 0;
      break;
    }
    default: {
      const breathe = Math.sin(t * 1.6 + ph0) * 0.03;
      P.armL = breathe; P.armR = -breathe; P.nod = Math.sin(t * 0.5 + ph0) * 0.05;
      P.armLz = -0.06; P.armRz = 0.06; P.elbowL = P.elbowR = -0.2;
      // now and then look around, and shift the weight from one leg to the other
      P.headYaw = Math.pow(Math.sin(t * 0.31 + ph0 * 1.7), 5) * 0.75;
      const shift = Math.sin(t * 0.23 + ph0);
      P.sway = shift * 0.035; P.hipR = 0.04 + shift * 0.04; P.hipL = -0.04 + shift * 0.04;
      P.kneeL = 0.05 + Math.max(0, shift) * 0.14; P.kneeR = 0.05 + Math.max(0, -shift) * 0.14;
      P.cape = 0.14 + Math.sin(t * 0.9 + ph0) * 0.04;
      if (f.pole) { P.armR = -0.35; P.elbowR = -0.9; }
      else if (f.weapon === 'bow') { P.armL = -0.25; P.elbowL = -0.45; }
      else if (f.gestures) idleGesture(P, t + ph0 * 1.7, ph0);
    }
  }
  // struck: a short flinch backwards
  const hit = f.hit || 0;
  if (hit > 0) { P.lean -= 0.32 * hit; P.nod -= 0.3 * hit; P.armL -= 0.35 * hit; P.armLz -= 0.25 * hit; P.kneeL += 0.2 * hit; P.kneeR += 0.2 * hit; }
  return P;
}

/**
 * A soldier answers an order (k: 0..1..0 over half a second): weapons go up for an attack,
 * a nod and a short salute for anything else (spears are lifted instead).
 */
export function ackOverlay(P, kind, k, f) {
  if (!(k > 0)) return P;
  if (kind === 'attack') {
    P.armR += (-2.5 - P.armR) * k; P.elbowR += (-0.4 - P.elbowR) * k; P.nod -= 0.12 * k; P.lean -= 0.05 * k;
    if (P.itemW > 0) P.itemW *= 1 - k;
  } else if (f.pole) {
    P.armR += (-0.95 - P.armR) * k; P.nod += 0.14 * k;
  } else if (f.weapon === 'bow') {
    P.armL += (-1.2 - P.armL) * k; P.nod += 0.14 * k;
  } else {
    P.armR += (-1.9 - P.armR) * k; P.elbowR += (-2.2 - P.elbowR) * k; P.armRz += (0.35 - P.armRz) * k; P.nod += 0.1 * k;
  }
  return P;
}
