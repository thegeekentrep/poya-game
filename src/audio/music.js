/**
 * Looping chiptune background music, played by a small step sequencer.
 * Tracks are written as MIDI note numbers, one entry per step; `_` is a rest.
 * A note holds until the next note in its line (up to 4 steps).
 */
import { getAudio, onUnlock, tone, noise, midiToHz } from './audio.js';

const _ = null;
const LOOKAHEAD = 0.15; // seconds of music scheduled ahead of time

const TRACKS = {
  // Relaxed camp theme: C, Am, F, G.
  camp: {
    bpm: 96,
    melody: [
      76, _, 79, _, 81, 79, 76, _,   72, _, 74, 76, _, _, _, _,
      69, _, 72, _, 74, 72, 69, _,   67, _, 69, 72, 74, _, _, _,
      76, _, 79, _, 81, _, 84, _,    81, 79, 76, _, 74, _, _, _,
      72, _, 74, _, 76, _, 79, _,    74, _, _, _, 72, _, _, _,
    ],
    bass: [
      48, _, _, _, 55, _, _, _,   45, _, _, _, 52, _, _, _,
      41, _, _, _, 48, _, _, _,   43, _, _, _, 50, _, _, _,
    ],
    melodyVoice: { type: 'triangle', vol: 0.09 },
    bassVoice: { type: 'square', vol: 0.035 },
  },
  // Driving arena theme: Am, F, G, E.
  battle: {
    bpm: 150,
    melody: [
      69, _, 72, 76, _, 74, 72, _,   69, _, 72, 77, _, 76, 72, _,
      71, _, 74, 79, _, 77, 74, _,   76, _, 80, 83, _, _, 76, _,
    ],
    bass: [
      45, 57, 45, 57, 45, 57, 45, 57,   41, 53, 41, 53, 41, 53, 41, 53,
      43, 55, 43, 55, 43, 55, 43, 55,   40, 52, 40, 52, 40, 52, 40, 52,
    ],
    melodyVoice: { type: 'square', vol: 0.05 },
    bassVoice: { type: 'triangle', vol: 0.12 },
    drums: true,
  },
};

let current = null; // track id the game wants playing
let timer = 0;
let step = 0;
let nextTime = 0;

function holdSteps(line, i) {
  let n = 1;
  while (n < 4 && line[(i + n) % line.length] === null) n++;
  return n;
}

function playStep(track, i, t, stepDur, out) {
  for (const [line, voice] of [[track.melody, track.melodyVoice], [track.bass, track.bassVoice]]) {
    const note = line[i % line.length];
    if (note !== null) tone(out, { ...voice, from: midiToHz(note), at: t, dur: holdSteps(line, i % line.length) * stepDur * 0.9 });
  }
  if (track.drums) {
    if (i % 4 === 0) tone(out, { type: 'sine', from: 150, to: 40, at: t, dur: 0.12, vol: 0.2 });
    if (i % 2 === 1) noise(out, { at: t, dur: 0.04, vol: 0.04, filter: 7000, type: 'highpass' });
    if (i % 8 === 4) noise(out, { at: t, dur: 0.1, vol: 0.08, filter: 1800 });
  }
}

function schedule() {
  const audio = getAudio();
  const track = TRACKS[current];
  if (!audio || !track) return;
  const stepDur = 60 / track.bpm / 2; // eighth notes
  const length = Math.max(track.melody.length, track.bass.length);
  // After a long pause (e.g. a throttled timer), skip ahead rather than cram notes in.
  if (nextTime < audio.ctx.currentTime) nextTime = audio.ctx.currentTime + 0.05;
  while (nextTime < audio.ctx.currentTime + LOOKAHEAD) {
    playStep(track, step, nextTime, stepDur, audio.music);
    step = (step + 1) % length;
    nextTime += stepDur;
  }
}

/** Switches the background track ('camp', 'battle'), or stops it with null. */
export function setTrack(id) {
  if (id === current) return;
  current = id;
  clearInterval(timer);
  timer = 0;
  step = 0;
  nextTime = 0;
  if (!id) return;
  onUnlock(() => {
    if (current !== id || timer) return;
    schedule();
    timer = setInterval(schedule, 40);
  });
}
