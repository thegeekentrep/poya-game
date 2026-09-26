/**
 * Pet needs — the "real pet" simulation.
 * All needs run 0..100 where higher is better (hunger = how full the pet is).
 */
import { clamp } from '../core/utils.js';

export const NEEDS = {
  hunger: { label: 'Fullness', color: 'var(--c-orange)' },
  energy: { label: 'Energy', color: 'var(--c-yellow)' },
  happiness: { label: 'Happiness', color: 'var(--c-lime)' },
  hygiene: { label: 'Hygiene', color: 'var(--c-sky)' },
  health: { label: 'Health', color: 'var(--c-red)' },
};
export const NEED_ORDER = ['hunger', 'energy', 'happiness', 'hygiene', 'health'];

export const NEED_RATES = {
  hungerPerMin: 1.6,
  happinessPerMin: 0.9,
  hygienePerMin: 0.7,
  energyRegenPerMin: 0.8,
  sleepEnergyPerSec: 2,
  sleepDrainFactor: 0.5, // sleeping pets get hungry/dirty/bored at half speed
  hungryHappinessFactor: 2, // happiness drains twice as fast when fullness < 30
  health: {
    starvingLossPerMin: 3, // fullness < 15
    filthyLossPerMin: 2, // hygiene < 15
    depressedLossPerMin: 1, // happiness < 10
    regenPerMin: 1.5, // when fed and clean
  },
};

export function clampNeeds(pet) {
  for (const key of NEED_ORDER) pet.needs[key] = clamp(pet.needs[key], 0, 100);
}

/** Applies { need: delta } and clamps. */
export function applyNeedDeltas(pet, deltas) {
  for (const [key, delta] of Object.entries(deltas)) {
    if (key in pet.needs) pet.needs[key] += delta;
  }
  clampNeeds(pet);
}

export const isAsleep = (pet, now = Date.now()) => pet.sleepingUntil > now;

/** Advances the simulation by `seconds` ending at `now`. */
export function tickNeeds(pet, seconds, now = Date.now()) {
  const R = NEED_RATES;
  const n = pet.needs;
  const minutes = seconds / 60;
  const windowStart = now - seconds * 1000;
  const sleptSec = Math.max(0, Math.min(pet.sleepingUntil, now) - windowStart) / 1000;
  const drain = 1 - (seconds > 0 ? sleptSec / seconds : 0) * (1 - R.sleepDrainFactor);

  n.hunger -= R.hungerPerMin * minutes * drain;
  n.happiness -= R.happinessPerMin * minutes * drain * (n.hunger < 30 ? R.hungryHappinessFactor : 1);
  n.hygiene -= R.hygienePerMin * minutes * drain;
  n.energy += R.energyRegenPerMin * minutes + R.sleepEnergyPerSec * sleptSec;

  let healthDelta = 0;
  if (n.hunger < 15) healthDelta -= R.health.starvingLossPerMin;
  if (n.hygiene < 15) healthDelta -= R.health.filthyLossPerMin;
  if (n.happiness < 10) healthDelta -= R.health.depressedLossPerMin;
  if (healthDelta === 0 && n.hunger > 40 && n.hygiene > 40) healthDelta = R.health.regenPerMin;
  n.health += healthDelta * minutes;

  clampNeeds(pet);
  if (isAsleep(pet, now) && n.energy >= 100) pet.sleepingUntil = now; // wakes up fully rested
}

/** Catches the pet up on time spent away. Returns a before/after report. */
export function simulateAway(pet, awayMs, { rate, capMinutes }, now = Date.now()) {
  const before = { ...pet.needs };
  let remaining = Math.min(awayMs / 1000, capMinutes * 60) * rate;
  let cursor = now - remaining * 1000;
  while (remaining > 0) {
    const step = Math.min(60, remaining);
    cursor += step * 1000;
    tickNeeds(pet, step, cursor);
    remaining -= step;
  }
  return { awayMs, before, after: { ...pet.needs } };
}
