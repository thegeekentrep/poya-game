/**
 * Classroom (brain training): a quick-fire math quiz. Pure logic, no DOM.
 *
 * Same shape as the other training games (see games.js): results, qualities, done, reps,
 * update(dt), plus answer(i) to pick one of the current question's choices.
 * A right answer within `perfectWithin` seconds is perfect, a slower one good;
 * a wrong answer or running out of time is a miss.
 *
 * `intensity` (difficulty + mastery, see gameIntensity) picks the kind of problem:
 *   0  single-digit + and −
 *   1  two-digit + and −, small times tables
 *   2  times tables to 12, exact division, + and − to 99
 *   3  two-step problems like 7 × 8 − 19
 */
import { randInt, pick, shuffle } from '../core/utils.js';
import { GRADES } from './simulator.js';
import { TRAINING_RULES } from './exercises.js';

const CHOICES = 4;

/** One problem at this tier: { text, answer }. */
export function makeProblem(tier) {
  const t = Math.max(0, Math.min(3, Math.round(tier)));
  if (t === 0) {
    const a = randInt(1, 9);
    const b = randInt(1, 9);
    return pick([
      () => ({ text: `${a} + ${b}`, answer: a + b }),
      () => ({ text: `${Math.max(a, b)} − ${Math.min(a, b)}`, answer: Math.abs(a - b) }),
    ])();
  }
  if (t === 1) {
    const a = randInt(11, 49);
    const b = randInt(2, Math.min(29, a - 2)); // keeps a − b positive
    const x = randInt(2, 5);
    const y = randInt(2, 9);
    return pick([
      () => ({ text: `${a} + ${b}`, answer: a + b }),
      () => ({ text: `${a} − ${b}`, answer: a - b }),
      () => ({ text: `${x} × ${y}`, answer: x * y }),
    ])();
  }
  if (t === 2) {
    const x = randInt(3, 12);
    const y = randInt(3, 12);
    const a = randInt(25, 99);
    const b = randInt(12, a - 5);
    return pick([
      () => ({ text: `${x} × ${y}`, answer: x * y }),
      () => ({ text: `${x * y} ÷ ${x}`, answer: y }),
      () => ({ text: `${a} + ${b}`, answer: a + b }),
      () => ({ text: `${a} − ${b}`, answer: a - b }),
    ])();
  }
  const x = randInt(3, 9);
  const y = randInt(3, 9);
  const c = randInt(4, 20);
  return pick([
    () => ({ text: `${x} × ${y} + ${c}`, answer: x * y + c }),
    () => {
      const d = Math.min(c, x * y - 1); // keeps the answer positive
      return { text: `${x} × ${y} − ${d}`, answer: x * y - d };
    },
    () => ({ text: `(${x} + ${c}) × ${y}`, answer: (x + c) * y }),
  ])();
}

/** The answer plus near-miss wrong answers (off by one, by ten, digits swapped), shuffled. */
export function makeChoices(answer) {
  const options = new Set([answer]);
  const swapped = Number(String(answer).split('').reverse().join(''));
  const near = shuffle([answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10, swapped]);
  for (const n of near) {
    if (options.size >= CHOICES) break;
    if (n >= 0 && Number.isInteger(n)) options.add(n);
  }
  for (let n = answer + 3; options.size < CHOICES; n++) options.add(n);
  return shuffle([...options]);
}

export class MathQuiz {
  constructor({ intensity = 1 } = {}) {
    this.intensity = intensity;
    this.reps = TRAINING_RULES.reps;
    this.results = [];
    this.perQuestion = Math.max(4, 9 - intensity * 1.2); // seconds to answer
    this.perfectWithin = this.perQuestion * 0.5;
    this.last = null; // { grade, answer, picked } for the question just finished
    this.next();
  }

  get done() {
    return this.results.length >= this.reps;
  }

  get qualities() {
    return this.results.map((g) => GRADES[g].quality);
  }

  get timeLeft() {
    return Math.max(0, this.perQuestion - this.elapsed);
  }

  next() {
    // harder problems as the quiz goes on: the last question is a notch tougher
    const tier = this.intensity + (this.results.length === this.reps - 1 ? 0.5 : 0);
    this.question = makeProblem(tier);
    this.choices = makeChoices(this.question.answer);
    this.elapsed = 0;
  }

  finishQuestion(grade, picked) {
    this.last = { grade, answer: this.question.answer, picked };
    this.results.push(grade);
    if (!this.done) this.next();
  }

  /** Picks choice i. Returns the grade, or null when the quiz is over. */
  answer(i) {
    if (this.done || this.choices[i] == null) return null;
    const right = this.choices[i] === this.question.answer;
    const grade = !right ? 'miss' : this.elapsed <= this.perfectWithin ? 'perfect' : 'good';
    this.finishQuestion(grade, this.choices[i]);
    return grade;
  }

  update(dt) {
    if (this.done) return;
    this.elapsed += dt;
    if (this.elapsed >= this.perQuestion) this.finishQuestion('miss', null);
  }
}
