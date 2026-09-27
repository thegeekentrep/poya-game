/**
 * Care actions: the day-to-day pet-owner interactions.
 * `deltas` are need changes, `requires` are minimum need values.
 * `scaled` needs grow with how well the mini-game went (quality 0..1): brushing for
 * groom (ui/components/groomModal.js), the teaser wand for play (playModal.js).
 */
import { applyNeedDeltas, isAsleep } from '../pets/needs.js';

export const CARE_ACTIONS = {
  play: {
    label: 'Play',
    desc: 'Wave the feather toy and let them pounce. Big happiness boost, costs energy.',
    short: 'Feather toy',
    cooldownSec: 20,
    deltas: { happiness: 18, energy: -8, hunger: -4, hygiene: -6 },
    scaled: ['happiness'],
    requires: { energy: 10 },
    message: (pet, q) => (q >= 1 ? `${pet.name} had a blast playing!` : q > 0.4 ? `${pet.name} enjoyed the game.` : `${pet.name} wanted to play a bit longer...`),
    reaction: 'happy',
  },
  groom: {
    label: 'Groom',
    desc: 'Brush out the mud and tangles. Restores hygiene.',
    short: 'Brush the fur',
    cooldownSec: 30,
    deltas: { hygiene: 45, happiness: 3 },
    scaled: ['hygiene', 'happiness'],
    message: (pet, q) => (q >= 1 ? `${pet.name} is squeaky clean.` : `${pet.name} is a bit cleaner.`),
    reaction: 'sparkle',
  },
  sleep: {
    label: 'Sleep',
    desc: 'Nap for 45s, rapidly restoring energy.',
    short: 'Nap 45s',
    cooldownSec: 60,
    sleepSec: 45,
    maxEnergy: 90,
    message: (pet) => `${pet.name} curls up for a nap.`,
    reaction: 'sleep',
  },
};

export const CARE_ORDER = ['play', 'groom', 'sleep'];

// ── Cuddling: tap the pet. Gentle taps are cuddles, a flurry of taps annoys it. ──
export const CUDDLE_RULES = {
  happiness: 6, // per rewarded cuddle
  rewardEverySec: 8, // cuddles in between still get hearts, just no stat gain
  windowSec: 4, // taps counted over this window
  fidgetTaps: 4, // this many taps in the window: a warning
  annoyTaps: 6, // this many: annoyed
  annoyedSec: 6, // ignores cuddles for this long (taps while annoyed restart it)
  annoyedHappiness: -8,
  pesterHappiness: -2, // each further tap while annoyed, at most once a second
};

/** Transient tap state for one screen; not saved. */
export const createCuddleTracker = () => ({ taps: [], annoyedUntil: 0, lastPester: 0 });

/**
 * Handles one tap on the pet. Returns { kind, message?, happiness } where kind is
 * 'cuddle' | 'fidget' | 'annoyed' (just became annoyed) | 'pester' (tapped while annoyed) | 'asleep'.
 */
export function tapPet(pet, tracker, now = Date.now()) {
  const R = CUDDLE_RULES;
  if (isAsleep(pet, now)) return { kind: 'asleep', happiness: 0, message: `${pet.name} is sleeping. Let them rest!` };

  tracker.taps = [...tracker.taps.filter((t) => now - t < R.windowSec * 1000), now];
  const change = (happiness) => {
    if (happiness) applyNeedDeltas(pet, { happiness });
    return happiness;
  };

  if (now < tracker.annoyedUntil) {
    tracker.annoyedUntil = now + R.annoyedSec * 1000;
    const pester = now - tracker.lastPester >= 1000;
    if (pester) tracker.lastPester = now;
    return { kind: 'pester', happiness: change(pester ? R.pesterHappiness : 0) };
  }
  if (tracker.taps.length >= R.annoyTaps) {
    tracker.annoyedUntil = now + R.annoyedSec * 1000;
    tracker.lastPester = now;
    tracker.taps = [];
    return { kind: 'annoyed', happiness: change(R.annoyedHappiness), message: `${pet.name} is annoyed! Give them some space.` };
  }
  if (tracker.taps.length >= R.fidgetTaps) return { kind: 'fidget', happiness: 0, message: `${pet.name} squirms. Easy there...` };

  const rewarded = now >= (pet.cooldowns.cuddle || 0);
  if (rewarded) pet.cooldowns.cuddle = now + R.rewardEverySec * 1000;
  return { kind: 'cuddle', happiness: change(rewarded ? R.happiness : 0), message: rewarded ? `${pet.name} leans into the cuddle.` : null };
}

export function careCooldownLeft(pet, actionId, now = Date.now()) {
  return Math.max(0, Math.ceil(((pet.cooldowns[actionId] || 0) - now) / 1000));
}

/** Whether a care action can start right now: { ok, message? }. */
export function checkCare(pet, actionId, now = Date.now()) {
  const action = CARE_ACTIONS[actionId];
  if (actionId === 'sleep' && isAsleep(pet, now)) return { ok: true }; // waking up
  if (isAsleep(pet, now)) return { ok: false, message: `${pet.name} is sleeping. Let them rest!` };

  const left = careCooldownLeft(pet, actionId, now);
  if (left > 0) return { ok: false, message: `${action.label} is available in ${left}s.` };

  for (const [need, min] of Object.entries(action.requires || {})) {
    if (pet.needs[need] < min) return { ok: false, message: `${pet.name} is too tired to ${action.label.toLowerCase()}.` };
  }
  if (action.maxEnergy != null && pet.needs.energy > action.maxEnergy) {
    return { ok: false, message: `${pet.name} isn't sleepy yet.` };
  }
  return { ok: true };
}

/** Applies a care action. quality (0..1) scales the action's `scaled` needs. */
export function performCare(pet, actionId, now = Date.now(), quality = 1) {
  const action = CARE_ACTIONS[actionId];
  if (actionId === 'sleep' && isAsleep(pet, now)) {
    pet.sleepingUntil = now;
    applyNeedDeltas(pet, { happiness: -5 });
    return { ok: true, message: `You woke ${pet.name} up. They look a bit grumpy.`, reaction: 'angry' };
  }
  const check = checkCare(pet, actionId, now);
  if (!check.ok) return check;

  pet.cooldowns[actionId] = now + action.cooldownSec * 1000;
  if (action.sleepSec) pet.sleepingUntil = now + action.sleepSec * 1000;
  if (action.deltas) {
    const q = Math.max(0, Math.min(1, quality));
    const deltas = Object.fromEntries(
      Object.entries(action.deltas).map(([need, v]) => [need, action.scaled?.includes(need) ? Math.round(v * q) : v]),
    );
    applyNeedDeltas(pet, deltas);
  }
  return { ok: true, message: action.message(pet, quality), reaction: action.reaction };
}
