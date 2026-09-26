/**
 * Care actions: the day-to-day pet-owner interactions.
 * `deltas` are need changes, `requires` are minimum need values.
 */
import { applyNeedDeltas, isAsleep } from '../pets/needs.js';

export const CARE_ACTIONS = {
  play: {
    label: 'Play',
    desc: 'Chase and wrestle. Big happiness boost, costs energy.',
    cooldownSec: 20,
    deltas: { happiness: 18, energy: -8, hunger: -4, hygiene: -6 },
    requires: { energy: 10 },
    message: (pet) => `${pet.name} had a blast playing!`,
    reaction: 'happy',
  },
  groom: {
    label: 'Groom',
    desc: 'Brush and bathe. Restores hygiene.',
    cooldownSec: 30,
    deltas: { hygiene: 45, happiness: 3 },
    message: (pet) => `${pet.name} is squeaky clean.`,
    reaction: 'sparkle',
  },
  cuddle: {
    label: 'Cuddle',
    desc: 'A little affection goes a long way.',
    cooldownSec: 8,
    deltas: { happiness: 6 },
    message: (pet) => `${pet.name} leans into the cuddle.`,
    reaction: 'love',
  },
  sleep: {
    label: 'Sleep',
    desc: 'Nap for 45s, rapidly restoring energy.',
    cooldownSec: 60,
    sleepSec: 45,
    maxEnergy: 90,
    message: (pet) => `${pet.name} curls up for a nap.`,
    reaction: 'sleep',
  },
};

export const CARE_ORDER = ['cuddle', 'play', 'groom', 'sleep'];

export function careCooldownLeft(pet, actionId, now = Date.now()) {
  return Math.max(0, Math.ceil(((pet.cooldowns[actionId] || 0) - now) / 1000));
}

export function performCare(pet, actionId, now = Date.now()) {
  const action = CARE_ACTIONS[actionId];

  if (actionId === 'sleep' && isAsleep(pet, now)) {
    pet.sleepingUntil = now;
    applyNeedDeltas(pet, { happiness: -5 });
    return { ok: true, message: `You woke ${pet.name} up. They look a bit grumpy.`, reaction: 'angry' };
  }
  if (isAsleep(pet, now)) return { ok: false, message: `${pet.name} is sleeping. Let them rest!` };

  const left = careCooldownLeft(pet, actionId, now);
  if (left > 0) return { ok: false, message: `${action.label} is available in ${left}s.` };

  for (const [need, min] of Object.entries(action.requires || {})) {
    if (pet.needs[need] < min) return { ok: false, message: `${pet.name} is too tired to ${action.label.toLowerCase()}.` };
  }
  if (action.maxEnergy != null && pet.needs.energy > action.maxEnergy) {
    return { ok: false, message: `${pet.name} isn't sleepy yet.` };
  }

  pet.cooldowns[actionId] = now + action.cooldownSec * 1000;
  if (action.sleepSec) pet.sleepingUntil = now + action.sleepSec * 1000;
  if (action.deltas) applyNeedDeltas(pet, action.deltas);
  return { ok: true, message: action.message(pet), reaction: action.reaction };
}
