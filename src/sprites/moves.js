/**
 * How each ability looks in the arena. Pure presentation: combat/abilities.js
 * decides what a move does; this file decides how it is acted out on a PetStage.
 *
 * A move has:
 *   frames  : keyframes [seconds, pose] for the user. Pose fields (all optional):
 *               f     forward, as a fraction of the distance to the target (1 = in its face)
 *               up    stage pixels above the ground
 *               a     tilt in radians (+ = nose down)
 *               sx/sy stretch, alpha, trail (afterimages from this keyframe on)
 *               ease  'in' to accelerate into this keyframe (dives), otherwise smooth
 *   contact : seconds until the blow lands; the battle log waits this long
 *   cast    : (stage, me, foe) effects when the move starts
 *   impact  : (stage, me, foe, crit) effects when an attack connects
 *   attack  : false for moves that don't strike (they don't break stealth)
 */
import * as fx from './vfx.js';

const smooth = (p) => p * p * (3 - 2 * p);
const DEFAULT_POSE = { f: 0, up: 0, a: 0, sx: 1, sy: 1, alpha: 1 };

function keyframeMotion(frames, reach) {
  const total = frames.at(-1)[0];
  return (p) => {
    const t = p * total;
    let i = 0;
    while (i < frames.length - 2 && t > frames[i + 1][0]) i++;
    const [t0, k0] = frames[i];
    const [t1, k1] = frames[i + 1];
    const raw = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 1;
    const e = k1.ease === 'in' ? raw * raw : smooth(raw);
    const v = (key) => (k0[key] ?? DEFAULT_POSE[key]) + ((k1[key] ?? DEFAULT_POSE[key]) - (k0[key] ?? DEFAULT_POSE[key])) * e;
    return { dx: v('f') * reach, dy: -v('up'), angle: v('a'), sx: v('sx'), sy: v('sy'), alpha: v('alpha'), trail: Boolean(k0.trail) };
  };
}

// Where to put effects on the target.
const front = (me, foe) => foe.cx - me.dir * foe.w * 0.15;
const at = (stage, draw, duration, delay = 0) => stage.effect(draw, duration, { delay });

