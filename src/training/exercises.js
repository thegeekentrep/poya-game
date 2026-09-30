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
  boulder: { name: 'Boulder Moving', short: 'Boulder', primary: 'hp', secondary: 'atk', desc: 'Swipe to shove a boulder to the flag. Raises Max HP, a little Attack.', moves: ['shoulder_charge', 'second_wind'] },
  waterfall: { name: 'Waterfall', short: 'Falls', primary: 'sta', secondary: 'def', desc: 'Keep your balance under the falls. Raises Stamina, a little Defense.', moves: ['focus_breath', 'torrent_crash'] },
  log: { name: 'Striking (Log)', short: 'Log', primary: 'atk', secondary: 'spd', desc: 'Chop a tall log down from the bottom while dodging its branches. Raises Attack, a little Speed.', moves: ['combo_strike', 'log_splitter'] },
  glove: { name: 'Punch Glove', short: 'Glove', primary: 'def', secondary: 'crit', desc: 'Block the spring gloves punching from both sides. Raises Defense, a little Crit.', moves: ['parry', 'counterpunch'] },
  running: { name: 'Running', short: 'Run', primary: 'spd', secondary: 'hp', desc: 'Swipe nonstop to sprint to the finish. Raises Speed, a little Max HP.', moves: ['quick_step', 'blitz'] },
  classroom: { name: 'Classroom', short: 'Class', primary: 'crit', secondary: 'sta', desc: 'Solve math problems at the chalkboard. Raises Crit, a little Stamina.', moves: ['analyze', 'master_plan'] },
};

/**
 * Chosen before each session. `level` makes every station play harder (see
 * gameIntensity in training/games.js); `reward` scales stat gains, XP, coins and mastery.
 */
export const TRAINING_DIFFICULTY = {
  easy: { name: 'Easy', level: 0, reward: 0.75 },
  normal: { name: 'Normal', level: 1, reward: 1 },
  hard: { name: 'Hard', level: 2, reward: 1.35 },
};
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];

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
  baseXp: 12,
  bonusXp: 18, // scaled by session quality
  baseCoins: 4, // prize money, so a broke player can still earn food and medicine
  bonusCoins: 8, // scaled by session quality
};
