/**
 * Combat sounds that match each move: a swipe whooshes and rakes, a bite
 * snaps, a slam booms, a howl howls. Every move has a cast sound (when it
 * starts) and, for attacks, a hit sound (when the blow lands).
 * Voice sounds use the animal's own pitch (species.voicePitch).
 */
import { getAudio, tone, noise, voice } from './audio.js';

// ── the sound palette ─────────────────────────────────────────────
const SFX = {
  // casts: the wind-up
  whoosh: (o) => noise(o, { dur: 0.16, vol: 0.32, filter: 3500, filterTo: 700, q: 2, type: 'bandpass', attack: 0.03 }),
  heavyWhoosh: (o) => noise(o, { dur: 0.28, vol: 0.36, filter: 1600, filterTo: 300, q: 1.5, type: 'bandpass', attack: 0.06 }),
  dash: (o) => {
    noise(o, { dur: 0.12, vol: 0.26, filter: 5000, filterTo: 1500, q: 2, type: 'bandpass' });
    [0.02, 0.07, 0.12].forEach((start) => noise(o, { start, dur: 0.03, vol: 0.08, filter: 600 })); // quick paws
  },
  charge: (o) => {
    // footsteps speeding up into the hit
    [0, 0.13, 0.24, 0.32, 0.38].forEach((start, i) => tone(o, { type: 'triangle', from: 110, to: 60, start, dur: 0.06, vol: 0.1 + i * 0.02 }));
    noise(o, { start: 0.3, dur: 0.15, vol: 0.1, filter: 1200, filterTo: 400, type: 'bandpass' });
  },
  dive: (o) => tone(o, { type: 'sine', from: 1800, to: 350, dur: 0.55, vol: 0.09 }), // falling whistle
  leap: (o) => {
    tone(o, { type: 'sine', from: 400, to: 900, dur: 0.18, vol: 0.07 });
    tone(o, { type: 'sine', from: 900, to: 300, start: 0.3, dur: 0.22, vol: 0.07 });
  },
  gust: (o) => noise(o, { dur: 0.6, vol: 0.34, filter: 400, filterTo: 2500, q: 1.2, type: 'bandpass', attack: 0.2 }),
  flurry: (o) => [0, 0.08, 0.16, 0.24].forEach((start) => noise(o, { start, dur: 0.07, vol: 0.22, filter: 4500, filterTo: 1500, type: 'bandpass' })),
  vanish: (o) => {
    noise(o, { dur: 0.45, vol: 0.06, filter: 6000, type: 'highpass', attack: 0.05 });
    [1568, 1319, 1047, 784].forEach((f, i) => tone(o, { type: 'triangle', from: f, start: i * 0.07, dur: 0.12, vol: 0.05 }));
  },
  sniff: (o) => [0, 0.12, 0.24].forEach((start) => noise(o, { start, dur: 0.07, vol: 0.2, filter: 2500, filterTo: 5000, type: 'bandpass', attack: 0.02 })),
  ping: (o) => [0, 0.22].forEach((start, i) => tone(o, { type: 'sine', from: 1480, to: 1400, start, dur: 0.25, vol: i ? 0.03 : 0.08 })), // sonar + echo
  powerUp: (o) => [262, 330, 392, 523, 659].forEach((f, i) => tone(o, { type: 'square', from: f, start: i * 0.05, dur: 0.08, vol: 0.05 })),
  guard: (o) => {
    tone(o, { type: 'triangle', from: 220, to: 330, dur: 0.2, vol: 0.12 });
    tone(o, { type: 'square', from: 880, start: 0.12, dur: 0.1, vol: 0.04 }); // metallic ting
  },
  munch: (o) => [0, 0.14, 0.28].forEach((start) => noise(o, { start, dur: 0.06, vol: 0.24, filter: 2000 })),
  breath: (o) => {
    noise(o, { dur: 0.45, vol: 0.16, filter: 900, attack: 0.25 });
    noise(o, { start: 0.5, dur: 0.5, vol: 0.13, filter: 700, filterTo: 300 });
  },
  drums: (o) => [0, 0.2, 0.4].forEach((start) => {
    tone(o, { type: 'sine', from: 120, to: 55, start, dur: 0.16, vol: 0.2 });
    noise(o, { start, dur: 0.05, vol: 0.06, filter: 400 });
  }),
  rumble: (o) => {
    tone(o, { type: 'sawtooth', from: 55, to: 40, dur: 0.6, vol: 0.1 });
    noise(o, { dur: 0.6, vol: 0.14, filter: 250, attack: 0.1 });
  },
  lightning: (o) => {
    noise(o, { dur: 0.4, vol: 0.1, filter: 300, attack: 0.15 }); // gathering storm
    noise(o, { start: 0.42, dur: 0.12, vol: 0.14, filter: 6000, type: 'highpass' }); // crack
  },

  // voices (pitch = the animal's voice)
  roar: (o, p) => {
    const low = Math.max(p * 0.5, 60);
    voice(o, { pitch: [low, low * 1.4, low * 0.9], mouth: 700, dur: 0.6, vol: 0.2, rasp: 32, raspDepth: 0.7 });
    noise(o, { dur: 0.6, vol: 0.06, filter: 900, attack: 0.1 });
  },
  howl: (o, p) => {
    const f = Math.max(p * 1.6, 220);
    voice(o, { pitch: [f * 0.8, f * 1.3, f * 0.9], mouth: 1100, dur: 0.9, vol: 0.13, type: 'triangle' }); // "awoooo"
  },
  screech: (o, p) => {
    const f = Math.max(p * 3, 700);
    voice(o, { pitch: [f, f * 1.25, f * 0.8], mouth: 3200, dur: 0.5, vol: 0.12, rasp: 45, raspDepth: 0.5 });
  },
  hoots: (o, p) => {
    const f = Math.max(p * 1.5, 150);
    [0, 0.18, 0.36].forEach((start, i) => voice(o, { pitch: [f, f * (1.2 + i * 0.15), f], mouth: 600, start, dur: 0.14, vol: 0.13 }));
  },
  snore: (o, p) => {
    const f = Math.max(p * 0.6, 70);
    voice(o, { pitch: [f, f * 1.1, f * 0.9], mouth: 400, dur: 0.5, vol: 0.1, rasp: 18 });
    noise(o, { start: 0.55, dur: 0.35, vol: 0.05, filter: 1500, attack: 0.15 });
  },
  grunt: (o, p) => voice(o, { pitch: [p, p * 1.3, p * 0.8], mouth: 650, dur: 0.18, vol: 0.13 }),

  // hits: the blow landing
  claw: (o) => [0, 0.045, 0.09].forEach((start) => noise(o, { start, dur: 0.06, vol: 0.3, filter: 3500, filterTo: 1800, q: 1.5, type: 'bandpass' })),
  bite: (o) => {
    noise(o, { dur: 0.05, vol: 0.18, filter: 2500 }); // snap
    tone(o, { type: 'square', from: 180, to: 90, dur: 0.06, vol: 0.08 });
    noise(o, { start: 0.07, dur: 0.07, vol: 0.13, filter: 1200 }); // crunch
  },
  punch: (o) => {
    tone(o, { type: 'sine', from: 160, to: 50, dur: 0.14, vol: 0.22 });
    noise(o, { dur: 0.08, vol: 0.12, filter: 700 });
  },
  slam: (o) => {
    tone(o, { type: 'sine', from: 100, to: 30, dur: 0.5, vol: 0.26 });
    noise(o, { dur: 0.45, vol: 0.14, filter: 350, filterTo: 120 });
  },
  crack: (o) => {
    tone(o, { type: 'sine', from: 140, to: 45, dur: 0.2, vol: 0.14 });
    noise(o, { dur: 0.06, vol: 0.1, filter: 5000, type: 'highpass' }); // wood splitting
    noise(o, { start: 0.05, dur: 0.12, vol: 0.1, filter: 2000 });
  },
  peck: (o) => {
    tone(o, { type: 'square', from: 1400, to: 700, dur: 0.04, vol: 0.1 });
    noise(o, { dur: 0.04, vol: 0.1, filter: 4000, type: 'highpass' });
  },
  slice: (o) => noise(o, { dur: 0.12, vol: 0.38, filter: 7000, filterTo: 2500, q: 3, type: 'bandpass' }),
  squeeze: (o) => {
    tone(o, { type: 'sawtooth', from: 90, to: 70, dur: 0.4, vol: 0.1 }); // creak
    noise(o, { start: 0.25, dur: 0.1, vol: 0.2, filter: 1500 });
  },
  splash: (o) => {
    noise(o, { dur: 0.4, vol: 0.3, filter: 1500, filterTo: 400, attack: 0.02 });
    [0.1, 0.18, 0.27].forEach((start) => tone(o, { type: 'sine', from: 700 + Math.random() * 600, to: 1600, start, dur: 0.04, vol: 0.06 }));
  },
  thunder: (o) => {
    noise(o, { dur: 0.08, vol: 0.18, filter: 6000, type: 'highpass' });
    tone(o, { type: 'sine', from: 90, to: 30, dur: 0.7, vol: 0.16 });
    noise(o, { start: 0.05, dur: 0.7, vol: 0.12, filter: 300 });
  },
  windHit: (o) => noise(o, { dur: 0.2, vol: 0.32, filter: 2500, filterTo: 600, type: 'bandpass' }),
};

