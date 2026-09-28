/**
 * Punch Glove: spring-loaded gloves punch at the pet from machines on the left and
 * right, and the pet blocks them. Pure logic, no DOM.
 *
 * Each punch winds up (the machine flashes on its side), then shoots out and lands
 * at `hitAt`. Raising the guard on that side (block('L' | 'R')) holds it up for
 * GUARD.active seconds; a punch that lands on a raised guard is blocked, and one
 * blocked within GUARD.parry seconds of raising it is a parry. A punch on the
 * other side, or with no guard up, hits. After each block the guard needs
 * GUARD.recover more seconds before it can go up again, so mashing doesn't work.
 *
 * Same shape as the other training games (see games.js): results, qualities, done, reps, update(dt).
 * Checkpoints are each third of the punches: no hits and mostly parries is
 * perfect, at most one hit good, more a miss.
 */
import { GRADES } from './simulator.js';
import { TRAINING_RULES } from './exercises.js';

export const GUARD = { active: 0.35, parry: 0.15, recover: 0.15 };
export const PUNCH_TRAVEL = 0.18; // seconds from launch to impact

/** Timings for `count` punches from random sides, starting at `start` seconds. */
export function makePunches(count, { windup, gap, start = 0.8, random = Math.random }) {
  const punches = [];
  let at = start;
  for (let i = 0; i < count; i++) {
    const side = random() < 0.5 ? 'L' : 'R';
    const hitAt = at + windup + PUNCH_TRAVEL;
    punches.push({ side, windupAt: at, launchAt: at + windup, hitAt, outcome: null });
    at = hitAt + gap + random() * 0.4;
  }
  return punches;
}

export class GloveGame {
  constructor({ intensity = 1 } = {}) {
    this.reps = TRAINING_RULES.reps;
    this.total = Math.round(12 + intensity * 4);
    this.windup = Math.max(0.4, 1 - intensity * 0.16); // warning time before each punch
    this.punches = makePunches(this.total, { windup: this.windup, gap: Math.max(0.3, 0.8 - intensity * 0.15) });
    this.time = 0;
    this.guard = null; // { side, at, until }
    this.guardReadyAt = 0;
    this.resolved = 0;
    this.hits = 0;
    this.third = { hits: 0, parries: 0, count: 0 };
    this.results = [];
    this.last = null; // { outcome, side, time } of the latest punch
  }

  get done() {
    return this.results.length >= this.reps;
  }

  get qualities() {
    return this.results.map((g) => GRADES[g].quality);
  }

  get progress() {
    return this.resolved / this.total;
  }

  /** The punch coming next (winding up or in flight), if any. */
  get incoming() {
    return this.punches[this.resolved] ?? null;
  }

  guardUp(side) {
    const g = this.guard;
    return Boolean(g && g.side === side && this.time <= g.until);
  }

  /** Raises the guard on `side`. Returns false if the pet is still recovering. */
  block(side) {
    if (this.done || this.time < this.guardReadyAt || (side !== 'L' && side !== 'R')) return false;
    this.guard = { side, at: this.time, until: this.time + GUARD.active };
    this.guardReadyAt = this.guard.until + GUARD.recover;
    return true;
  }

  key(code, down) {
    if (!down) return;
    if (code === 'ArrowLeft' || code === 'KeyA') this.block('L');
    if (code === 'ArrowRight' || code === 'KeyD') this.block('R');
  }

  resolve(punch) {
    const g = this.guard;
    const blocked = g && g.side === punch.side && g.at <= punch.hitAt && punch.hitAt <= g.until;
    punch.outcome = !blocked ? 'hit' : punch.hitAt - g.at <= GUARD.parry ? 'parry' : 'block';
    this.last = { outcome: punch.outcome, side: punch.side, time: this.time };
    this.resolved++;
    if (punch.outcome === 'hit') {
      this.hits++;
      this.third.hits++;
    }
    if (punch.outcome === 'parry') this.third.parries++;
    this.third.count++;
    if (this.resolved >= Math.ceil((this.total * (this.results.length + 1)) / this.reps)) {
      const { hits, parries, count } = this.third;
      this.results.push(hits === 0 && parries >= count / 2 ? 'perfect' : hits <= 1 ? 'good' : 'miss');
      this.third = { hits: 0, parries: 0, count: 0 };
    }
  }

  update(dt) {
    if (this.done) return;
    this.time += dt;
    while (!this.done && this.incoming && this.incoming.hitAt <= this.time) this.resolve(this.incoming);
  }
}

/** The latest punch on `side` that has started winding up by `time`. */
export function punchOn(punches, side, time) {
  let found = null;
  for (const p of punches) {
    if (p.windupAt > time) break;
    if (p.side === side) found = p;
  }
  return found;
}

/** Where a punch is at `time`: windup 0..1 while charging, reach 0..1 as it shoots out and pulls back. */
export function punchPose(punch, time) {
  if (!punch || time < punch.windupAt) return { windup: 0, reach: 0 };
  if (time < punch.launchAt) return { windup: (time - punch.windupAt) / (punch.launchAt - punch.windupAt), reach: 0 };
  if (time < punch.hitAt) return { windup: 1, reach: (time - punch.launchAt) / PUNCH_TRAVEL };
  // after impact: a blocked glove bounces straight back, a landed one lingers first
  const after = time - punch.hitAt;
  const hold = punch.outcome === 'hit' ? 0.2 : 0;
  const back = Math.max(0, (after - hold) / 0.25);
  return { windup: 0, reach: Math.max(0, 1 - back) * (punch.outcome === 'hit' ? 1 : 0.85) };
}
