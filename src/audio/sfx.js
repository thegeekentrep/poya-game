/**
 * Retro sound effects, synthesized on the fly (no asset files).
 */
import { getAudio, tone, noise, voice } from './audio.js';

const notes = (out, freqs, step, opts = {}) =>
  freqs.forEach((f, i) => tone(out, { from: f, start: i * step, dur: step * 1.4, ...opts }));

const SOUNDS = {
  // ── Battle ──
  // (each move's own cast and hit sounds live in moveSounds.js; hit / crit are the fallback)
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
  cuddle: (out) => notes(out, [784, 988], 0.07, { type: 'triangle', vol: 0.08 }),
  // "hn-HMPH": a short lead-in grunt, then a longer one that rises and falls, then a huff of breath.
  // pitch: the animal's voice (Hz); irritation 0..1 makes it louder, higher and sharper.
  grunt: (out, { pitch = 160, irritation = 0 } = {}) => {
    const p = pitch * (1 + irritation * 0.15) * (0.94 + Math.random() * 0.12); // never quite the same twice
    const mouth = 520 + irritation * 260;
    voice(out, { pitch: [p * 0.95, p, p * 0.9], mouth, dur: 0.08, vol: 0.1 + irritation * 0.03 });
    voice(out, { pitch: [p * 1.05, p * 1.25, p * 0.75], mouth: mouth * 1.2, start: 0.11, dur: 0.2, vol: 0.14 + irritation * 0.04 });
    noise(out, { start: 0.28, dur: 0.1, vol: 0.05, filter: 1400 });
  },
  // An annoyed pet: a low, gravelly rumble that swells, then (unless `short`) a sharp snarl.
  growl: (out, { pitch = 160, short = false } = {}) => {
    const p = pitch * (0.95 + Math.random() * 0.1);
    const low = Math.max(p * 0.45, 60); // floor keeps big animals audible on phone speakers
    const rumble = short ? 0.35 : 0.55;
    voice(out, { pitch: [low, low * 1.2, low * 0.92], mouth: 380, dur: rumble, vol: 0.2, rasp: 26, raspDepth: 0.85 });
    voice(out, { pitch: [low / 2, low * 0.6, low * 0.46], mouth: 260, dur: rumble, vol: 0.14, type: 'square', rasp: 26 }); // chest
    noise(out, { dur: rumble, vol: 0.05, filter: 500 }); // breath through bared teeth
    if (short) return;
    voice(out, { pitch: [p * 0.8, p * 1.35, p * 0.55], mouth: 1500, start: rumble - 0.06, dur: 0.3, vol: 0.22, rasp: 38, raspDepth: 0.6 });
    noise(out, { start: rumble - 0.05, dur: 0.18, vol: 0.09, filter: 2400, type: 'bandpass' });
  },
  brush: (out) => noise(out, { dur: 0.16, vol: 0.06, filter: 3500, type: 'bandpass' }),
  pop: (out) => {
    tone(out, { type: 'sine', from: 700, to: 1600, dur: 0.07, vol: 0.16 });
    [0.05, 0.1, 0.16].forEach((start) => tone(out, { type: 'sine', from: 900 + Math.random() * 900, to: 2000, start, dur: 0.04, vol: 0.09 }));
  },
  // lathering fizz: a few tiny random-pitched bubble pops over a soft hiss
  bubbles: (out) => {
    noise(out, { dur: 0.16, vol: 0.035, filter: 5000, type: 'highpass' });
    for (let i = 0; i < 3; i++) {
      const from = 800 + Math.random() * 1400;
      tone(out, { type: 'sine', from, to: from * 1.6, start: Math.random() * 0.14, dur: 0.035, vol: 0.07 });
    }
  },
  pounce: (out) => noise(out, { dur: 0.22, vol: 0.08, filter: 1800, type: 'bandpass' }),
  catch: (out) => notes(out, [784, 1047, 1319], 0.06, { vol: 0.11 }),
  // mystery opponent: a drumroll that speeds up, then a dramatic sting on the reveal
  drumroll: (out) => {
    let t = 0;
    for (let gap = 0.12; t < 1.3; gap = Math.max(0.035, gap * 0.9)) {
      noise(out, { start: t, dur: 0.05, vol: 0.05 + t * 0.06, filter: 900 });
      t += gap;
    }
  },
  reveal: (out) => {
    tone(out, { type: 'triangle', from: 110, to: 45, dur: 0.5, vol: 0.2 }); // boom
    noise(out, { dur: 0.35, vol: 0.12, filter: 3000 });
    [220, 262, 330, 440].forEach((f) => tone(out, { type: 'square', from: f, start: 0.05, dur: 0.45, vol: 0.05 }));
  },
  chomp: (out) => noise(out, { dur: 0.06, vol: 0.12, filter: 2000 }),
  delight: (out) => notes(out, [659, 784, 1047], 0.08, { type: 'triangle', vol: 0.12 }),
  content: (out) => notes(out, [523, 659], 0.08, { type: 'triangle', vol: 0.1 }),
  grimace: (out) => tone(out, { type: 'sawtooth', from: 220, to: 150, dur: 0.25, vol: 0.08 }),
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

/** opts go to sounds that take them, e.g. playSfx('grunt', { pitch, irritation }). */
export function playSfx(name, opts) {
  const audio = getAudio();
  if (audio && SOUNDS[name]) SOUNDS[name](audio.sfx, opts);
}