// ── which sounds each move makes: [cast, hit] (hit only for moves that strike) ──
const W = 'whoosh';
export const MOVE_SOUNDS = {
  // Wolf
  bite: [W, 'bite'], shadow_stalk: ['vanish'], cliff_pounce: ['leap', 'claw'], go_for_the_throat: ['dash', 'bite'],
  howl: ['howl'], crippling_bite: [W, 'bite'], hamstring: ['dash', 'bite'], feral_rush: ['dash', 'bite'],
  scent_mask: ['vanish'], vanishing_strike: ['dash', 'claw'], blood_frenzy: ['grunt', 'bite'], alpha_howl: ['howl'], lunar_fang: ['leap', 'bite'],
  // Gorilla
  pummel: ['heavyWhoosh', 'punch'], ground_slam: ['grunt', 'slam'], chest_beat: ['drums'], grapple: ['grunt', 'squeeze'],
  brace: ['guard', 'punch'], knuckle_rush: ['charge', 'punch'], boulder_toss: ['grunt', 'slam'], jungle_roar: ['roar', 'punch'],
  banana_snack: ['munch'], hammer_fist: ['heavyWhoosh', 'slam'], troop_call: ['hoots'], iron_hide: ['guard'], silverback_fury: ['charge', 'punch'],
  // Grizzly
  swipe: [W, 'claw'], maul: ['heavyWhoosh', 'claw'], track_scent: ['sniff'], endure: ['guard'],
  bear_hug: ['grunt', 'squeeze'], crushing_paw: ['heavyWhoosh', 'slam'], salmon_snatch: [W, 'claw'], rend: [W, 'claw'],
  honey_break: ['munch'], rampage: ['charge', 'slam'], hibernate: ['snore'], frenzied_claws: ['flurry', 'claw'], ursine_wrath: ['roar'],
  // Eagle
  talon_strike: [W, 'claw'], scout: ['ping'], dive_bomb: ['dive', 'slam'], screech: ['screech'],
  gust: ['gust', 'windHit'], razor_wind: ['gust', 'slice'], tailwind: ['gust', 'windHit'], feather_flurry: ['flurry', 'slice'],
  eagle_eye: ['ping', 'peck'], updraft: ['gust'], thermal_glide: ['breath'], piercing_beak: ['dash', 'peck'], storm_dive: ['lightning', 'thunder'],
  // Station moves
  shoulder_charge: ['charge', 'punch'], second_wind: ['breath'], focus_breath: ['breath'], torrent_crash: ['leap', 'splash'],
  combo_strike: ['flurry', 'punch'], log_splitter: ['heavyWhoosh', 'crack'], parry: ['guard', 'punch'], counterpunch: [W, 'punch'],
  quick_step: ['dash', 'claw'], blitz: ['dash', 'punch'], analyze: ['ping'], master_plan: ['powerUp'],
};
const FALLBACK = [W, 'punch'];

function play(name, pitch) {
  const audio = getAudio();
  if (audio && SFX[name]) SFX[name](audio.sfx, pitch);
}

/** When a move starts. pitch: the user's voice (species.voicePitch). */
export function playMoveCast(abilityId, pitch = 160) {
  play((MOVE_SOUNDS[abilityId] ?? FALLBACK)[0], pitch);
}

/** When a move's blow lands; crits add a bright sting on top. Returns false if the move has no hit sound. */
export function playMoveHit(abilityId, { crit = false } = {}) {
  const hit = (MOVE_SOUNDS[abilityId] ?? FALLBACK)[1];
  if (!hit) return false;
  play(hit);
  if (crit) {
    const audio = getAudio();
    if (audio) tone(audio.sfx, { from: 1200, to: 1800, start: 0.04, dur: 0.12, vol: 0.08 });
  }
  return true;
}

export const MOVE_SFX_NAMES = Object.keys(SFX);
export const playMoveSfx = play; // play one palette sound by name (for tests and tools)
