/**
 * Gesture-driven training mini-games (the stations that aren't a timing bar).
 * Pure logic, no DOM: the training modal feeds input in and each scene reads the state.
 *
 * Every training game (these, logChop.js, gloveBlock.js, mathQuiz.js) has the same
 * shape so the modal can treat them alike:
 *   update(dt)        advance the simulation (seconds)
 *   results           grades so far ('perfect' | 'good' | 'miss'), one per checkpoint
 *   qualities         0..1 per grade (see GRADES), for completeTraining
 *   done, reps        finished? / how many grades a session has
 *   time, limit       seconds played and allowed
 *   drag({ dx, dy, x }) pointer moved while held: dx/dy as fractions of the pad width,
 *                     x the pointer's position across the pad (-1 left .. 1 right)
 *   release()         pointer let go
 *   key(code, down)   keyboard fallback
 *
 * `intensity` (see gameIntensity) folds in the chosen difficulty and the station's mastery.
 */
import { clamp, rand } from '../core/utils.js';
import { GRADES } from './simulator.js';
import { TRAINING_RULES, TRAINING_DIFFICULTY } from './exercises.js';

const CHECKPOINTS = TRAINING_RULES.reps;

/** 0 (easy, fresh station) up to about 3 (hard, mastered station). */
export const gameIntensity = (difficulty = 'normal', load = 0) =>
  (TRAINING_DIFFICULTY[difficulty] ?? TRAINING_DIFFICULTY.normal).level + load * 0.5;

class GestureGame {
  constructor(limit) {
    this.limit = limit;
    this.time = 0;
    this.results = [];
  }

  get reps() {
    return CHECKPOINTS;
  }

  get done() {
    return this.results.length >= CHECKPOINTS;
  }

  get qualities() {
    return this.results.map((g) => GRADES[g].quality);
  }

  get timeLeft() {
    return Math.max(0, this.limit - this.time);
  }

  grade(g) {
    if (!this.done) this.results.push(g);
  }

  /** Out of time: every checkpoint not reached is a miss. */
  expire() {
    while (!this.done) this.results.push('miss');
  }

  release() {}
  key() {}
}

/**
 * A race along a track (0 → 1) with checkpoints at each third.
 * A checkpoint reached within its par time is perfect, later is good, never is a miss.
 */
class TrackGame extends GestureGame {
  constructor(limit, par) {
    super(limit);
    this.par = par; // seconds to the finish for a perfect run
    this.pos = 0;
    this.vel = 0;
  }

  checkpoints() {
    while (!this.done && this.pos >= (this.results.length + 1) / CHECKPOINTS - 1e-9) {
      const due = (this.par * (this.results.length + 1)) / CHECKPOINTS;
      this.grade(this.time <= due ? 'perfect' : 'good');
    }
    if (!this.done && this.time >= this.limit) this.expire();
  }
}

/**
 * Boulder Moving: swipe forward (right) to shove the boulder up a gentle slope.
 * Stop pushing and it rolls back.
 */
export class BoulderGame extends TrackGame {
  constructor({ intensity = 1 } = {}) {
    super(15, 8);
    const swipes = 10 + intensity * 3; // long (80% of the pad) swipes to reach the flag, ignoring roll-back
    this.friction = 3;
    this.power = 1 / (0.8 * swipes); // track covered per pad-width swiped
    this.slope = 0.06 + intensity * 0.04; // roll-back pull
    this.pushedAt = -1;
  }

  push(amount) {
    if (this.done || amount <= 0) return;
    this.vel += Math.min(amount, 0.5) * this.power * this.friction;
    this.pushedAt = this.time;
  }

  drag({ dx }) {
    this.push(dx); // only forward swipes move it
  }

  key(code, down) {
    if (down && ['ArrowRight', 'KeyD', 'Space', 'Enter'].includes(code)) this.push(0.3);
  }

  /** True while the pet is actively shoving. */
  get straining() {
    return this.time - this.pushedAt < 0.35;
  }

  update(dt) {
    if (this.done) return;
    this.time += dt;
    this.vel = this.vel * Math.exp(-this.friction * dt) - this.slope * dt;
    this.pos = clamp(this.pos + this.vel * dt, 0, 1);
    if (this.pos === 0 && this.vel < 0) this.vel = 0;
    this.checkpoints();
  }
}

/**
 * Running: keep swiping, any direction, to keep the legs pumping. Speed builds with
 * how much you swipe and bleeds off when you stop.
 */
export class RunningGame extends TrackGame {
  constructor({ intensity = 1 } = {}) {
    super(13, 7);
    const distance = 14 + intensity * 5; // pad-widths of swiping needed to finish
    this.drag_ = 2.5;
    this.accel = 1 / distance; // track covered per pad-width swiped
    this.lastKey = null;
  }

