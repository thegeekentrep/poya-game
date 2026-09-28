/**
 * Striking Log: chop a tall log down from the bottom, Timberman style. Pure logic, no DOM.
 *
 * The log is a stack of segments; segment `chopped` is the one at the pet's level.
 * Chop from the left or right: the pet steps to that side and knocks the bottom
 * segment out, and the whole log drops one segment. Some segments have a branch
 * sticking out to one side, and a branch that comes down on the pet's side
 * bonks it: the branch snaps off, but the pet is dazed for a moment.
 * Stepping into a branch that is already level with the pet bonks it too.
 *
 * Same shape as the other training games (see games.js): results, qualities, done, reps, update(dt), plus
 * chop('L' | 'R'). Checkpoints are each third of the log: a clean, quick third
 * is perfect, one bonk (or a slow third) good, more than that a miss.
 */
import { GRADES } from './simulator.js';
import { TRAINING_RULES } from './exercises.js';

export const SIDES = ['L', 'R'];

/**
 * Branches for a log of `count` segments. The first two are bare, and a branch
 * never sits right above one on the other side, so there is always a safe side.
 */
export function makeBranches(count, density = 0.5, random = Math.random) {
  const rows = [null, null];
  while (rows.length < count) {
    const below = rows.at(-1);
    if (random() >= density) rows.push(null);
    else rows.push(below ?? (random() < 0.5 ? 'L' : 'R')); // switching sides needs a bare segment in between
  }
  return rows.slice(0, count);
}

export class LogChopGame {
  constructor({ intensity = 1 } = {}) {
    this.reps = TRAINING_RULES.reps;
    this.total = Math.round(30 + intensity * 10); // segments to chop
    this.branches = makeBranches(this.total, Math.min(0.7, 0.4 + intensity * 0.1));
    this.par = this.total * Math.max(0.35, 0.6 - intensity * 0.07); // seconds for a perfect run
    this.limit = Math.round(this.par * 1.6 + 6);
    this.stunTime = 0.6;
    this.side = 'L';
    this.chopped = 0;
    this.bonks = 0;
    this.thirdBonks = 0;
    this.time = 0;
    this.stunnedUntil = 0;
    this.results = [];
  }

  get done() {
    return this.results.length >= this.reps;
  }

  get qualities() {
    return this.results.map((g) => GRADES[g].quality);
  }

  get timeLeft() {
    return Math.max(0, this.limit - this.time);
  }

  get stunned() {
    return this.time < this.stunnedUntil;
  }

  get progress() {
    return this.chopped / this.total;
  }

  /** The branch at segment i ('L', 'R' or null); past the top there is nothing. */
  branchAt(i) {
    return this.branches[i] ?? null;
  }

  /** A side that is safe to chop from right now (there always is one). */
  safeSide() {
    return SIDES.find((s) => this.branchAt(this.chopped) !== s && this.branchAt(this.chopped + 1) !== s);
  }

  bonk(row) {
    this.branches[row] = null; // it snaps off on the pet's head
    this.bonks++;
    this.thirdBonks++;
    this.lastBonk = { side: this.side, time: this.time };
    this.stunnedUntil = this.time + this.stunTime;
  }

  /** Chops from `side`. Returns 'chop', 'bonk', or null when it can't (dazed or finished). */
  chop(side) {
    if (this.done || this.stunned || !SIDES.includes(side)) return null;
    this.side = side;
    if (this.branchAt(this.chopped) === side) {
      this.bonk(this.chopped); // walked into it
      return 'bonk';
    }
    this.chopped++;
    this.lastChop = { side, time: this.time, row: this.chopped - 1 };
    const falling = this.branchAt(this.chopped) === side;
    if (falling) this.bonk(this.chopped);
    this.checkpoints();
    return falling ? 'bonk' : 'chop';
  }

  checkpoints() {
    while (!this.done && this.chopped >= Math.ceil((this.total * (this.results.length + 1)) / this.reps)) {
      const due = (this.par * (this.results.length + 1)) / this.reps;
      const bonks = this.thirdBonks;
      this.thirdBonks = 0;
      this.results.push(bonks === 0 && this.time <= due ? 'perfect' : bonks <= 1 ? 'good' : 'miss');
    }
  }

  key(code, down) {
    if (!down) return;
    if (code === 'ArrowLeft' || code === 'KeyA') this.chop('L');
    if (code === 'ArrowRight' || code === 'KeyD') this.chop('R');
  }

  update(dt) {
    if (this.done) return;
    this.time += dt;
    if (this.time >= this.limit) while (!this.done) this.results.push('miss');
  }
}
