/**
 * Training simulator: a timing mini-game.
 * A marker sweeps across a bar; hit inside the target zone for a good rep.
 * Pure logic (no DOM) so the UI can render it however it likes.
 */
import { clamp, rand } from '../core/utils.js';
import { TRAINING_RULES } from './exercises.js';

export const GRADES = {
  perfect: { label: 'PERFECT!', quality: 1 },
  good: { label: 'Good', quality: 0.6 },
  miss: { label: 'Miss...', quality: 0.1 },
};

export const SIM_TUNING = {
  baseSpeed: 0.7, // bar-widths per second
  speedPerRep: 0.25,
  baseZone: 0.24, // good-zone width at neutral mood
  minZone: 0.12,
  maxZone: 0.3,
  perfectRatio: 0.35,
};

export class TrainingSim {
  /** load: the station's mastery tier; each tier speeds the marker up (progressive overload). */
  constructor({ reps = TRAINING_RULES.reps, moodMult = 1, load = 0 } = {}) {
    this.reps = reps;
    this.load = load;
    this.moodMult = moodMult;
    this.results = [];
    this.pos = 0;
    this.dir = 1;
    this.newZone();
  }

  get speed() {
    return (SIM_TUNING.baseSpeed + this.results.length * SIM_TUNING.speedPerRep) * (1 + this.load * TRAINING_RULES.overloadSpeed);
  }

  get done() {
    return this.results.length >= this.reps;
  }

  get qualities() {
    return this.results.map((g) => GRADES[g].quality);
  }

  newZone() {
    const T = SIM_TUNING;
    const good = clamp(T.baseZone * this.moodMult, T.minZone, T.maxZone); // happier pets are easier to train
    const center = rand(good / 2 + 0.05, 1 - good / 2 - 0.05);
    this.zone = { center, good, perfect: good * T.perfectRatio };
  }

  update(dt) {
    if (this.done) return;
    this.pos += this.dir * this.speed * dt;
    if (this.pos >= 1) {
      this.pos = 1;
      this.dir = -1;
    } else if (this.pos <= 0) {
      this.pos = 0;
      this.dir = 1;
    }
  }

  hit() {
    if (this.done) return null;
    const d = Math.abs(this.pos - this.zone.center);
    const grade = d <= this.zone.perfect / 2 ? 'perfect' : d <= this.zone.good / 2 ? 'good' : 'miss';
    this.results.push(grade);
    if (!this.done) this.newZone();
    return grade;
  }
}
