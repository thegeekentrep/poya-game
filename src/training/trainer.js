/**
 * Turns a finished training session into stat gains, costs, XP and coins.
 */
import { EXERCISES, STAT_GAIN, TRAINING_RULES as R, TRAINING_DIFFICULTY } from './exercises.js';
import { getSpecies, addXp, movesLearnedSince, setEquipped } from '../pets/pet.js';
import { applyNeedDeltas, isAsleep } from '../pets/needs.js';
import { getMood } from '../pets/mood.js';

export function statCap(pet, stat) {
  return STAT_GAIN[stat] * R.sessionsPerLevel * pet.level;
}

export function statProgress(pet, stat) {
  const cap = statCap(pet, stat);
  const current = pet.trained[stat] || 0;
  return { current, cap, full: current >= cap - 1e-9 };
}

/** Progress of the station's primary stat. */
export const trainingProgress = (pet, exerciseId) => statProgress(pet, EXERCISES[exerciseId].primary);

/** Share of the training energy cost that Stamina saves (0..maxStaminaSaving). */
export const staminaSaving = (pet) => Math.min((pet.trained.sta || 0) * R.staminaSavingPerPoint, R.maxStaminaSaving);

export function trainingCost(pet) {
  return { ...R.cost, energy: Math.round(R.cost.energy * (1 - staminaSaving(pet))) };
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
  const ex = EXERCISES[exerciseId];
  if (statProgress(pet, ex.primary).full && statProgress(pet, ex.secondary).full) {
    return { ok: false, reason: `Maxed for Lv ${pet.level}. Level up to train further.` };
  }
  return { ok: true };
}

// ── Mastery (progressive overload) ─────────────────────────────────

/** Mastery at a station: points, tiers reached and the next threshold (null when maxed). */
export function mastery(pet, exerciseId) {
  const points = pet.mastery?.[exerciseId] || 0;
  const tier = R.masteryTiers.filter((t) => points >= t).length;
  return { points, tier, next: R.masteryTiers[tier] ?? null, prev: R.masteryTiers[tier - 1] ?? 0 };
}

/** Station moves the pet has earned but not learned yet. */
export function offeredMoves(pet, exerciseId) {
  const { tier } = mastery(pet, exerciseId);
  return EXERCISES[exerciseId].moves.slice(0, tier).filter((id) => !pet.trainingMoves.includes(id));
}

/** The next station move still to earn, if any. */
export const nextStationMove = (pet, exerciseId) => EXERCISES[exerciseId].moves[mastery(pet, exerciseId).tier] ?? null;

/** Learns an offered station move (equipping it if there's a free slot). Returns false if not offered. */
export function learnTrainingMove(pet, exerciseId, moveId) {
  if (!offeredMoves(pet, exerciseId).includes(moveId)) return false;
  pet.trainingMoves.push(moveId);
  setEquipped(pet, moveId, true);
  return true;
}

/** qualities: array of 0..1 values, one per rep. difficulty: a TRAINING_DIFFICULTY key. */
export function completeTraining(pet, exerciseId, qualities, { difficulty = 'normal' } = {}) {
  const ex = EXERCISES[exerciseId];
  const reward = (TRAINING_DIFFICULTY[difficulty] ?? TRAINING_DIFFICULTY.normal).reward;
  const avgQ = qualities.reduce((a, b) => a + b, 0) / Math.max(qualities.length, 1);
  const mood = getMood(pet);
  const specialty = isSpecialty(pet, exerciseId);
  const boosted = Boolean(pet.buffs.trainingBoost);

  const mult = avgQ * reward * mood.mult * (specialty ? R.specialtyMult : 1) * (boosted ? R.proteinBoostMult : 1);
  const raise = (stat, ratio) => {
    const { current, cap } = statProgress(pet, stat);
    const gain = Math.max(0, Math.min(STAT_GAIN[stat] * ratio * mult, cap - current));
    pet.trained[stat] = current + gain;
    return { stat, gain };
  };
  const cost = trainingCost(pet); // before this session's Stamina gain
  const gains = [raise(ex.primary, 1), raise(ex.secondary, R.secondaryRatio)];

  applyNeedDeltas(pet, { ...cost, happiness: avgQ >= 0.8 ? 4 : -3 });
  if (boosted) delete pet.buffs.trainingBoost;

  // good and perfect reps build mastery; crossing a tier offers a new move
  const before = mastery(pet, exerciseId).tier;
  pet.mastery[exerciseId] = mastery(pet, exerciseId).points + qualities.filter((q) => q >= 0.6).reduce((a, b) => a + b, 0) * reward;
  const breakthroughs = ex.moves.slice(before, mastery(pet, exerciseId).tier);

  const xp = Math.round((R.baseXp + R.bonusXp * avgQ) * reward);
  const coins = Math.round((R.baseCoins + R.bonusCoins * avgQ) * reward); // the caller pays these out
  const levels = addXp(pet, xp);
  const learned = movesLearnedSince(pet, pet.level - levels);
  return { exerciseId, gains, xp, coins, levels, learned, breakthroughs, avgQ, specialty, boosted, moodMult: mood.mult, difficulty, reward };
}
