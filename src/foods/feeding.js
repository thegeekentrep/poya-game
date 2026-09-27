/**
 * Shop + feeding rules.
 */
import { FOODS } from './foods.js';
import { getSpecies } from '../pets/pet.js';
import { NEEDS, applyNeedDeltas, isAsleep } from '../pets/needs.js';
import { signed } from '../core/utils.js';

export const PREFERENCE_EFFECTS = {
  favorite: { hungerMult: 1.2, happiness: 10 },
  neutral: { hungerMult: 1, happiness: 0 },
  disliked: { hungerMult: 0.6, happiness: -8 },
};
export const FULL_THRESHOLD = 95;

export function foodPreference(pet, foodId) {
  const sp = getSpecies(pet);
  if (sp.favoriteFoods.includes(foodId)) return 'favorite';
  if (sp.dislikedFoods.includes(foodId)) return 'disliked';
  return 'neutral';
}

export function describeEffects(effects) {
  return Object.entries(effects)
    .map(([key, v]) => `${signed(v)} ${NEEDS[key]?.label ?? key}`)
    .join(', ');
}

export function buyFood(game, foodId, qty = 1) {
  const food = FOODS[foodId];
  const cost = food.price * qty;
  if (game.coins < cost) return { ok: false, message: `Not enough coins for ${food.name}.` };
  game.coins -= cost;
  game.inventory[foodId] = (game.inventory[foodId] || 0) + qty;
  return { ok: true, message: `Bought ${food.name} (−${cost}c).` };
}

/** The need changes this pet actually gets from a food, after its likes and dislikes. */
export function feedEffects(pet, foodId) {
  const pref = PREFERENCE_EFFECTS[foodPreference(pet, foodId)];
  const deltas = { ...FOODS[foodId].effects };
  if (deltas.hunger) deltas.hunger = Math.round(deltas.hunger * pref.hungerMult);
  if (pref.happiness) deltas.happiness = (deltas.happiness || 0) + pref.happiness;
  return deltas;
}

export function feedPet(game, foodId, now = Date.now()) {
  const pet = game.pet;
  const food = FOODS[foodId];
  if (!(game.inventory[foodId] > 0)) return { ok: false, message: `No ${food.name} left. Buy some first.` };
  if (isAsleep(pet, now)) return { ok: false, message: `${pet.name} is asleep.` };
  if (!food.medicine && pet.needs.hunger >= FULL_THRESHOLD) {
    return { ok: false, message: `${pet.name} is full and turns away.`, reaction: 'sad' };
  }

  const preference = foodPreference(pet, foodId);
  const deltas = feedEffects(pet, foodId);

  applyNeedDeltas(pet, deltas);
  if (food.buff) Object.assign(pet.buffs, food.buff);
  game.inventory[foodId] -= 1;

  const messages = {
    favorite: `${pet.name} devours the ${food.name}. A favorite!`,
    neutral: `${pet.name} eats the ${food.name}.`,
    disliked: `${pet.name} reluctantly eats the ${food.name}...`,
  };
  const reaction = food.medicine ? 'sad' : preference === 'disliked' ? 'angry' : 'eat';
  return { ok: true, message: messages[preference], preference, reaction };
}
