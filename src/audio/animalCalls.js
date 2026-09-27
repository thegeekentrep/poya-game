/**
 * Each animal's own call, played when you tap it (e.g. on "Get an animal").
 * Pitched from species.voicePitch so they match the animal's grunts and roars.
 */
import { getAudio, tone, noise, voice } from './audio.js';
import { SPECIES } from '../pets/species.js';

const CALLS = {
  // a short snarl that rises into a long "awoooo"
  wolf: (o, p) => {
    voice(o, { pitch: [p * 0.9, p * 1.1, p * 0.8], mouth: 900, dur: 0.22, vol: 0.12, rasp: 36, raspDepth: 0.6 });
    const f = p * 2.2;
    voice(o, { pitch: [f * 0.7, f * 1.25, f * 1.15], mouth: 1300, start: 0.25, dur: 0.55, vol: 0.13, type: 'triangle' });
    voice(o, { pitch: [f * 1.15, f * 1.1, f * 0.7], mouth: 1100, start: 0.78, dur: 0.7, vol: 0.12, type: 'triangle' });
  },
  // chest beats speeding up, then a booming "hoo-hoo"
  gorilla: (o, p) => {
    [0, 0.14, 0.26, 0.36, 0.44].forEach((start, i) => {
      tone(o, { type: 'sine', from: 130, to: 55, start, dur: 0.12, vol: 0.18 + i * 0.02 });
      noise(o, { start, dur: 0.04, vol: 0.06, filter: 400 });
    });
    const f = Math.max(p * 1.4, 130);
    voice(o, { pitch: [f, f * 1.35, f * 1.1], mouth: 650, start: 0.6, dur: 0.22, vol: 0.15 });
    voice(o, { pitch: [f * 1.1, f * 1.5, f * 0.8], mouth: 750, start: 0.86, dur: 0.4, vol: 0.16, rasp: 22, raspDepth: 0.4 });
  },
  // a deep, rolling roar with a huff of breath
  grizzly: (o, p) => {
    const low = Math.max(p * 0.75, 60);
    voice(o, { pitch: [low, low * 1.5, low * 0.85], mouth: 600, dur: 0.95, vol: 0.15, rasp: 30, raspDepth: 0.8 });
    voice(o, { pitch: [low / 2, low * 0.7, low * 0.42], mouth: 260, dur: 0.95, vol: 0.08, type: 'square', rasp: 30 });
    noise(o, { dur: 0.95, vol: 0.07, filter: 800, attack: 0.15 });
    noise(o, { start: 1.0, dur: 0.3, vol: 0.08, filter: 1200, filterTo: 400 }); // huff
  },
  // "skree!" then a longer screech
  eagle: (o, p) => {
    const f = Math.max(p * 3.2, 800);
    voice(o, { pitch: [f, f * 1.2, f * 0.9], mouth: 3400, dur: 0.18, vol: 0.12, rasp: 50, raspDepth: 0.5 });
    voice(o, { pitch: [f * 1.1, f * 1.35, f * 0.75], mouth: 3600, start: 0.25, dur: 0.5, vol: 0.13, rasp: 44, raspDepth: 0.5 });
  },
};

/** Plays the species' call. Returns how long it lasts (seconds). */
export function playAnimalCall(speciesId) {
  const audio = getAudio();
  const call = CALLS[speciesId];
  if (audio && call) call(audio.sfx, SPECIES[speciesId].voicePitch);
  return { wolf: 1.5, gorilla: 1.3, grizzly: 1.3, eagle: 0.8 }[speciesId] ?? 1;
}

export const CALL_SPECIES = Object.keys(CALLS);
