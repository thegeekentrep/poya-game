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

/** A burst of filtered white noise, for impacts, swooshes and hi-hats. */
export function noise(dest, { start = 0, dur = 0.1, vol = 0.18, filter = 1200, type = 'lowpass', at }) {
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
  f.frequency.value = filter;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(gain).connect(dest);
  src.start(t, Math.random() * 0.5, dur + 0.02);
}

export const midiToHz = (n) => 440 * 2 ** ((n - 69) / 12);
