/**
 * Turns a finished training session into stat gains, costs and XP.
 */
import { EXERCISES, TRAINING_RULES as R } from './exercises.js';
import { getSpecies, addXp } from '../pets/pet.js';
import { applyNeedDeltas, isAsleep } from '../pets/needs.js';
import { getMood } from '../pets/mood.js';

export function trainingCap(pet, exerciseId) {
  return EXERCISES[exerciseId].gain * R.sessionsPerLevel * pet.level;
}

export function trainingProgress(pet, exerciseId) {
  const cap = trainingCap(pet, exerciseId);
  const current = pet.trained[EXERCISES[exerciseId].stat] || 0;
  return { current, cap, full: current >= cap - 1e-9 };
}

export const isSpecialty = (pet, exerciseId) => getSpecies(pet).specialty === exerciseId;

/** Checks the pet's condition (not the per-exercise cap). */
export function canTrainNow(pet, now = Date.now()) {
  const n = pet.needs;
  if (isAsleep(pet, now)) return { ok: false, reason: `${pet.name} is asleep.` };
  if (n.health < R.minHealth) return { ok: false, reason: `${pet.name} is sick. Give medicine before training.` };
  if (n.energy < R.minEnergy) return { ok: false, reason: `${pet.name} is too tired to train. Let them sleep.` };
  if (n.hunger < R.minHunger) return { ok: false, reason: `${pet.name} is too hungry to train.` };
  return { ok: true };
}

export function canTrain(pet, exerciseId, now = Date.now()) {
  const condition = canTrainNow(pet, now);
  if (!condition.ok) return condition;
  if (trainingProgress(pet, exerciseId).full) {
    return { ok: false, reason: `Maxed for Lv ${pet.level}. Level up to train further.` };
  }
  return { ok: true };
}

/** qualities: array of 0..1 values, one per rep. */
export function completeTraining(pet, exerciseId, qualities) {
  const ex = EXERCISES[exerciseId];
  const avgQ = qualities.reduce((a, b) => a + b, 0) / Math.max(qualities.length, 1);
  const mood = getMood(pet);
  const specialty = isSpecialty(pet, exerciseId);
  const boosted = Boolean(pet.buffs.trainingBoost);

  const { current, cap } = trainingProgress(pet, exerciseId);
  let gain = ex.gain * avgQ * mood.mult * (specialty ? R.specialtyMult : 1) * (boosted ? R.proteinBoostMult : 1);
  gain = Math.max(0, Math.min(gain, cap - current));
  pet.trained[ex.stat] = current + gain;

  applyNeedDeltas(pet, { ...R.cost, happiness: avgQ >= 0.8 ? 4 : -3 });
  if (boosted) delete pet.buffs.trainingBoost;

  const xp = Math.round(R.baseXp + R.bonusXp * avgQ);
  const levels = addXp(pet, xp);
  return { exerciseId, stat: ex.stat, gain, xp, levels, avgQ, specialty, boosted, moodMult: mood.mult };
}
