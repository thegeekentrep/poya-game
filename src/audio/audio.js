/**
 * Shared Web Audio setup for sound effects and music.
 * Browsers only let audio start after a user gesture, so the AudioContext is
 * created on the first tap / key press (see initAudio) and never before.
 */
const PREFS_KEY = 'poya.audio';
const BUS_VOLUME = { sfx: 1, music: 0.5 };

let ctx = null;
let buses = null;
let noiseBuf = null;
const prefs = { sfx: true, music: true, ...readPrefs() };
const unlockListeners = [];

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch {
    return {};
  }
}

export const isEnabled = (bus) => prefs[bus];

export function setEnabled(bus, on) {
  prefs[bus] = on;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable: keep the in-memory setting */
  }
  if (buses) buses[bus].gain.value = on ? BUS_VOLUME[bus] : 0;
}

/** The running context and its buses, or null until the player has interacted. */
export function getAudio() {
  return ctx && ctx.state === 'running' ? { ctx, ...buses } : null;
}

/** Calls fn once audio is available (right away if it already is). */
export function onUnlock(fn) {
  if (getAudio()) fn();
  else unlockListeners.push(fn);
}

function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    buses = {};
    for (const bus of ['sfx', 'music']) {
      buses[bus] = ctx.createGain();
      buses[bus].gain.value = prefs[bus] ? BUS_VOLUME[bus] : 0;
      buses[bus].connect(ctx.destination);
    }
  }
  const flush = () => unlockListeners.splice(0).forEach((fn) => fn());
  if (ctx.state === 'running') flush();
  else if (!document.hidden) ctx.resume().then(flush);
}

export function initAudio() {
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, unlock, { capture: true });
  // Silence everything while the tab is in the background.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else unlock();
  });
}

/** One oscillator note sliding from `from` to `to` Hz. */
export function tone(dest, { type = 'square', from, to = from, start = 0, dur = 0.1, vol = 0.18, at }) {
  const t = at ?? ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/**
 * A voiced syllable: a buzzy oscillator shaped by a low-pass "mouth" filter, with a
 * soft attack. `pitch` is [start, peak, end] Hz over the syllable; `mouth` the filter Hz.
 * `rasp` (Hz) wobbles the volume that fast for a gravelly growl; `raspDepth` 0..1 sets how much.
 */
export function voice(dest, { pitch, mouth = 700, start = 0, dur = 0.15, vol = 0.16, type = 'sawtooth', rasp = 0, raspDepth = 0.7, at }) {
  const t = at ?? ctx.currentTime + start;
  const [p0, p1, p2] = pitch;
  const osc = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(p0, t);
  osc.frequency.linearRampToValueAtTime(p1, t + dur * 0.3);
  osc.frequency.exponentialRampToValueAtTime(p2, t + dur);
  f.type = 'lowpass';
  f.Q.value = 4; // a resonant peak reads as a vowel
  f.frequency.setValueAtTime(mouth * 0.6, t);
  f.frequency.linearRampToValueAtTime(mouth, t + dur * 0.3);
  f.frequency.exponentialRampToValueAtTime(mouth * 0.5, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  gain.gain.setValueAtTime(vol, t + dur * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  let out = osc.connect(f);
  if (rasp) {
    const trem = ctx.createGain();
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    trem.gain.value = 1 - raspDepth / 2;
    depth.gain.value = raspDepth / 2;
    lfo.frequency.value = rasp;
    lfo.connect(depth).connect(trem.gain);
    lfo.start(t);
    lfo.stop(t + dur + 0.02);
    out = out.connect(trem);
  }
  out.connect(gain).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/**
 * A burst of filtered white noise, for impacts, swooshes and hi-hats.
 * `filterTo` sweeps the filter over the burst (whooshes); `q` sharpens it; `attack` fades it in.
 */
export function noise(dest, { start = 0, dur = 0.1, vol = 0.18, filter = 1200, filterTo, q, type = 'lowpass', attack = 0, at }) {
  const t = at ?? ctx.currentTime + start;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = noiseBuf;
  f.type = type;
  f.frequency.setValueAtTime(filter, t);
  if (filterTo) f.frequency.exponentialRampToValueAtTime(filterTo, t + dur);
  if (q) f.Q.value = q;
  if (attack) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  } else gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(gain).connect(dest);
  src.start(t, Math.random() * 0.5, dur + 0.02);
}

export const midiToHz = (n) => 440 * 2 ** ((n - 69) / 12);
