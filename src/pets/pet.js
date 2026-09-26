/**
 * Pet data model: creation, derived combat stats, leveling.
 */
import { SPECIES } from './species.js';

export const STAT_KEYS = ['hp', 'atk', 'def', 'spd', 'crit'];
export const STAT_LABELS = { hp: 'Max HP', atk: 'Attack', def: 'Defense', spd: 'Speed', crit: 'Crit chance' };
export const MAX_CRIT = 0.75;

export function createPet(speciesId, name) {
  const species = SPECIES[speciesId];
  if (!species) throw new Error(`Unknown species: ${speciesId}`);
  return {
    species: speciesId,
    name: name || species.defaultName,
    level: 1,
    xp: 0,
    trained: { hp: 0, atk: 0, def: 0, spd: 0, crit: 0 },
    needs: { hunger: 80, energy: 90, happiness: 75, hygiene: 85, health: 100 },
    sleepingUntil: 0,
    cooldowns: {}, // care action id -> timestamp when available again
    buffs: {}, // e.g. { trainingBoost: 1 }
    adoptedAt: Date.now(),
  };
}

/** Fills in fields that older saves may be missing. */
export function hydratePet(raw) {
  const base = createPet(raw.species, raw.name);
  return {
    ...base,
    ...raw,
    trained: { ...base.trained, ...raw.trained },
    needs: { ...base.needs, ...raw.needs },
    cooldowns: { ...raw.cooldowns },
    buffs: { ...raw.buffs },
  };
}

export const getSpecies = (pet) => SPECIES[pet.species];

/** Combat stats = species base + level growth + training. */
export function getStats(pet) {
  const sp = getSpecies(pet);
  const lv = pet.level - 1;
  const stats = {};
  for (const key of STAT_KEYS) stats[key] = sp.base[key] + sp.growth[key] * lv + (pet.trained[key] || 0);
  stats.hp = Math.round(stats.hp);
  stats.crit = Math.min(stats.crit, MAX_CRIT);
  stats.critMult = sp.critMult;
  return stats;
}

export function formatStat(key, value) {
  if (key === 'crit') return `${(value * 100).toFixed(1)}%`;
  if (key === 'hp') return String(Math.round(value));
  return value.toFixed(1);
}

export const xpToNext = (level) => 60 + level * 40;

/** Adds XP and returns how many levels were gained. */
export function addXp(pet, amount) {
  pet.xp += amount;
  let levels = 0;
  while (pet.xp >= xpToNext(pet.level)) {
    pet.xp -= xpToNext(pet.level);
    pet.level += 1;
    levels += 1;
  }
  return levels;
}
