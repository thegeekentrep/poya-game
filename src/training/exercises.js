/**
 * Training equipment (Digimon World style) and the rules of the training yard.
 * Each station raises a primary stat and, by a smaller amount, a secondary one.
 * Digimon World's stats map onto POYA's: Offense -> Attack, Brains -> Crit,
 * MP -> Stamina (lowers the energy cost of training).
 *
 * `short` is the tile label on phones.
 *
 * Progressive overload: every session adds mastery at that station. Each mastery
 * tier makes the station harder and offers one of its `moves` (any species can learn them).
 */

/** Stat gain for one perfect primary session at neutral mood. Also sets the per-stat cap. */
export const STAT_GAIN = { hp: 6, atk: 0.9, def: 0.7, spd: 0.7, crit: 0.01, sta: 1.5 };

export const EXERCISES = {
  boulder: { name: 'Boulder Moving', short: 'Boulder', primary: 'hp', secondary: 'atk', desc: 'Heave a boulder across the yard. Raises Max HP, a little Attack.', moves: ['shoulder_charge', 'second_wind'] },
  waterfall: { name: 'Waterfall', short: 'Falls', primary: 'sta', secondary: 'def', desc: 'Stand firm under the falls. Raises Stamina, a little Defense.', moves: ['focus_breath', 'torrent_crash'] },
  log: { name: 'Striking (Log)', short: 'Log', primary: 'atk', secondary: 'spd', desc: 'Pound the striking log. Raises Attack, a little Speed.', moves: ['combo_strike', 'log_splitter'] },
  glove: { name: 'Punch Glove', short: 'Glove', primary: 'def', secondary: 'crit', desc: 'Take hits from the spring glove. Raises Defense, a little Crit.', moves: ['parry', 'counterpunch'] },
  running: { name: 'Running', short: 'Run', primary: 'spd', secondary: 'hp', desc: 'Laps on the treadmill wheel. Raises Speed, a little Max HP.', moves: ['quick_step', 'blitz'] },
  classroom: { name: 'Classroom', short: 'Class', primary: 'crit', secondary: 'sta', desc: 'Study fighting at the chalkboard. Raises Crit, a little Stamina.', moves: ['analyze', 'master_plan'] },
};

export const EXERCISE_ORDER = ['boulder', 'waterfall', 'log', 'glove', 'running', 'classroom'];

export const TRAINING_RULES = {
  cost: { energy: -15, hunger: -8, hygiene: -8 },
  minEnergy: 15,
  minHunger: 10,
  minHealth: 40,
  reps: 3,
  secondaryRatio: 0.4, // secondary gain as a share of that stat's primary gain
  specialtyMult: 1.5,
  proteinBoostMult: 1.3,
  sessionsPerLevel: 6, // cap per stat = STAT_GAIN * sessionsPerLevel * level
  staminaSavingPerPoint: 0.01, // each Stamina point cuts training energy cost by 1%
  maxStaminaSaving: 0.5,
  masteryTiers: [12, 36], // mastery points needed for each station move (a rep adds its quality: perfect 1, good 0.6)
  overloadSpeed: 0.15, // timing bar speeds up by this much per mastery tier reached
  baseXp: 12,
  bonusXp: 18, // scaled by session quality
};