  stride(amount) {
    if (this.done || amount <= 0) return;
    this.vel += Math.min(amount, 0.5) * this.accel * this.drag_;
  }

  drag({ dx, dy }) {
    this.stride(Math.hypot(dx, dy));
  }

  /** Keyboard: alternate Left / Right like pumping legs; repeating one key barely helps. */
  key(code, down) {
    if (!down || !['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(code)) return;
    const side = code === 'ArrowLeft' || code === 'KeyA' ? 'L' : 'R';
    this.stride(side !== this.lastKey ? 0.35 : 0.08);
    this.lastKey = side;
  }

  /** 0 (standing) .. 1 (flat out), for the scene. */
  get pace() {
    return clamp((this.vel * this.par) / 1.4, 0, 1);
  }

  update(dt) {
    if (this.done) return;
    this.time += dt;
    this.vel *= Math.exp(-this.drag_ * dt);
    this.pos = clamp(this.pos + this.vel * dt, 0, 1);
    this.checkpoints();
  }
}

/**
 * Waterfall: the pet balances on a rock while the falls shove it about.
 * `tilt` runs -1 (toppling left) .. 1 (toppling right); reaching either end is a fall.
 * Hold and drag toward a side to push the pet that way (so drag against the lean).
 * The session is split into three equal spells: a fall makes that spell a miss,
 * a steady spell is perfect, a wobbly one good.
 */
export class WaterfallGame extends GestureGame {
  constructor({ intensity = 1 } = {}) {
    super(15);
    this.instability = 1.4 + intensity * 0.5; // how hard a lean wants to keep going
    this.gust = 0.9 + intensity * 0.4; // strength of the water's shoves
    this.strength = 3.2;
    this.tilt = rand(-0.08, 0.08); // never perfectly still
    this.spin = 0;
    this.wind = 0;
    this.windTarget = 0;
    this.nextGust = 0; // the first surge hits straight away
    this.control = 0;
    this.keys = { L: false, R: false };
    this.recoverUntil = 0; // after a fall the pet climbs back up
    this.falls = 0;
    this.spell = { sway: 0, samples: 0, fell: false };
  }

  get spellLength() {
    return this.limit / CHECKPOINTS;
  }

  /** True while the pet is down after a fall. */
  get fallen() {
    return this.time < this.recoverUntil;
  }

  drag({ x }) {
    this.control = clamp(x * 1.4, -1, 1);
  }

  release() {
    this.control = 0;
  }

  key(code, down) {
    if (code === 'ArrowLeft' || code === 'KeyA') this.keys.L = down;
    if (code === 'ArrowRight' || code === 'KeyD') this.keys.R = down;
  }

  update(dt) {
    if (this.done) return;
    this.time += dt;

    // the falls surge from one side, then the other
    if (this.time >= this.nextGust) {
      this.windTarget = rand(-1, 1) * this.gust;
      this.nextGust = this.time + rand(0.8, 1.6);
    }
    this.wind += (this.windTarget - this.wind) * Math.min(1, dt * 3);

    if (this.fallen) {
      this.tilt = 0;
      this.spin = 0;
    } else {
      const input = this.control || (this.keys.R ? 1 : 0) - (this.keys.L ? 1 : 0);
      this.spin += (this.instability * this.tilt + this.wind + input * this.strength) * dt;
      this.spin *= Math.exp(-1.5 * dt);
      this.tilt += this.spin * dt;
      if (Math.abs(this.tilt) >= 1) {
        this.tilt = Math.sign(this.tilt);
        this.falls++;
        this.fellAt = this.time;
        this.fellSide = Math.sign(this.tilt);
        this.spell.fell = true;
        this.recoverUntil = this.time + 1.2;
      }
      this.spell.sway += Math.abs(this.tilt);
      this.spell.samples++;
    }

    if (this.time >= this.spellLength * (this.results.length + 1)) {
      const s = this.spell;
      const sway = s.samples ? s.sway / s.samples : 0;
      this.grade(s.fell ? 'miss' : sway < 0.3 ? 'perfect' : 'good');
      this.spell = { sway: 0, samples: 0, fell: false };
    }
  }
}

export const GESTURE_GAMES = { boulder: BoulderGame, running: RunningGame, waterfall: WaterfallGame };

/** How to play each gesture game, shown under the stage. */
export const GAME_HINTS = {
  boulder: 'Swipe right on the pad (or tap the right arrow key) to shove the boulder to the flag. Stop and it rolls back!',
  running: 'Keep swiping on the pad (or alternate the left and right arrow keys) to sprint to the finish line!',
  waterfall: 'Hold and drag against the lean (or hold the left or right arrow key) to keep your pet from falling!',
};
