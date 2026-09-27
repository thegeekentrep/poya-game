/**
 * Pet data model: creation, derived combat stats, leveling.
 */
import { SPECIES } from './species.js';

export const STAT_KEYS = ['hp', 'atk', 'def', 'spd', 'crit'];
export const STAT_LABELS = { hp: 'Max HP', atk: 'Attack', def: 'Defense', spd: 'Speed', crit: 'Crit chance', sta: 'Stamina' };
export const MAX_CRIT = 0.75;
export const LOADOUT_SIZE = 4;

export function createPet(speciesId, name) {
  const species = SPECIES[speciesId];
  if (!species) throw new Error(`Unknown species: ${speciesId}`);
  return {
    species: speciesId,
    name: name || species.defaultName,
    level: 1,
    xp: 0,
    trained: { hp: 0, atk: 0, def: 0, spd: 0, crit: 0, sta: 0 }, // sta is not a combat stat
    needs: { hunger: 80, energy: 90, happiness: 75, hygiene: 85, health: 100 },
    sleepingUntil: 0,
    cooldowns: {}, // care action id -> timestamp when available again
    buffs: {}, // e.g. { trainingBoost: 1 }
    loadout: defaultLoadout(speciesId, 1), // equipped ability ids, basic attack first
    mastery: {}, // exercise id -> mastery points (training/exercises.js)
    trainingMoves: [], // moves learned through training breakthroughs
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
    loadout: raw.loadout ? [...raw.loadout] : defaultLoadout(raw.species, raw.level || 1),
    mastery: { ...raw.mastery },
    trainingMoves: [...(raw.trainingMoves || [])],
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

// ── Moves: learned by level, up to LOADOUT_SIZE equipped ──────────

/** Learnset entries as { level, id }. */
export const learnset = (speciesId) => SPECIES[speciesId].learnset.map(([level, id]) => ({ level, id }));
export const basicMove = (speciesId) => SPECIES[speciesId].learnset[0][1];

/** Level-up moves reached so far, then moves learned through training. */
export const knownMoves = (pet) => [
  ...learnset(pet.species).filter((m) => m.level <= pet.level).map((m) => m.id),
  ...(pet.trainingMoves || []),
];

/** Moves learned on the way from fromLevel (exclusive) up to the pet's current level. */
export const movesLearnedSince = (pet, fromLevel) =>
  learnset(pet.species).filter((m) => m.level > fromLevel && m.level <= pet.level).map((m) => m.id);

/** The first moves learned, which is what auto-equipping on level-up produces. */
export const defaultLoadout = (speciesId, level) =>
  learnset(speciesId).filter((m) => m.level <= level).slice(0, LOADOUT_SIZE).map((m) => m.id);

/** The equipped moves, cleaned up: known moves only, basic attack first, at most LOADOUT_SIZE. */
export function getLoadout(pet) {
  const known = knownMoves(pet);
  const basic = basicMove(pet.species);
  const extra = (pet.loadout || []).filter((id, i, all) => id !== basic && known.includes(id) && all.indexOf(id) === i);
  return [basic, ...extra.slice(0, LOADOUT_SIZE - 1)];
}

/** Equips or unequips a move. Returns false if it can't (basic attack, full loadout, not known). */
export function setEquipped(pet, id, equip) {
  const loadout = getLoadout(pet);
  if (id === basicMove(pet.species) || !knownMoves(pet).includes(id)) return false;
  if (!equip) {
    pet.loadout = loadout.filter((m) => m !== id);
    return true;
  }
  if (loadout.includes(id)) return true;
  if (loadout.length >= LOADOUT_SIZE) return false;
  pet.loadout = [...loadout, id];
  return true;
}

export const xpToNext = (level) => 60 + level * 40;

/**
 * Adds XP and returns how many levels were gained. New moves go straight into
 * free loadout slots; see movesLearnedSince for what was learned.
 */
export function addXp(pet, amount) {
  pet.xp += amount;
  let levels = 0;
  while (pet.xp >= xpToNext(pet.level)) {
    pet.xp -= xpToNext(pet.level);
    pet.level += 1;
    levels += 1;
  }
  for (const id of movesLearnedSince(pet, pet.level - levels)) setEquipped(pet, id, true);
  return levels;
}
