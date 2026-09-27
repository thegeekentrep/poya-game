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

  // ── Learned moves (level-ups) ──
  // Wolf
  howl: {
    attack: false,
    frames: [[0, {}], [0.2, { up: 4, a: -0.35, sy: 1.08 }], [0.7, { up: 4, a: -0.35, sy: 1.08 }], [0.85, {}]],
    contact: 0.5,
    cast: (stage, me) => {
      for (const delay of [0.2, 0.4]) at(stage, fx.ring(me.cx + me.w * 0.3 * me.dir, me.cy - me.h * 0.3, { r: 22, color: '#73eff7' }), 0.5, delay);
      at(stage, fx.rising(me.x, me.y, { color: '#ef7d57', count: 8, spread: 36, height: 26, size: 2 }), 0.8, 0.3);
    },
  },
  crippling_bite: {
    frames: [[0, {}], [0.12, { f: -0.08, sy: 0.9 }], [0.3, { f: 1, up: -2, a: 0.2, trail: true }], [0.42, { f: 1 }], [0.7, {}]],
    contact: 0.3,
    impact: (stage, me, foe) => {
      at(stage, fx.fangs(front(me, foe), foe.y - 10, { width: 16 }), 0.5);
      at(stage, fx.rising(foe.cx, foe.cy, { color: '#5d275d', count: 5, spread: 24, height: 14 }), 0.5, 0.1);
    },
  },
  scent_mask: {
    attack: false,
    frames: [[0, {}], [0.15, { a: 0.4, sy: 0.8 }], [0.3, { a: -0.4, sy: 0.8 }], [0.45, { a: 0.4, sy: 0.8 }], [0.65, { alpha: 0.3 }], [0.8, { alpha: 0.3 }]],
    contact: 0.6,
    cast: (stage, me) => {
      at(stage, fx.dust(me.x, me.y, { color: '#7a4a32', puffs: 8, spread: 34 }), 0.6, 0.1);
      at(stage, fx.rising(me.x, me.y, { color: '#333c57', count: 10, spread: 36, height: 24, size: 3 }), 0.8, 0.45);
    },
  },
  hamstring: {
    frames: [[0, {}], [0.12, { sy: 0.85 }], [0.3, { f: 1, up: -2, a: 0.25, sy: 0.85, trail: true }], [0.42, { f: 1, sy: 0.85 }], [0.7, {}]],
    contact: 0.3,
    impact: (stage, me, foe) => {
      at(stage, fx.slashArc(front(me, foe), foe.y - 6, me.dir, { r: 12, from: -2, to: -0.4 }), 0.45);
      at(stage, fx.droplets(front(me, foe), foe.y - 6, me.dir, { count: 4 }), 0.6, 0.06);
    },
  },
  feral_rush: {
    frames: [[0, {}], [0.15, { f: 1, a: 0.1, trail: true }], [0.25, { f: 0.7 }], [0.38, { f: 1.05, up: 6, a: -0.1, trail: true }], [0.48, { f: 1 }], [0.75, {}]],
    contact: 0.15,
    impact: (stage, me, foe, crit) => at(stage, fx.fangs(front(me, foe), foe.cy - 2, { color: crit ? '#ffcd75' : '#f4f4f4', width: 16 }), 0.4),
  },
  vanishing_strike: {
    frames: [[0, {}], [0.2, { f: 1, trail: true }], [0.3, { f: 1 }], [0.6, { alpha: 0.3, trail: true }], [0.75, { alpha: 0.3 }]],
    contact: 0.2,
    impact: (stage, me, foe) => {
      at(stage, fx.clawMarks(front(me, foe), foe.cy, me.dir, { color: '#94b0c2' }), 0.45);
      at(stage, fx.rising(me.x, me.y, { color: '#333c57', count: 10, spread: 36, height: 26, size: 3 }), 0.8, 0.25);
    },
  },
  blood_frenzy: {
    frames: [[0, {}], [0.15, { f: -0.1, sy: 0.85 }], [0.3, { f: 1, a: 0.15, trail: true }], [0.45, { f: 1, a: 0.05 }], [0.75, {}]],
    contact: 0.3,
    impact: (stage, me, foe) => {
      at(stage, fx.fangs(front(me, foe), foe.cy - 2, { color: '#b13e53' }), 0.5);
      at(stage, fx.droplets(front(me, foe), foe.cy, me.dir, { count: 9 }), 0.7, 0.05);
    },
  },
  alpha_howl: {
    attack: false,
    frames: [[0, {}], [0.2, { up: 6, a: -0.4, sy: 1.12 }], [0.75, { up: 6, a: -0.4, sy: 1.12 }], [0.9, {}]],
    contact: 0.55,
    cast: (stage, me, foe) => {
      at(stage, fx.soundWaves(me.cx + (me.w / 2) * me.dir, foe.cx, me.cy - 8, me.dir, { color: '#ffcd75', waves: 4 }), 0.7, 0.2);
      at(stage, fx.ring(me.cx, me.cy, { r: 32, color: '#ffcd75' }), 0.5, 0.2);
      stage.shake(1.5, 0.4, { delay: 0.25 });
    },
  },
  lunar_fang: {
    frames: [[0, {}], [0.25, { f: -0.15, up: 30, a: -0.3 }], [0.45, { f: 1, up: 4, a: 0.3, ease: 'in', trail: true }], [0.55, { f: 1 }], [0.9, {}]],
    contact: 0.45,
    cast: (stage, me) => at(stage, fx.ring(me.cx, me.cy - me.h, { r: 10, color: '#f4f4f4' }), 0.4),
    impact: (stage, me, foe) => {
      at(stage, fx.flash('#73eff7', 0.3), 0.25);
      at(stage, fx.fangs(front(me, foe), foe.cy - 2, { color: '#73eff7', width: 26, gap: 14 }), 0.55);
      at(stage, fx.burst(front(me, foe), foe.cy, { r: 18, color: '#73eff7' }), 0.4, 0.05);
      stage.shake(3, 0.3);
    },
  },

  // Gorilla
  brace: {
    frames: [[0, {}], [0.2, { sx: 1.1, sy: 0.85 }], [0.55, { sx: 1.1, sy: 0.85 }], [0.7, {}]],
    contact: 0.4,
    cast: (stage, me) => at(stage, fx.ring(me.cx, me.cy, { r: 30, color: '#94b0c2' }), 0.5, 0.15),
  },
  knuckle_rush: {
    frames: [[0, {}], [0.15, { f: -0.1, sy: 0.85 }], [0.32, { f: 1, trail: true }], [0.42, { f: 0.85 }], [0.52, { f: 1.05, a: 0.1 }], [0.8, {}]],
    contact: 0.32,
    cast: (stage, me) => at(stage, fx.dust(me.x, me.y, { spread: 26 }), 0.5, 0.15),
    impact: (stage, me, foe) => {
      at(stage, fx.burst(front(me, foe), foe.cy + (Math.random() - 0.5) * 10, { r: 11, rays: 7 }), 0.3);
      stage.shake(1.5, 0.15);
    },
  },
  troop_call: {
    attack: false,
    frames: [[0, {}], [0.15, { up: 4, a: -0.3, sy: 1.08 }], [0.35, {}], [0.5, { up: 4, a: -0.3, sy: 1.08 }], [0.7, {}]],
    contact: 0.55,
    cast: (stage, me) => {
      for (const delay of [0.15, 0.5]) at(stage, fx.ring(me.cx, me.cy - me.h * 0.3, { r: 26, color: '#a7f070' }), 0.45, delay);
      at(stage, fx.rising(me.x, me.y, { color: '#ef7d57', count: 8, spread: 36, height: 26, size: 2 }), 0.8, 0.3);
    },
  },
  boulder_toss: {
    frames: [[0, {}], [0.25, { up: 6, a: -0.2, sy: 1.1 }], [0.4, { f: 0.2, a: 0.2 }], [0.75, {}]],
    contact: 0.6,
    cast: (stage, me, foe) => at(stage, fx.groundWave(me.x + (me.w / 2) * me.dir, foe.x, me.y - 20, { color: '#566c86' }), 0.25, 0.38),
    impact: (stage, me, foe) => {
      at(stage, fx.burst(foe.cx, foe.cy, { r: 18, color: '#94b0c2', rays: 10 }), 0.4);
      at(stage, fx.dust(foe.x, foe.y, { color: '#566c86', spread: 28 }), 0.5);
      stage.shake(3, 0.3);
    },
  },
  jungle_roar: {
    frames: [[0, {}], [0.15, { up: 3, a: -0.15, sx: 1.08 }], [0.65, { up: 3, a: -0.15, sx: 1.08 }], [0.8, {}]],
    contact: 0.55,
    cast: (stage, me, foe) => {
      at(stage, fx.soundWaves(me.cx + (me.w / 2) * me.dir, foe.cx, me.cy - 4, me.dir, { color: '#a7f070', waves: 5 }), 0.7, 0.1);
      stage.shake(2, 0.5, { delay: 0.15 });
    },
  },
  banana_snack: {
    attack: false,
    frames: [[0, {}], [0.15, { a: -0.15 }], [0.3, { a: 0.05, sy: 0.95 }], [0.45, { a: -0.15 }], [0.6, { a: 0.05, sy: 0.95 }], [0.75, {}]],
    contact: 0.5,
    cast: (stage, me) => at(stage, fx.rising(me.cx + me.w * 0.3 * me.dir, me.cy - me.h * 0.2, { color: '#ffcd75', count: 6, spread: 12, height: 16, size: 2 }), 0.7, 0.1),
  },
  hammer_fist: {
    frames: [[0, {}], [0.25, { f: 0.7, up: 20, a: -0.3, sy: 1.1 }], [0.38, { f: 1, up: 0, a: 0.35, ease: 'in' }], [0.55, { f: 1, sy: 0.85 }], [0.85, {}]],
    contact: 0.38,
    impact: (stage, me, foe) => {
      at(stage, fx.burst(foe.cx, foe.cy - foe.h * 0.3, { r: 16, rays: 10 }), 0.4);
      at(stage, fx.ring(foe.x, foe.y - 1, { r: 28, squash: 0.3, color: '#7a4a32' }), 0.45);
      stage.shake(3.5, 0.3);
    },
  },
  iron_hide: {
    attack: false,
    frames: [[0, {}], [0.2, { sx: 1.08, sy: 0.9 }], [0.6, { sx: 1.08, sy: 0.9 }], [0.75, {}]],
    contact: 0.5,
    cast: (stage, me) => {
      at(stage, fx.ring(me.cx, me.cy, { r: 32, color: '#94b0c2' }), 0.5, 0.1);
      at(stage, fx.ring(me.cx, me.cy, { r: 26, color: '#f4f4f4' }), 0.5, 0.3);
      at(stage, fx.rising(me.x, me.y, { color: '#38b764', count: 8, spread: 40, height: 28, size: 2 }), 0.8, 0.3);
    },
  },
  silverback_fury: {
    frames: [
      [0, {}], [0.2, { f: 0.9, trail: true }], [0.3, { f: 1.08, a: 0.1 }], [0.4, { f: 0.9 }], [0.5, { f: 1.08, a: -0.1 }],
      [0.6, { f: 0.9 }], [0.72, { f: 1.1, up: 6, a: 0.2 }], [1.0, {}],
    ],
    contact: 0.3,
    impact: (stage, me, foe) => {
      at(stage, fx.burst(front(me, foe), foe.cy + (Math.random() - 0.5) * 12, { r: 11, rays: 8, color: '#ef7d57' }), 0.25);
      stage.shake(2, 0.15);
    },
  },

  // Grizzly
  bear_hug: {
    frames: [[0, {}], [0.2, { up: 6, sy: 1.12 }], [0.35, { f: 1.1, trail: true }], [0.75, { f: 1.15, sx: 1.08, sy: 0.95 }], [1.0, {}]],
    contact: 0.35,
    impact: (stage, me, foe) => {
      for (const delay of [0, 0.2]) at(stage, fx.squeeze(foe.cx, foe.cy, { color: '#ef7d57' }), 0.45, delay);
      stage.shake(1.5, 0.4);
    },
  },
  crushing_paw: {
    frames: [[0, {}], [0.2, { f: 0.5, up: 16, a: -0.3, sy: 1.1 }], [0.34, { f: 0.95, up: 0, a: 0.3, ease: 'in' }], [0.5, { f: 0.95, sy: 0.9 }], [0.8, {}]],
    contact: 0.34,
    impact: (stage, me, foe) => {
      at(stage, fx.clawMarks(front(me, foe), foe.cy, me.dir, { count: 4, len: 24 }), 0.5);
      at(stage, fx.dust(foe.x, foe.y, { spread: 24 }), 0.45);
      stage.shake(2.5, 0.25);
    },
  },
  honey_break: {
    attack: false,
    frames: [[0, {}], [0.2, { a: -0.25, sy: 1.05 }], [0.6, { a: -0.25, sy: 1.05 }], [0.75, {}]],
    contact: 0.5,
    cast: (stage, me) => {
      at(stage, fx.droplets(me.cx + me.w * 0.3 * me.dir, me.cy - me.h * 0.3, me.dir, { color: '#ffcd75', count: 6 }), 0.7, 0.1);
      at(stage, fx.rising(me.x, me.y, { color: '#38b764', count: 8, spread: 36, height: 28, size: 2 }), 0.8, 0.3);
    },
  },
  salmon_snatch: {
    frames: [[0, {}], [0.15, { up: 6, a: -0.3 }], [0.3, { f: 0.9, a: 0.3, trail: true }], [0.45, { f: 0.9, up: 4, a: -0.2 }], [0.75, {}]],
    contact: 0.3,
    impact: (stage, me, foe) => {
      at(stage, fx.clawMarks(front(me, foe), foe.cy, me.dir, { count: 2, down: false }), 0.45);
      at(stage, fx.droplets(front(me, foe), foe.cy, -me.dir, { color: '#41a6f6', count: 8 }), 0.6);
    },
  },
  rend: {
    frames: [[0, {}], [0.15, { up: 6, a: -0.35 }], [0.3, { f: 0.9, a: 0.3, trail: true }], [0.4, { f: 0.9, a: -0.3 }], [0.5, { f: 0.9, a: 0.3 }], [0.8, {}]],
    contact: 0.3,
    impact: (stage, me, foe) => {
      at(stage, fx.clawMarks(front(me, foe), foe.cy, me.dir, { color: '#b13e53', len: 26 }), 0.5);
      at(stage, fx.clawMarks(front(me, foe), foe.cy, me.dir, { color: '#b13e53', len: 26, down: false }), 0.5, 0.1);
      at(stage, fx.droplets(front(me, foe), foe.cy, me.dir, { count: 10 }), 0.7, 0.1);
    },
  },
  hibernate: {
    attack: false,
    frames: [[0, {}], [0.3, { sx: 1.1, sy: 0.75 }], [0.9, { sx: 1.1, sy: 0.75 }], [1.1, {}]],
    contact: 0.7,
    cast: (stage, me) => {
      at(stage, fx.rising(me.x, me.y, { color: '#73eff7', count: 8, spread: 34, height: 30, size: 2 }), 1, 0.2);
      at(stage, fx.ring(me.cx, me.cy, { r: 28, color: '#29366f' }), 0.6, 0.3);
    },
  },
  rampage: {
    frames: [[0, {}], [0.2, { f: -0.15, sy: 0.85, a: 0.1 }], [0.4, { f: 1.1, a: 0.15, trail: true }], [0.5, { f: 1.05 }], [0.85, {}]],
    contact: 0.4,
    cast: (stage, me) => at(stage, fx.dust(me.x, me.y, { spread: 30, puffs: 8 }), 0.5, 0.2),
    impact: (stage, me, foe) => {
      at(stage, fx.burst(foe.cx, foe.cy, { r: 20, rays: 10, color: '#ef7d57' }), 0.4);
      at(stage, fx.dust(foe.x, foe.y, { spread: 30 }), 0.5);
      stage.shake(4, 0.35);
    },
  },
  frenzied_claws: {
    frames: [[0, {}], [0.15, { f: 0.85, a: 0.25, trail: true }], [0.25, { f: 0.85, a: -0.25 }], [0.35, { f: 0.85, a: 0.25 }], [0.45, { f: 0.85, a: -0.25 }], [0.75, {}]],
    contact: 0.15,
    impact: (stage, me, foe) => at(stage, fx.clawMarks(front(me, foe), foe.cy + (Math.random() - 0.5) * 10, me.dir, { down: Math.random() < 0.5 }), 0.4),
  },
  ursine_wrath: {
    attack: false,
    frames: [[0, {}], [0.25, { up: 8, sy: 1.15, a: -0.2 }], [0.7, { up: 8, sy: 1.15, a: -0.2 }], [0.85, { sy: 0.85 }], [1.0, {}]],
    contact: 0.6,
    cast: (stage, me) => {
      at(stage, fx.rising(me.x, me.y, { color: '#b13e53', count: 14, spread: 44, height: 34, size: 3 }), 0.9, 0.1);
      at(stage, fx.ring(me.cx, me.cy, { r: 34, color: '#ef7d57' }), 0.5, 0.3);
      stage.shake(2.5, 0.4, { delay: 0.85 });
    },
  },

  // Eagle
  gust: {
    frames: [[0, {}], [0.15, { up: 10, sx: 1.1 }], [0.3, { up: 10, f: 0.1, sx: 1.1 }], [0.45, { up: 10, sx: 1.1 }], [0.7, {}]],
    contact: 0.35,
    cast: (stage, me, foe) => at(stage, fx.soundWaves(me.cx + (me.w / 2) * me.dir, foe.cx, me.cy, me.dir, { color: '#f4f4f4', waves: 3 }), 0.5, 0.1),
    impact: (stage, me, foe) => at(stage, fx.dust(foe.x, foe.y, { color: '#f4f4f4', puffs: 6, spread: 30 }), 0.5),
  },
  razor_wind: {
    frames: [[0, {}], [0.15, { up: 10, a: -0.2, sx: 1.1 }], [0.3, { up: 10, a: 0.15, sx: 1.1 }], [0.6, {}]],
    contact: 0.35,
    cast: (stage, me, foe) => at(stage, fx.slashArc((me.cx + foe.cx) / 2, me.cy, me.dir, { r: 20, color: '#73eff7' }), 0.35, 0.15),
    impact: (stage, me, foe) => at(stage, fx.slashArc(front(me, foe), foe.cy, me.dir, { r: 16, color: '#f4f4f4' }), 0.4),
  },
  updraft: {
    attack: false,
    frames: [[0, {}], [0.3, { up: 40, a: -0.2, trail: true }], [0.6, { up: 40 }], [0.85, {}]],
    contact: 0.55,
    cast: (stage, me) => {
      at(stage, fx.rising(me.x, me.y, { color: '#f4f4f4', count: 10, spread: 40, height: 44, size: 2 }), 0.9);
      at(stage, fx.rising(me.x, me.y, { color: '#73eff7', count: 6, spread: 30, height: 30, size: 2 }), 0.7, 0.3);
    },
  },
  tailwind: {
    frames: [[0, {}], [0.3, { f: -0.1, up: 20, a: -0.2, trail: true }], [0.6, { f: 0.1, up: 12, trail: true }], [0.8, {}]],
    contact: 0.5,
    cast: (stage, me) => {
      at(stage, fx.soundWaves(me.x - me.dir * 40, me.x + me.dir * 30, me.cy, me.dir, { color: '#73eff7', waves: 3 }), 0.7);
      at(stage, fx.dust(me.x, me.y, { color: '#f4f4f4', puffs: 5 }), 0.4);
    },
  },
  feather_flurry: {
    frames: [[0, {}], [0.15, { up: 12, a: -0.2, sx: 1.1 }], [0.6, { up: 12, a: -0.1, sx: 1.1 }], [0.8, {}]],
    contact: 0.2,
    impact: (stage, me, foe) => {
      at(stage, fx.slashArc(front(me, foe), foe.cy + (Math.random() - 0.5) * 12, me.dir, { r: 10, color: '#ccaa85', size: 1 }), 0.3);
      at(stage, fx.burst(front(me, foe), foe.cy, { r: 7, rays: 5, color: '#f4f4f4' }), 0.25);
    },
  },
  eagle_eye: {
    frames: [[0, {}], [0.15, { up: 6, a: 0.15 }], [0.6, { up: 6, a: 0.15 }], [0.75, {}]],
    contact: 0.5,
    cast: (stage, me, foe) => {
      at(stage, fx.reticle(foe.cx, foe.cy, { color: '#ffcd75', r: 16 }), 0.9, 0.15);
      at(stage, fx.flash('#ffcd75', 0.15), 0.2, 0.4);
    },
  },
  thermal_glide: {
    attack: false,
    frames: [[0, {}], [0.3, { f: -0.1, up: 30, a: -0.15 }], [0.6, { f: 0.1, up: 34, a: 0.15 }], [0.9, { up: 20 }], [1.1, {}]],
    contact: 0.7,
    cast: (stage, me) => {
      at(stage, fx.rising(me.x, me.y, { color: '#ef7d57', count: 10, spread: 40, height: 40, size: 2 }), 1, 0.1);
      at(stage, fx.rising(me.x, me.y, { color: '#38b764', count: 8, spread: 30, height: 30, size: 2 }), 0.8, 0.5);
    },
  },
  piercing_beak: {
    frames: [[0, {}], [0.2, { f: -0.15, up: 6, a: -0.2 }], [0.32, { f: 1.05, a: 0.1, sx: 1.12, sy: 0.9, trail: true }], [0.45, { f: 1 }], [0.75, {}]],
    contact: 0.32,
    impact: (stage, me, foe) => {
      at(stage, fx.burst(front(me, foe), foe.cy - 4, { r: 12, rays: 4, color: '#f4f4f4' }), 0.35);
      at(stage, fx.slashArc(front(me, foe), foe.cy - 4, me.dir, { r: 6, from: 1.2, to: 1.9 }), 0.35);
    },
  },
  storm_dive: {
    frames: [
      [0, {}], [0.4, { f: -0.25, up: 85, a: -0.5 }], [0.6, { f: -0.25, up: 85 }],
      [0.75, { f: 1, up: 0, a: 0.7, ease: 'in', trail: true }], [0.82, { f: 1, sy: 0.75, a: 0.3 }], [1.1, { f: 1 }], [1.4, {}],
    ],
    contact: 0.75,
    cast: (stage) => {
      at(stage, fx.flash('#29366f', 0.35), 0.5, 0.3);
      at(stage, fx.flash('#f4f4f4', 0.5), 0.15, 0.55);
    },
    impact: (stage, me, foe) => {
      at(stage, fx.flash('#73eff7', 0.4), 0.25);
      at(stage, fx.burst(foe.cx, foe.cy, { r: 24, rays: 12, color: '#73eff7' }), 0.5);
      at(stage, fx.ring(foe.x, foe.y - 1, { r: 36, squash: 0.3, color: '#ffcd75' }), 0.5);
      stage.shake(5, 0.45);
    },
  },

  // ── Station moves (any species) ──
  shoulder_charge: {
    frames: [[0, {}], [0.2, { f: -0.15, sy: 0.85, a: 0.15 }], [0.38, { f: 1.05, a: 0.2, trail: true }], [0.48, { f: 1 }], [0.8, {}]],
    contact: 0.38,
    cast: (stage, me) => at(stage, fx.dust(me.x, me.y, { spread: 26 }), 0.5, 0.2),
    impact: (stage, me, foe) => {
      at(stage, fx.burst(front(me, foe), foe.cy, { r: 16, rays: 8, color: '#94b0c2' }), 0.35);
      stage.shake(2.5, 0.25);
    },
  },
  second_wind: {
    attack: false,
    frames: [[0, {}], [0.25, { up: 3, sy: 1.1 }], [0.6, { up: 3, sy: 1.1 }], [0.75, {}]],
    contact: 0.5,
    cast: (stage, me) => {
      at(stage, fx.ring(me.cx, me.cy, { r: 30, color: '#f4f4f4' }), 0.5, 0.1);
      at(stage, fx.rising(me.x, me.y, { color: '#38b764', count: 12, spread: 40, height: 34, size: 2 }), 0.9, 0.2);
    },
  },
  focus_breath: {
    attack: false,
    frames: [[0, {}], [0.3, { sy: 0.92 }], [0.6, { sy: 1.05 }], [0.9, { sy: 0.92 }], [1.0, {}]],
    contact: 0.6,
    cast: (stage, me) => {
      at(stage, fx.rising(me.x, me.y, { color: '#73eff7', count: 10, spread: 36, height: 32, size: 2 }), 1, 0.1);
      at(stage, fx.ring(me.cx, me.cy, { r: 26, color: '#41a6f6' }), 0.6, 0.4);
    },
  },
  torrent_crash: {
    frames: [[0, {}], [0.3, { f: 0.2, up: 50, a: -0.3 }], [0.48, { f: 1, up: 0, a: 0.3, ease: 'in', trail: true }], [0.6, { f: 1, sy: 0.8 }], [0.95, {}]],
    contact: 0.48,
    impact: (stage, me, foe) => {
      at(stage, fx.droplets(foe.cx, foe.cy - foe.h / 2, me.dir, { color: '#73eff7', count: 14 }), 0.7);
      at(stage, fx.droplets(foe.cx, foe.cy - foe.h / 2, -me.dir, { color: '#41a6f6', count: 10 }), 0.7);
      at(stage, fx.ring(foe.x, foe.y - 1, { r: 32, squash: 0.3, color: '#41a6f6' }), 0.5);
      stage.shake(3.5, 0.35);
    },
  },
  combo_strike: {
    frames: [[0, {}], [0.15, { f: 0.95, trail: true }], [0.25, { f: 0.8 }], [0.35, { f: 1, a: 0.1 }], [0.45, { f: 0.8 }], [0.55, { f: 1.05, a: -0.1 }], [0.8, {}]],
    contact: 0.15,
    impact: (stage, me, foe) => at(stage, fx.burst(front(me, foe), foe.cy + (Math.random() - 0.5) * 12, { r: 9, rays: 6, color: '#d8a066' }), 0.25),
  },
  log_splitter: {
    frames: [[0, {}], [0.3, { f: -0.1, up: 12, a: -0.4, sy: 1.1 }], [0.45, { f: 1, a: 0.35, trail: true }], [0.55, { f: 1, sy: 0.9 }], [0.95, {}]],
    contact: 0.45,
    impact: (stage, me, foe) => {
      at(stage, fx.flash('#ffcd75', 0.25), 0.2);
      at(stage, fx.slashArc(front(me, foe), foe.cy, me.dir, { r: 20, from: -0.3, to: 0.3, size: 3 }), 0.45);
      at(stage, fx.burst(front(me, foe), foe.cy, { r: 20, rays: 10 }), 0.4);
      stage.shake(4, 0.35);
    },
  },
  parry: {
    frames: [[0, {}], [0.15, { f: -0.05, a: -0.15 }], [0.35, { f: 0.9, a: 0.1, trail: true }], [0.45, { f: 0.9 }], [0.7, {}]],
    contact: 0.35,
    cast: (stage, me) => at(stage, fx.ring(me.cx + (me.w / 2) * me.dir, me.cy, { r: 12, squash: 2, color: '#73eff7' }), 0.4),
    impact: (stage, me, foe) => at(stage, fx.burst(front(me, foe), foe.cy, { r: 10, rays: 6 }), 0.3),
  },
  counterpunch: {
    frames: [[0, {}], [0.2, { f: -0.15, a: -0.2, sx: 0.9 }], [0.34, { f: 1.05, a: 0.1, sx: 1.1, trail: true }], [0.44, { f: 1 }], [0.75, {}]],
    contact: 0.34,
    impact: (stage, me, foe, crit) => {
      at(stage, fx.burst(front(me, foe), foe.cy, { r: 18, rays: 10, color: crit ? '#ffcd75' : '#ef7d57' }), 0.4);
      stage.shake(3, 0.3);
    },
  },
  quick_step: {
    frames: [[0, {}], [0.12, { f: 1, trail: true }], [0.2, { f: 1 }], [0.35, { f: -0.15, up: 4, trail: true }], [0.55, {}]],
    contact: 0.12,
    impact: (stage, me, foe) => at(stage, fx.clawMarks(front(me, foe), foe.cy, me.dir, { count: 2, len: 16, color: '#73eff7' }), 0.35),
  },
  blitz: {
    frames: [[0, {}], [0.15, { f: 1.1, trail: true }], [0.3, { f: -0.1, trail: true }], [0.45, { f: 1.1, trail: true }], [0.6, { f: 1 }], [0.85, {}]],
    contact: 0.15,
    cast: (stage, me) => at(stage, fx.dust(me.x, me.y, { color: '#f4f4f4', puffs: 6 }), 0.4),
    impact: (stage, me, foe) => {
      at(stage, fx.burst(front(me, foe), foe.cy, { r: 12, rays: 8, color: '#73eff7' }), 0.3);
      stage.shake(2, 0.15);
    },
  },
  analyze: {
    attack: false,
    frames: [[0, {}], [0.15, { a: 0.12 }], [0.35, { a: -0.05 }], [0.55, { a: 0.12 }], [0.7, {}]],
    contact: 0.5,
    cast: (stage, me, foe) => {
      at(stage, fx.reticle(foe.cx, foe.cy, { color: '#ffcd75', r: 18 }), 0.9, 0.15);
      at(stage, fx.rising(me.cx, me.cy - me.h / 2, { color: '#f4f4f4', count: 5, spread: 16, height: 12, size: 1 }), 0.6, 0.1);
    },
  },
  master_plan: {
    attack: false,
    frames: [[0, {}], [0.2, { up: 4, sy: 1.08 }], [0.6, { up: 4, sy: 1.08 }], [0.75, {}]],
    contact: 0.5,
    cast: (stage, me) => {
      at(stage, fx.ring(me.cx, me.cy, { r: 30, color: '#ef7d57' }), 0.5, 0.1);
      at(stage, fx.ring(me.cx, me.cy, { r: 24, color: '#94b0c2' }), 0.5, 0.3);
      at(stage, fx.flash('#ffcd75', 0.15), 0.2, 0.35);
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
  if (effect === 'expose') at(stage, fx.burst(t.cx, t.cy, { color: '#ef7d57', rays: 6, r: 12, size: 1 }), 0.4);
  if (effect === 'empower') at(stage, fx.rising(t.x, t.y, { color: '#ef7d57', count: 6, spread: 30, height: 22, size: 2 }), 0.6);
  if (effect === 'haste') at(stage, fx.rising(t.x, t.y, { color: '#73eff7', count: 6, spread: 30, height: 22, size: 2 }), 0.6);
  if (effect === 'blind' || effect === 'weaken') at(stage, fx.rising(t.cx, t.cy, { color: '#5d275d', count: 6, spread: 30, height: 18 }), 0.6);
}