export const MOVES = {
  // ── Wolf ──
  bite: {
    frames: [[0, {}], [0.12, { f: -0.08, sy: 0.9 }], [0.3, { f: 1, a: 0.1, trail: true }], [0.42, { f: 1 }], [0.7, {}]],
    contact: 0.3,
    impact: (stage, me, foe, crit) => {
      at(stage, fx.fangs(front(me, foe), foe.cy - 2, { color: crit ? '#ffcd75' : '#f4f4f4' }), 0.5);
      at(stage, fx.burst(front(me, foe), foe.cy, { r: 10 }), 0.3, 0.08);
    },
  },
  shadow_stalk: {
    attack: false,
    frames: [[0, {}], [0.15, { sy: 0.85 }], [0.5, { sy: 0.9, alpha: 0.2 }], [0.7, { alpha: 0.3 }]],
    contact: 0.45,
    cast: (stage, me) => {
      at(stage, fx.rising(me.x, me.y, { color: '#333c57', count: 14, spread: 40, height: 30, size: 4 }), 0.9);
      at(stage, fx.rising(me.x, me.y, { color: '#5d275d', count: 8, spread: 34, height: 24 }), 0.8, 0.1);
    },
  },
  cliff_pounce: {
    frames: [
      [0, {}], [0.12, { sy: 0.8 }], [0.4, { f: 0.45, up: 42, a: -0.3, trail: true }],
      [0.55, { f: 1, up: 0, a: 0.35, ease: 'in', trail: true }], [0.62, { f: 1, sy: 0.8 }], [0.8, { f: 1 }], [1.05, {}],
    ],
    contact: 0.55,
    cast: (stage, me) => at(stage, fx.dust(me.x, me.y), 0.5, 0.12),
    impact: (stage, me, foe) => {
      at(stage, fx.clawMarks(front(me, foe), foe.cy, me.dir, { len: 28 }), 0.55);
      at(stage, fx.dust(foe.x, foe.y, { spread: 30 }), 0.5);
      stage.shake(3, 0.3);
    },
  },
  go_for_the_throat: {
    frames: [[0, {}], [0.15, { f: -0.1, sy: 0.85, a: -0.1 }], [0.32, { f: 1.05, up: 8, a: -0.2, trail: true }], [0.38, { f: 1, up: 4 }], [0.5, { f: 1 }], [0.8, {}]],
    contact: 0.34,
    impact: (stage, me, foe, crit) => {
      at(stage, fx.fangs(front(me, foe), foe.cy - 6, { color: '#f4f4f4', width: 16 }), 0.5);
      at(stage, fx.slashArc(front(me, foe), foe.cy - 4, me.dir, { color: '#b13e53', r: 16 }), 0.5, 0.06);
      at(stage, fx.droplets(front(me, foe), foe.cy - 4, me.dir, { count: crit ? 12 : 7 }), 0.7, 0.08);
    },
  },

  // ── Gorilla ──
  pummel: {
    frames: [[0, {}], [0.2, { f: 0.9, trail: true }], [0.28, { f: 1.05 }], [0.36, { f: 0.9 }], [0.44, { f: 1.05 }], [0.52, { f: 0.9 }], [0.6, { f: 1.05 }], [0.85, {}]],
    contact: 0.28,
    impact: (stage, me, foe) => {
      [0, 0.16, 0.32].forEach((delay, i) => {
        at(stage, fx.burst(front(me, foe), foe.cy + [-4, 4, -8][i], { r: 9, rays: 6 }), 0.25, delay);
        stage.shake(1.5, 0.12, { delay });
      });
    },
  },
  ground_slam: {
    frames: [[0, {}], [0.3, { up: 24, sy: 1.1, a: -0.1 }], [0.42, { up: 0, sy: 0.72, ease: 'in' }], [0.62, { sy: 0.75 }], [0.85, {}]],
    contact: 0.72,
    cast: (stage, me, foe) => {
      stage.shake(4, 0.4, { delay: 0.42 });
      at(stage, fx.dust(me.x, me.y, { spread: 34, puffs: 8 }), 0.6, 0.42);
      at(stage, fx.ring(me.x, me.y - 1, { r: 30, squash: 0.25, color: '#7a4a32' }), 0.5, 0.42);
      at(stage, fx.groundWave(me.x + (me.w / 2) * me.dir, foe.x, me.y), 0.3, 0.42);
    },
    impact: (stage, me, foe) => {
      at(stage, fx.ring(foe.x, foe.y - 1, { r: 32, squash: 0.3, color: '#ffcd75' }), 0.5);
      at(stage, fx.dust(foe.x, foe.y, { spread: 30 }), 0.5);
      at(stage, fx.burst(foe.cx, foe.cy + 6, { r: 16 }), 0.35);
    },
  },
  chest_beat: {
    attack: false,
    frames: [[0, {}], [0.1, { up: 4, sy: 1.08 }], [0.2, {}], [0.3, { up: 4, sy: 1.08 }], [0.4, {}], [0.5, { up: 4, sy: 1.08 }], [0.62, {}]],
    contact: 0.55,
    cast: (stage, me, foe) => {
      for (const delay of [0.1, 0.3, 0.5]) {
        at(stage, fx.ring(me.cx, me.cy, { r: 34, color: '#ef7d57' }), 0.45, delay);
        stage.shake(1.5, 0.12, { delay });
      }
      at(stage, fx.soundWaves(me.cx + (me.w / 2) * me.dir, front(me, foe), me.cy - 4, me.dir, { color: '#ef7d57' }), 0.6, 0.2);
    },
  },
  grapple: {
    frames: [[0, {}], [0.25, { f: 1.1, trail: true }], [0.3, { f: 1.15, sx: 1.06 }], [0.65, { f: 1.15, sx: 1.06, a: 0.05 }], [0.9, {}]],
    contact: 0.3,
    impact: (stage, me, foe) => {
      at(stage, fx.squeeze(foe.cx, foe.cy), 0.45);
      at(stage, fx.squeeze(foe.cx, foe.cy), 0.45, 0.2);
      stage.shake(1.5, 0.35);
    },
  },

  // ── Grizzly ──
  swipe: {
    frames: [[0, {}], [0.15, { f: 0.2, up: 4, a: -0.25 }], [0.3, { f: 0.85, a: 0.2, trail: true }], [0.45, { f: 0.85, a: 0.15 }], [0.7, {}]],
    contact: 0.3,
    impact: (stage, me, foe) => at(stage, fx.clawMarks(front(me, foe), foe.cy, me.dir), 0.5),
  },
  maul: {
    frames: [[0, {}], [0.18, { f: 0.1, up: 8, a: -0.35, sy: 1.1 }], [0.34, { f: 1, a: 0.25, trail: true }], [0.42, { f: 0.95, a: -0.1 }], [0.5, { f: 1, a: 0.25 }], [0.8, {}]],
    contact: 0.34,
    impact: (stage, me, foe) => {
      at(stage, fx.clawMarks(front(me, foe), foe.cy, me.dir, { len: 26 }), 0.55);
      at(stage, fx.clawMarks(front(me, foe), foe.cy, me.dir, { len: 26, color: '#b13e53', down: false }), 0.55, 0.14);
      at(stage, fx.droplets(front(me, foe), foe.cy, me.dir), 0.7, 0.14);
      stage.shake(2, 0.2, { delay: 0.14 });
    },
  },
  track_scent: {
    attack: false,
    frames: [[0, {}], [0.1, { f: 0.06, a: 0.1 }], [0.2, {}], [0.3, { f: 0.06, a: 0.1 }], [0.4, {}], [0.5, { f: 0.08, a: 0.12 }], [0.65, {}]],
    contact: 0.5,
    cast: (stage, me, foe) => at(stage, fx.reticle(foe.cx, foe.cy), 1, 0.3),
  },
  endure: {
    attack: false,
    frames: [[0, {}], [0.2, { sx: 1.1, sy: 0.8 }], [0.6, { sx: 1.1, sy: 0.8 }], [0.8, {}]],
    contact: 0.5,
    cast: (stage, me) => {
      at(stage, fx.rising(me.x, me.y, { color: '#38b764', count: 12, spread: 40, height: 34, size: 2 }), 0.9, 0.15);
      at(stage, fx.ring(me.cx, me.cy, { r: 30, color: '#a7f070' }), 0.5, 0.2);
    },
  },

  // ── Eagle ──
  talon_strike: {
    frames: [[0, {}], [0.15, { f: -0.05, up: 10 }], [0.35, { f: 1, up: 6, a: 0.2, trail: true }], [0.45, { f: 1.05, up: 14 }], [0.75, {}]],
    contact: 0.35,
    impact: (stage, me, foe) => {
      at(stage, fx.clawMarks(front(me, foe), foe.cy - 4, me.dir, { len: 16, gap: 5 }), 0.45);
      at(stage, fx.burst(front(me, foe), foe.cy - 4, { r: 8, rays: 6 }), 0.3);
    },
  },
  scout: {
    attack: false,
    frames: [[0, {}], [0.3, { f: 0.1, up: 75, a: -0.3, trail: true }], [0.7, { f: 0.1, up: 75 }], [1.0, {}]],
    contact: 0.6,
    cast: (stage, me, foe) => {
      at(stage, fx.dust(me.x, me.y, { color: '#f4f4f4', puffs: 5 }), 0.4);
      at(stage, fx.reticle(foe.cx, foe.cy, { color: '#73eff7' }), 0.8, 0.35);
    },
  },
  dive_bomb: {
    frames: [
      [0, {}], [0.35, { f: -0.2, up: 80, a: -0.4 }], [0.5, { f: -0.2, up: 80 }],
      [0.65, { f: 1, up: 0, a: 0.6, ease: 'in', trail: true }], [0.72, { f: 1, sy: 0.8, a: 0.3 }], [1.0, { f: 1 }], [1.3, {}],
    ],
    contact: 0.65,
    impact: (stage, me, foe) => {
      at(stage, fx.flash('#f4f4f4', 0.35), 0.2);
      at(stage, fx.burst(foe.cx, foe.cy, { r: 22, rays: 10 }), 0.45);
      at(stage, fx.ring(foe.x, foe.y - 1, { r: 34, squash: 0.3, color: '#7a4a32' }), 0.5);
      at(stage, fx.dust(foe.x, foe.y, { spread: 34, puffs: 8 }), 0.6);
      stage.shake(4, 0.4);
    },
  },
  screech: {
    attack: false,
    frames: [[0, {}], [0.15, { up: 3, a: -0.2, sx: 1.06 }], [0.6, { up: 3, a: -0.2, sx: 1.06 }], [0.75, {}]],
    contact: 0.55,
    cast: (stage, me, foe) => {
      at(stage, fx.soundWaves(me.cx + (me.w / 2) * me.dir, foe.cx, me.cy - 6, me.dir, { waves: 4 }), 0.7, 0.1);
      stage.shake(1.5, 0.4, { delay: 0.35 });
    },
  },
};

