/**
 * Retro sound effects, synthesized on the fly (no asset files).
 */
import { getAudio, tone, noise } from './audio.js';

const notes = (out, freqs, step, opts = {}) =>
  freqs.forEach((f, i) => tone(out, { from: f, start: i * step, dur: step * 1.4, ...opts }));

const SOUNDS = {
  // ── Battle ──
  attack: (out) => {
    tone(out, { from: 300, to: 700, dur: 0.08, vol: 0.11 });
    noise(out, { dur: 0.1, vol: 0.07, filter: 3000 });
  },
  hit: (out) => {
    tone(out, { from: 180, to: 60, dur: 0.12, vol: 0.16 });
    noise(out, { dur: 0.12, vol: 0.14, filter: 900 });
  },
  crit: (out) => {
    tone(out, { from: 220, to: 50, dur: 0.2 });
    noise(out, { dur: 0.2, filter: 1600 });
    tone(out, { from: 1200, to: 1800, start: 0.05, dur: 0.12, vol: 0.07 });
  },
  miss: (out) => noise(out, { dur: 0.18, vol: 0.09, filter: 4000 }),
  dot: (out) => tone(out, { type: 'triangle', from: 260, to: 140, dur: 0.14, vol: 0.13 }),
  heal: (out) => notes(out, [523, 659, 784], 0.07, { type: 'triangle', vol: 0.13 }),
  buff: (out) => tone(out, { from: 400, to: 900, dur: 0.15, vol: 0.09 }),
  debuff: (out) => tone(out, { from: 500, to: 200, dur: 0.15, vol: 0.09 }),
  faint: (out) => tone(out, { from: 500, to: 60, dur: 0.6, vol: 0.14 }),
  win: (out) => notes(out, [523, 659, 784, 1047], 0.1),
  lose: (out) => notes(out, [392, 330, 262, 196], 0.14, { type: 'triangle' }),

  // ── Feeding ──
  coin: (out) => notes(out, [988, 1319], 0.06, { vol: 0.1 }),
  eat: (out) => [0, 0.12, 0.24].forEach((start) => noise(out, { start, dur: 0.07, vol: 0.12, filter: 2000 })),
  yum: (out) => {
    SOUNDS.eat(out);
    notes(out, [659, 784, 1047], 0.08, { type: 'triangle', vol: 0.12, start: 0.3 });
  },
  yuck: (out) => {
    SOUNDS.eat(out);
    tone(out, { type: 'sawtooth', from: 220, to: 150, start: 0.3, dur: 0.25, vol: 0.08 });
  },
  medicine: (out) => notes(out, [523, 494, 523, 784], 0.08, { type: 'triangle', vol: 0.12 }),
  error: (out) => notes(out, [196, 165], 0.09, { vol: 0.08 }),

  // ── Training ──
  perfect: (out) => {
    tone(out, { from: 880, dur: 0.06, vol: 0.12 });
    tone(out, { from: 1760, start: 0.06, dur: 0.12, vol: 0.1 });
  },
  good: (out) => tone(out, { from: 660, to: 880, dur: 0.1, vol: 0.12 }),
  bad: (out) => tone(out, { from: 200, to: 110, dur: 0.15, vol: 0.12 }),
  trained: (out) => notes(out, [523, 659, 784, 659, 1047], 0.08, { vol: 0.12 }),
  levelup: (out) => notes(out, [523, 659, 784, 1047, 1319, 1568], 0.07, { vol: 0.13 }),
};

export function playSfx(name) {
  const audio = getAudio();
  if (audio && SOUNDS[name]) SOUNDS[name](audio.sfx);
}