const FALLBACK = {
  frames: [[0, {}], [0.18, { f: 0.5, trail: true }], [0.4, {}]],
  contact: 0.2,
  impact: (stage, me, foe) => at(stage, fx.burst(front(me, foe), foe.cy), 0.35),
};

const moveFor = (abilityId) => MOVES[abilityId] ?? FALLBACK;

/** Acts out a move. Returns { contact, duration } in seconds: when it lands and when the user is back. */
export function performMove(stage, userId, targetId, abilityId) {
  const move = moveFor(abilityId);
  const duration = move.frames.at(-1)[0];
  const me = stage.actorBox(userId);
  const foe = stage.actorBox(targetId);
  if (me && foe) {
    const reach = foe.x - me.x - Math.sign(foe.x - me.x) * foe.w * 0.55;
    stage.animate(userId, keyframeMotion(move.frames, reach), duration);
    move.cast?.(stage, me, foe);
  }
  return { contact: move.contact, duration };
}

export const isAttackMove = (abilityId) => moveFor(abilityId).attack !== false;

/** Effects on the target when an attack connects. */
export function performImpact(stage, userId, targetId, abilityId, { crit = false } = {}) {
  const me = stage.actorBox(userId);
  const foe = stage.actorBox(targetId);
  if (!me || !foe) return;
  moveFor(abilityId).impact?.(stage, me, foe, crit);
  if (crit) {
    at(stage, fx.flash('#ffcd75', 0.3), 0.25);
    stage.shake(3, 0.3);
  }
}

/** Effects for status changes and damage/heal over time. */
export function performStatus(stage, targetId, { effect, kind }) {
  const t = stage.actorBox(targetId);
  if (!t) return;
  if (kind === 'dot' || effect === 'bleed') at(stage, fx.droplets(t.cx, t.cy, -t.dir, { count: 5 }), 0.6);
  if (kind === 'heal') at(stage, fx.rising(t.x, t.y, { color: '#38b764', count: 8, spread: 36, height: 30, size: 2 }), 0.8);
  if (effect === 'stun') at(stage, fx.ring(t.cx, t.cy - t.h / 2 - 2, { r: 14, squash: 0.35, color: '#ffcd75' }), 0.6);
  if (effect === 'blind' || effect === 'weaken') at(stage, fx.rising(t.cx, t.cy, { color: '#5d275d', count: 6, spread: 30, height: 18 }), 0.6);
}
